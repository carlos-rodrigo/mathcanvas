/**
 * Tutor Interaction Orchestrator
 *
 * State-machine that wires together:
 *   STT (voice input) → LLM (assistant response) →
 *   Canvas renderer + TTS (visual + audio output) → wait state
 *
 * Phases (see {@link TutorPhase}):
 *   greeting → idle ⇄ recording → processing → presenting → idle
 *                                                   ↘ error → idle (retry)
 *
 * Context window is kept in-memory only.  Call {@link resetContext} to
 * clear conversation history.
 */

import type { SpeechRecognitionService } from "@/lib/speech/SpeechRecognitionService";
import type { TTSProvider } from "@/lib/tts/TTSProvider";
import type {
  AssistantPayload,
  CanvasCommand,
  CanvasElement,
} from "@/lib/commands/canvasTypes";
import { parseAssistantPayload } from "@/lib/commands/validateCommandPayload";
import { TutorStore } from "./tutorStore";

// ── Public interfaces ─────────────────────────────────────────────────

/** A single message in the lightweight conversation context. */
export interface ContextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Adapter that sends the current conversation context to an LLM and
 * returns the raw response string (expected to be JSON matching
 * {@link AssistantPayload}).
 */
export interface LLMAdapter {
  sendMessages(messages: ContextMessage[]): Promise<string>;
}

/**
 * Applies a batch of {@link CanvasCommand}s and returns the resulting
 * element list.  The orchestrator does not care *how* the renderer works
 * — it only needs the final element snapshot to feed into the store.
 */
export interface CanvasRenderer {
  applyCommands(commands: CanvasCommand[]): CanvasElement[];
}

export interface TutorOrchestratorConfig {
  stt: SpeechRecognitionService;
  tts: TTSProvider;
  llm: LLMAdapter;
  renderer: CanvasRenderer;
  /** Greeting text spoken on session start. */
  greetingText?: string;
  /** System prompt prepended to every LLM request. */
  systemPrompt?: string;
  /** Silence timeout for STT in ms (default 30 000). */
  sttTimeoutMs?: number;
  /** Maximum wait time for an LLM response in ms (default 30 000). */
  llmTimeoutMs?: number;
}

// ── Defaults ──────────────────────────────────────────────────────────

const DEFAULT_GREETING =
  "¡Hola! Soy tu tutor de matemáticas. ¿En qué te puedo ayudar hoy?";

const DEFAULT_SYSTEM_PROMPT =
  "You are a friendly math tutor for children. Respond in Spanish. " +
  "Return JSON with canvas_commands, speech, and waiting_for_response fields.";

const DEFAULT_STT_TIMEOUT_MS = 30_000;
const DEFAULT_LLM_TIMEOUT_MS = 30_000;

// ── Orchestrator ──────────────────────────────────────────────────────

export class TutorOrchestrator {
  /** Observable state tree. */
  readonly store: TutorStore;

  // injected deps
  private readonly _stt: SpeechRecognitionService;
  private readonly _tts: TTSProvider;
  private readonly _llm: LLMAdapter;
  private readonly _renderer: CanvasRenderer;

  // config
  private readonly _greetingText: string;
  private readonly _systemPrompt: string;
  private readonly _sttTimeoutMs: number;
  private readonly _llmTimeoutMs: number;

  // runtime bookkeeping
  private _context: ContextMessage[] = [];
  private _transcript = "";
  private _sttTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private _sttUnsubscribers: (() => void)[] = [];
  private _destroyed = false;

  constructor(config: TutorOrchestratorConfig) {
    this.store = new TutorStore();
    this._stt = config.stt;
    this._tts = config.tts;
    this._llm = config.llm;
    this._renderer = config.renderer;
    this._greetingText = config.greetingText ?? DEFAULT_GREETING;
    this._systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this._sttTimeoutMs = config.sttTimeoutMs ?? DEFAULT_STT_TIMEOUT_MS;
    this._llmTimeoutMs = config.llmTimeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Begin the session.  Speaks the greeting then transitions to `idle`.
   * If STT is unsupported the orchestrator immediately enters `error`.
   */
  async start(): Promise<void> {
    if (this._destroyed) return;

    // Bail early when STT is missing.
    if (this._stt.status === "unsupported") {
      this.store.setError(
        "Speech recognition is not supported in this browser.",
      );
      return;
    }

    // Seed the conversation context.
    this._context = [{ role: "system", content: this._systemPrompt }];

    this.store.setPhase("greeting");
    this.store.setSpeechText(this._greetingText);

    try {
      await this._tts.speak(this._greetingText);
    } catch {
      // TTS failure during greeting is non-fatal — the text is still
      // visible in the UI.
    }

    if (this._destroyed) return;
    this.store.setPhase("idle");
  }

  // ── Voice recording ─────────────────────────────────────────────────

  /**
   * Start capturing the learner's voice.
   * Only allowed when the orchestrator is `idle` or `presenting`.
   */
  startRecording(): void {
    const { phase } = this.store.state;
    if (phase !== "idle" && phase !== "presenting") return;
    if (this._destroyed) return;

    // Interrupt any ongoing TTS playback.
    this._tts.stop();

    this._transcript = "";
    this.store.setPhase("recording");

    // Wire STT events.
    const unsubResult = this._stt.onResult((result) => {
      this._transcript = result.finalTranscript || result.interimTranscript;
    });

    const unsubError = this._stt.onError((_code, message) => {
      this._clearSttTimeout();
      this._cleanupSttListeners();
      this.store.setError(`Speech recognition error: ${message}`);
    });

    this._sttUnsubscribers.push(unsubResult, unsubError);

    this._stt.start();
    this._startSttTimeout();
  }

  /**
   * Stop recording and submit the captured transcript to the LLM.
   * If no speech was captured the orchestrator simply returns to `idle`.
   */
  async stopRecording(): Promise<void> {
    if (this.store.state.phase !== "recording") return;

    this._clearSttTimeout();
    this._stt.stop();
    this._cleanupSttListeners();

    const transcript = this._transcript.trim();
    if (!transcript) {
      this.store.setPhase("idle");
      return;
    }

    await this._processUserInput(transcript);
  }

  // ── TTS controls ────────────────────────────────────────────────────

  /** Interrupt TTS playback and return to `idle`. */
  stopSpeaking(): void {
    this._tts.stop();
    if (this.store.state.phase === "presenting") {
      this.store.setPhase("idle");
    }
  }

  /** Re-play the last tutor speech text. */
  async replay(): Promise<void> {
    const { speechText, phase } = this.store.state;
    if (!speechText) return;
    if (phase !== "idle" && phase !== "presenting") return;
    if (this._destroyed) return;

    this.store.setPhase("presenting");
    try {
      await this._tts.speak(speechText);
    } catch {
      // non-fatal
    }
    if (this._destroyed) return;
    this.store.setPhase("idle");
  }

  // ── Error recovery ──────────────────────────────────────────────────

  /** Dismiss the current error and return to `idle`. */
  retry(): void {
    if (this.store.state.phase !== "error") return;
    this.store.clearError();
    this.store.setPhase("idle");
  }

  // ── Context management ──────────────────────────────────────────────

  /**
   * Wipe conversation history *and* store state.  The orchestrator can
   * be re-used by calling {@link start} afterwards.
   */
  resetContext(): void {
    this._context = [{ role: "system", content: this._systemPrompt }];
    this.store.reset();
  }

  /** Read-only view of the current conversation context. */
  get context(): ReadonlyArray<ContextMessage> {
    return this._context;
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  /**
   * Tear down the orchestrator — cancel STT, stop TTS, clear timers.
   * The instance should not be re-used after this call.
   */
  destroy(): void {
    this._destroyed = true;
    this._clearSttTimeout();
    this._cleanupSttListeners();
    this._stt.cancel();
    this._tts.stop();
  }

  // ── Private: core flow ──────────────────────────────────────────────

  private async _processUserInput(transcript: string): Promise<void> {
    if (this._destroyed) return;

    this.store.setPhase("processing");

    // Append user turn.
    this._context.push({ role: "user", content: transcript });

    let rawResponse: string;
    try {
      rawResponse = await this._callLLMWithTimeout(this._context);
    } catch (err) {
      this.store.setError(`LLM error: ${(err as Error).message}`);
      // Roll back the failed user turn so re-tries start clean.
      this._context.pop();
      return;
    }

    if (this._destroyed) return;

    // Validate assistant JSON.
    const parseResult = parseAssistantPayload(rawResponse);
    if (!parseResult.ok) {
      this.store.setError(`Invalid assistant response: ${parseResult.error}`);
      this._context.pop();
      return;
    }

    const payload = parseResult.value;

    // Persist the raw response in context for follow-ups.
    this._context.push({ role: "assistant", content: rawResponse });

    await this._present(payload);
  }

  private async _present(payload: AssistantPayload): Promise<void> {
    if (this._destroyed) return;

    this.store.setPhase("presenting");

    // Canvas
    const elements = this._renderer.applyCommands(payload.canvas_commands);
    this.store.setCanvasElements(elements);

    // Speech text + exercise
    this.store.setSpeechText(payload.speech);
    this.store.setExercise(payload.exercise ?? null);

    // TTS
    try {
      await this._tts.speak(payload.speech);
    } catch {
      // TTS failure is non-fatal — text is visible.
    }

    if (this._destroyed) return;

    this.store.setPhase("idle");
  }

  // ── Private: helpers ────────────────────────────────────────────────

  private _callLLMWithTimeout(
    messages: ContextMessage[],
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("LLM request timed out"));
      }, this._llmTimeoutMs);

      this._llm
        .sendMessages([...messages])
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private _startSttTimeout(): void {
    this._clearSttTimeout();
    this._sttTimeoutId = setTimeout(() => {
      if (this.store.state.phase === "recording") {
        this._stt.stop();
        this._cleanupSttListeners();
        const transcript = this._transcript.trim();
        if (transcript) {
          this._processUserInput(transcript);
        } else {
          this.store.setError("No speech detected. Please try again.");
        }
      }
    }, this._sttTimeoutMs);
  }

  private _clearSttTimeout(): void {
    if (this._sttTimeoutId !== null) {
      clearTimeout(this._sttTimeoutId);
      this._sttTimeoutId = null;
    }
  }

  private _cleanupSttListeners(): void {
    for (const unsub of this._sttUnsubscribers) {
      unsub();
    }
    this._sttUnsubscribers = [];
  }
}
