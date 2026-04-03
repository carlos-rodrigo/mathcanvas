import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TutorOrchestrator,
  type LLMAdapter,
  type CanvasRenderer,
  type ContextMessage,
} from "../tutorOrchestrator";
import { TutorStore } from "../tutorStore";
import type { TutorPhase } from "@/types/tutorState";
import { INITIAL_TUTOR_STATE } from "@/types/tutorState";
import type { AssistantPayload, CanvasElement } from "@/lib/commands/canvasTypes";
import type {
  RecognitionResult,
  RecognitionErrorCode,
} from "@/lib/speech/SpeechRecognitionService";
import { SpeechRecognitionService } from "@/lib/speech/SpeechRecognitionService";
import type { TTSProvider, PlaybackState } from "@/lib/tts/TTSProvider";

// ─── Helpers: valid AssistantPayload JSON ─────────────────────────────────────

function makePayloadJSON(overrides?: Partial<AssistantPayload>): string {
  const payload: AssistantPayload = {
    canvas_commands: [
      {
        action: "draw",
        element: {
          type: "TextBubble",
          id: "tb-1",
          position: { x: 10, y: 10 },
          text: "¡Muy bien!",
        },
      },
    ],
    speech: "Muy bien, sigamos practicando.",
    waiting_for_response: false,
    ...overrides,
  };
  return JSON.stringify(payload);
}

// ─── Helpers: mock SpeechRecognition ──────────────────────────────────────────

function createMockRecognition() {
  const mock = {
    lang: "",
    interimResults: false,
    continuous: false,
    onstart: null as (() => void) | null,
    onresult: null as ((e: unknown) => void) | null,
    onerror: null as ((e: unknown) => void) | null,
    onend: null as (() => void) | null,
    start: vi.fn(() => {
      queueMicrotask(() => mock.onstart?.());
    }),
    stop: vi.fn(() => {
      queueMicrotask(() => mock.onend?.());
    }),
    abort: vi.fn(() => {
      queueMicrotask(() => mock.onend?.());
    }),
    emitResult(finals: string[], interims: string[] = []) {
      const results = [
        ...finals.map((t) => mockResult(t, true)),
        ...interims.map((t) => mockResult(t, false)),
      ];
      const resultList = Object.assign(results, {
        item: (i: number) => results[i],
        length: results.length,
      });
      mock.onresult?.({ results: resultList, resultIndex: 0 });
    },
    emitError(error: string, message = "") {
      mock.onerror?.({ error, message });
    },
  };
  return mock;
}

function mockResult(transcript: string, isFinal: boolean): SpeechRecognitionResult {
  return {
    isFinal,
    length: 1,
    item: () => ({ transcript, confidence: 0.95 }) as SpeechRecognitionAlternative,
    0: { transcript, confidence: 0.95 } as SpeechRecognitionAlternative,
  } as SpeechRecognitionResult;
}

// ─── Helpers: mock TTSProvider ────────────────────────────────────────────────

function createMockTTS(): TTSProvider & { _resolve: () => void } {
  let _state: PlaybackState = "idle";
  const listeners = new Set<(s: PlaybackState) => void>();
  let resolve: () => void = () => {};

  const setState = (s: PlaybackState) => {
    if (s === _state) return;
    _state = s;
    for (const fn of listeners) fn(s);
  };

  return {
    name: "Mock TTS",
    get state() {
      return _state;
    },
    onStateChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    speak: vi.fn((_text: string) => {
      setState("loading");
      setState("speaking");
      return new Promise<void>((res) => {
        resolve = () => {
          setState("idle");
          res();
        };
      });
    }),
    stop: vi.fn(() => {
      setState("idle");
      resolve(); // resolve any pending speak
    }),
    get _resolve() {
      return resolve;
    },
  };
}

/** A mock TTS that resolves instantly. */
function createInstantTTS(): TTSProvider {
  let _state: PlaybackState = "idle";
  const listeners = new Set<(s: PlaybackState) => void>();
  const setState = (s: PlaybackState) => {
    if (s === _state) return;
    _state = s;
    for (const fn of listeners) fn(s);
  };
  return {
    name: "Instant Mock TTS",
    get state() {
      return _state;
    },
    onStateChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    speak: vi.fn(async () => {
      setState("speaking");
      setState("idle");
    }),
    stop: vi.fn(() => {
      setState("idle");
    }),
  };
}

/** A mock TTS that rejects on speak(). */
function createFailingTTS(): TTSProvider {
  return {
    name: "Failing Mock TTS",
    state: "idle",
    onStateChange: () => () => {},
    speak: vi.fn(() => Promise.reject(new Error("TTS unavailable"))),
    stop: vi.fn(),
  };
}

// ─── Helpers: mock LLMAdapter ─────────────────────────────────────────────────

function createMockLLM(response?: string): LLMAdapter {
  return {
    sendMessages: vi.fn(async () => response ?? makePayloadJSON()),
  };
}

function createFailingLLM(errorMessage = "Service unavailable"): LLMAdapter {
  return {
    sendMessages: vi.fn(async () => {
      throw new Error(errorMessage);
    }),
  };
}

function createHangingLLM(): LLMAdapter {
  return {
    sendMessages: vi.fn(() => new Promise<string>(() => {})), // never resolves
  };
}

// ─── Helpers: mock CanvasRenderer ─────────────────────────────────────────────

function createMockRenderer(): CanvasRenderer {
  return {
    applyCommands: vi.fn((commands) => {
      const elements: CanvasElement[] = [];
      for (const cmd of commands) {
        if (cmd.action === "draw") elements.push(cmd.element);
      }
      return elements;
    }),
  };
}

// ─── Helpers: phase tracker ───────────────────────────────────────────────────

function trackPhases(store: TutorStore): TutorPhase[] {
  const phases: TutorPhase[] = [];
  store.subscribe((s) => phases.push(s.phase));
  return phases;
}

// ═══════════════════════════════════════════════════════════════════════
// TutorStore
// ═══════════════════════════════════════════════════════════════════════

describe("TutorStore", () => {
  let store: TutorStore;

  beforeEach(() => {
    store = new TutorStore();
  });

  it("initialises with INITIAL_TUTOR_STATE", () => {
    expect(store.state).toEqual(INITIAL_TUTOR_STATE);
  });

  it("accepts partial initial overrides", () => {
    const s = new TutorStore({ phase: "processing", speechText: "hi" });
    expect(s.state.phase).toBe("processing");
    expect(s.state.speechText).toBe("hi");
    // defaults preserved
    expect(s.state.canvasElements).toEqual([]);
  });

  it("setPhase updates phase and notifies", () => {
    const phases: TutorPhase[] = [];
    store.subscribe((s) => phases.push(s.phase));
    store.setPhase("recording");
    expect(store.state.phase).toBe("recording");
    expect(phases).toEqual(["recording"]);
  });

  it("setSpeechText updates speechText", () => {
    store.setSpeechText("Hola");
    expect(store.state.speechText).toBe("Hola");
  });

  it("setCanvasElements updates elements", () => {
    const el: CanvasElement = {
      type: "TextBubble",
      id: "t1",
      position: { x: 0, y: 0 },
      text: "hi",
    };
    store.setCanvasElements([el]);
    expect(store.state.canvasElements).toEqual([el]);
  });

  it("setExercise sets and clears exercise", () => {
    store.setExercise({ question: "2+2?" });
    expect(store.state.exercise).toEqual({ question: "2+2?" });
    store.setExercise(null);
    expect(store.state.exercise).toBeNull();
  });

  it("setError transitions to error phase with message", () => {
    store.setError("boom");
    expect(store.state.phase).toBe("error");
    expect(store.state.errorMessage).toBe("boom");
  });

  it("clearError removes errorMessage", () => {
    store.setError("boom");
    store.clearError();
    expect(store.state.errorMessage).toBeNull();
    // phase stays until explicitly changed
    expect(store.state.phase).toBe("error");
  });

  it("reset returns to INITIAL_TUTOR_STATE", () => {
    store.setPhase("processing");
    store.setSpeechText("hi");
    store.setError("oops");
    store.reset();
    expect(store.state).toEqual(INITIAL_TUTOR_STATE);
  });

  it("unsubscribe stops notifications", () => {
    const calls: number[] = [];
    const unsub = store.subscribe(() => calls.push(1));
    store.setPhase("idle");
    expect(calls).toHaveLength(1);
    unsub();
    store.setPhase("recording");
    expect(calls).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TutorOrchestrator
// ═══════════════════════════════════════════════════════════════════════

describe("TutorOrchestrator", () => {
  let mockRec: ReturnType<typeof createMockRecognition>;
  let stt: SpeechRecognitionService;
  let tts: ReturnType<typeof createMockTTS>;
  let llm: LLMAdapter;
  let renderer: CanvasRenderer;
  let orch: TutorOrchestrator;

  beforeEach(() => {
    mockRec = createMockRecognition();
    stt = new SpeechRecognitionService(
      { lang: "es-AR" },
      () => mockRec as unknown as SpeechRecognition,
    );
    tts = createMockTTS();
    llm = createMockLLM();
    renderer = createMockRenderer();
    orch = new TutorOrchestrator({ stt, tts, llm, renderer });
  });

  afterEach(() => {
    orch.destroy();
    vi.restoreAllMocks();
  });

  // ── start() / greeting ──────────────────────────────────────────────

  describe("start() – greeting flow", () => {
    it("speaks the greeting then transitions greeting → idle", async () => {
      const phases = trackPhases(orch.store);

      const startPromise = orch.start();
      // TTS speak was called
      expect(tts.speak).toHaveBeenCalledOnce();

      // Still in greeting while TTS is playing
      expect(orch.store.state.phase).toBe("greeting");

      // Resolve TTS
      tts._resolve();
      await startPromise;

      expect(orch.store.state.phase).toBe("idle");
      expect(phases).toEqual(["greeting", expect.any(String), "idle"]);
    });

    it("sets speechText to greeting text", async () => {
      const startPromise = orch.start();
      expect(orch.store.state.speechText).toContain("¡Hola!");
      tts._resolve();
      await startPromise;
    });

    it("uses custom greeting text when provided", async () => {
      const custom = new TutorOrchestrator({
        stt,
        tts: createInstantTTS(),
        llm,
        renderer,
        greetingText: "Bienvenido",
      });
      await custom.start();
      expect(custom.store.state.speechText).toBe("Bienvenido");
      custom.destroy();
    });

    it("transitions to idle even when TTS fails (non-fatal)", async () => {
      const failTTS = createFailingTTS();
      const o = new TutorOrchestrator({ stt, tts: failTTS, llm, renderer });
      await o.start();
      expect(o.store.state.phase).toBe("idle");
      o.destroy();
    });

    it("enters error when STT is unsupported", async () => {
      const unsupported = new SpeechRecognitionService(); // no factory → unsupported
      const o = new TutorOrchestrator({
        stt: unsupported,
        tts: createInstantTTS(),
        llm,
        renderer,
      });
      await o.start();
      expect(o.store.state.phase).toBe("error");
      expect(o.store.state.errorMessage).toContain("not supported");
      o.destroy();
    });

    it("seeds context with system prompt on start", async () => {
      const instant = new TutorOrchestrator({
        stt,
        tts: createInstantTTS(),
        llm,
        renderer,
        systemPrompt: "Custom prompt",
      });
      await instant.start();
      expect(instant.context[0]).toEqual({
        role: "system",
        content: "Custom prompt",
      });
      instant.destroy();
    });
  });

  // ── Recording ───────────────────────────────────────────────────────

  describe("startRecording() / stopRecording()", () => {
    beforeEach(async () => {
      // Get to idle first
      const p = orch.start();
      tts._resolve();
      await p;
    });

    it("transitions to recording and starts STT", async () => {
      orch.startRecording();
      expect(orch.store.state.phase).toBe("recording");
      expect(mockRec.start).toHaveBeenCalledOnce();
    });

    it("is a no-op when not in idle or presenting", () => {
      orch.store.setPhase("processing");
      orch.startRecording();
      expect(orch.store.state.phase).toBe("processing");
      expect(mockRec.start).not.toHaveBeenCalled();
    });

    it("stops TTS before starting recording if presenting", async () => {
      orch.store.setPhase("presenting");
      orch.startRecording();
      expect(tts.stop).toHaveBeenCalled();
    });

    it("stopRecording returns to idle when transcript is empty", async () => {
      orch.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));

      // No result emitted → empty transcript
      await orch.stopRecording();
      expect(orch.store.state.phase).toBe("idle");
    });

    it("stopRecording stops STT", async () => {
      orch.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));

      await orch.stopRecording();
      expect(mockRec.stop).toHaveBeenCalled();
    });

    it("stopRecording is a no-op when not recording", async () => {
      await orch.stopRecording();
      expect(orch.store.state.phase).toBe("idle");
    });
  });

  // ── Full flow: recording → processing → presenting → idle ──────────

  describe("full interaction flow", () => {
    beforeEach(async () => {
      const p = orch.start();
      tts._resolve();
      await p;
    });

    it("goes recording → processing → presenting → idle", async () => {
      const phases = trackPhases(orch.store);

      // Start recording
      orch.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));

      // Simulate speech result
      mockRec.emitResult(["tres cuartos"]);

      // Reset TTS mock to track the presentation speak call
      (tts.speak as ReturnType<typeof vi.fn>).mockClear();

      // Stop recording → triggers processing → presenting
      const stopPromise = orch.stopRecording();

      // Wait for processing phase
      await vi.waitFor(() => expect(orch.store.state.phase).toBe("processing"));

      // LLM should have been called
      expect(llm.sendMessages).toHaveBeenCalledOnce();

      // Wait for presenting phase (after LLM resolves)
      await vi.waitFor(() => expect(orch.store.state.phase).toBe("presenting"));

      // TTS should be called with speech from payload
      expect(tts.speak).toHaveBeenCalledWith("Muy bien, sigamos practicando.");

      // Resolve TTS to finish presentation
      tts._resolve();
      await stopPromise;

      expect(orch.store.state.phase).toBe("idle");
      expect(phases).toContain("recording");
      expect(phases).toContain("processing");
      expect(phases).toContain("presenting");
      expect(phases[phases.length - 1]).toBe("idle");
    });

    it("applies canvas commands via the renderer", async () => {
      orch.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));
      mockRec.emitResult(["hola"]);

      const stopPromise = orch.stopRecording();
      await vi.waitFor(() => expect(orch.store.state.phase).toBe("presenting"));

      expect(renderer.applyCommands).toHaveBeenCalledOnce();
      expect(orch.store.state.canvasElements).toHaveLength(1);
      expect(orch.store.state.canvasElements[0].type).toBe("TextBubble");

      tts._resolve();
      await stopPromise;
    });

    it("sets exercise in store when payload has one", async () => {
      const payloadWithExercise = makePayloadJSON({
        exercise: { question: "¿Cuánto es 2+2?", acceptedAnswers: ["4"] },
        waiting_for_response: true,
      });
      const llmWithExercise = createMockLLM(payloadWithExercise);
      const o = new TutorOrchestrator({
        stt,
        tts,
        llm: llmWithExercise,
        renderer,
      });
      const p = o.start();
      tts._resolve();
      await p;

      o.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));
      mockRec.emitResult(["sumemos"]);

      const stop = o.stopRecording();
      await vi.waitFor(() => expect(o.store.state.phase).toBe("presenting"));
      expect(o.store.state.exercise).toEqual({
        question: "¿Cuánto es 2+2?",
        acceptedAnswers: ["4"],
      });

      tts._resolve();
      await stop;
      o.destroy();
    });

    it("appends user and assistant messages to context", async () => {
      orch.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));
      mockRec.emitResult(["mi pregunta"]);

      const stopPromise = orch.stopRecording();
      await vi.waitFor(() => expect(orch.store.state.phase).toBe("presenting"));
      tts._resolve();
      await stopPromise;

      const ctx = orch.context;
      expect(ctx).toHaveLength(3); // system + user + assistant
      expect(ctx[1]).toEqual({ role: "user", content: "mi pregunta" });
      expect(ctx[2].role).toBe("assistant");
    });
  });

  // ── LLM error handling ──────────────────────────────────────────────

  describe("LLM error handling", () => {
    beforeEach(async () => {
      const p = orch.start();
      tts._resolve();
      await p;
    });

    it("enters error state when LLM throws", async () => {
      // Replace orchestrator with failing LLM
      const o = new TutorOrchestrator({
        stt,
        tts: createInstantTTS(),
        llm: createFailingLLM("API down"),
        renderer,
      });
      const p = o.start();
      await p;

      o.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));
      mockRec.emitResult(["algo"]);

      await o.stopRecording();

      expect(o.store.state.phase).toBe("error");
      expect(o.store.state.errorMessage).toContain("API down");
      o.destroy();
    });

    it("does not add user message to context on LLM failure", async () => {
      const o = new TutorOrchestrator({
        stt,
        tts: createInstantTTS(),
        llm: createFailingLLM(),
        renderer,
      });
      await o.start();

      o.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));
      mockRec.emitResult(["test"]);

      await o.stopRecording();

      // Only system message remains
      expect(o.context).toHaveLength(1);
      expect(o.context[0].role).toBe("system");
      o.destroy();
    });

    it("enters error when LLM returns invalid JSON", async () => {
      const badLLM = createMockLLM("not valid json {{{");
      const o = new TutorOrchestrator({
        stt,
        tts: createInstantTTS(),
        llm: badLLM,
        renderer,
      });
      await o.start();

      o.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));
      mockRec.emitResult(["test"]);

      await o.stopRecording();

      expect(o.store.state.phase).toBe("error");
      expect(o.store.state.errorMessage).toContain("Invalid");
      expect(o.context).toHaveLength(1); // rolled back
      o.destroy();
    });

    it("enters error when LLM returns JSON missing required fields", async () => {
      const badLLM = createMockLLM(JSON.stringify({ speech: "hi" }));
      const o = new TutorOrchestrator({
        stt,
        tts: createInstantTTS(),
        llm: badLLM,
        renderer,
      });
      await o.start();

      o.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));
      mockRec.emitResult(["test"]);

      await o.stopRecording();

      expect(o.store.state.phase).toBe("error");
      expect(o.context).toHaveLength(1);
      o.destroy();
    });
  });

  // ── LLM timeout ────────────────────────────────────────────────────

  describe("LLM timeout", () => {
    it("enters error when LLM exceeds timeout", async () => {
      vi.useFakeTimers();

      const hangLLM = createHangingLLM();
      const o = new TutorOrchestrator({
        stt,
        tts: createInstantTTS(),
        llm: hangLLM,
        renderer,
        llmTimeoutMs: 500,
      });

      await o.start();

      o.startRecording();
      // Manually flush the microtask for STT onstart
      await vi.advanceTimersByTimeAsync(0);

      mockRec.emitResult(["pregunta"]);

      const stopPromise = o.stopRecording();

      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(600);
      await stopPromise;

      expect(o.store.state.phase).toBe("error");
      expect(o.store.state.errorMessage).toContain("timed out");

      vi.useRealTimers();
      o.destroy();
    });
  });

  // ── STT timeout ────────────────────────────────────────────────────

  describe("STT timeout", () => {
    it("enters error on silence timeout with no transcript", async () => {
      vi.useFakeTimers();

      const o = new TutorOrchestrator({
        stt,
        tts: createInstantTTS(),
        llm,
        renderer,
        sttTimeoutMs: 200,
      });
      await o.start();

      o.startRecording();
      await vi.advanceTimersByTimeAsync(0); // flush microtask for STT start

      // No speech emitted – advance past timeout
      await vi.advanceTimersByTimeAsync(300);

      expect(o.store.state.phase).toBe("error");
      expect(o.store.state.errorMessage).toContain("No speech");

      vi.useRealTimers();
      o.destroy();
    });

    it("processes transcript on STT timeout when speech was captured", async () => {
      vi.useFakeTimers();

      const o = new TutorOrchestrator({
        stt,
        tts: createInstantTTS(),
        llm,
        renderer,
        sttTimeoutMs: 200,
      });
      await o.start();

      o.startRecording();
      await vi.advanceTimersByTimeAsync(0);

      // Emit speech result
      mockRec.emitResult(["hola mundo"]);

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(300);

      // Should have moved to processing (not error)
      // LLM call should have been made
      expect(llm.sendMessages).toHaveBeenCalled();

      vi.useRealTimers();
      o.destroy();
    });
  });

  // ── STT error ──────────────────────────────────────────────────────

  describe("STT error during recording", () => {
    beforeEach(async () => {
      const p = orch.start();
      tts._resolve();
      await p;
    });

    it("enters error state on STT error", async () => {
      orch.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));

      mockRec.emitError("not-allowed", "Permission denied");

      expect(orch.store.state.phase).toBe("error");
      expect(orch.store.state.errorMessage).toContain("Permission denied");
    });
  });

  // ── TTS controls ───────────────────────────────────────────────────

  describe("stopSpeaking()", () => {
    it("stops TTS and transitions presenting → idle", async () => {
      const p = orch.start();
      tts._resolve();
      await p;

      orch.store.setPhase("presenting");
      orch.stopSpeaking();

      expect(tts.stop).toHaveBeenCalled();
      expect(orch.store.state.phase).toBe("idle");
    });

    it("is safe to call in non-presenting phases", async () => {
      const p = orch.start();
      tts._resolve();
      await p;

      orch.stopSpeaking();
      expect(orch.store.state.phase).toBe("idle"); // unchanged
    });
  });

  describe("replay()", () => {
    beforeEach(async () => {
      const p = orch.start();
      tts._resolve();
      await p;
    });

    it("re-speaks the last speech text", async () => {
      orch.store.setSpeechText("Repite esto");
      (tts.speak as ReturnType<typeof vi.fn>).mockClear();

      const replayPromise = orch.replay();
      expect(orch.store.state.phase).toBe("presenting");
      expect(tts.speak).toHaveBeenCalledWith("Repite esto");

      tts._resolve();
      await replayPromise;

      expect(orch.store.state.phase).toBe("idle");
    });

    it("does nothing when speechText is empty", async () => {
      orch.store.setSpeechText("");
      (tts.speak as ReturnType<typeof vi.fn>).mockClear();

      await orch.replay();
      expect(tts.speak).not.toHaveBeenCalled();
    });

    it("does nothing when in wrong phase", async () => {
      orch.store.setPhase("processing");
      orch.store.setSpeechText("Algo");
      (tts.speak as ReturnType<typeof vi.fn>).mockClear();

      await orch.replay();
      expect(tts.speak).not.toHaveBeenCalled();
    });
  });

  // ── retry() ─────────────────────────────────────────────────────────

  describe("retry()", () => {
    it("clears error and transitions to idle", async () => {
      const p = orch.start();
      tts._resolve();
      await p;

      orch.store.setError("oops");
      expect(orch.store.state.phase).toBe("error");

      orch.retry();
      expect(orch.store.state.phase).toBe("idle");
      expect(orch.store.state.errorMessage).toBeNull();
    });

    it("is a no-op when not in error phase", async () => {
      const p = orch.start();
      tts._resolve();
      await p;

      orch.retry();
      expect(orch.store.state.phase).toBe("idle");
    });
  });

  // ── resetContext() ──────────────────────────────────────────────────

  describe("resetContext()", () => {
    it("clears context to only system prompt", async () => {
      const o = new TutorOrchestrator({
        stt,
        tts: createInstantTTS(),
        llm,
        renderer,
        systemPrompt: "Test prompt",
      });
      await o.start();

      // Simulate a full turn to populate context
      o.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));
      mockRec.emitResult(["hola"]);
      await o.stopRecording();

      expect(o.context.length).toBeGreaterThan(1);

      o.resetContext();
      expect(o.context).toHaveLength(1);
      expect(o.context[0]).toEqual({ role: "system", content: "Test prompt" });
      o.destroy();
    });

    it("resets store to initial state", async () => {
      const p = orch.start();
      tts._resolve();
      await p;

      orch.store.setSpeechText("modified");
      orch.resetContext();
      expect(orch.store.state).toEqual(INITIAL_TUTOR_STATE);
    });
  });

  // ── destroy() ───────────────────────────────────────────────────────

  describe("destroy()", () => {
    it("cancels STT and stops TTS", async () => {
      const p = orch.start();
      tts._resolve();
      await p;

      orch.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));

      orch.destroy();

      expect(mockRec.abort).toHaveBeenCalled();
      expect(tts.stop).toHaveBeenCalled();
    });

    it("prevents further actions after destroy", async () => {
      orch.destroy();

      await orch.start();
      expect(orch.store.state.phase).not.toBe("idle");

      orch.startRecording();
      expect(orch.store.state.phase).not.toBe("recording");
    });
  });

  // ── TTS failure during presentation is non-fatal ───────────────────

  describe("TTS failure during presentation", () => {
    it("still transitions to idle when TTS fails during present", async () => {
      // Start with instant TTS for greeting, then swap
      const o = new TutorOrchestrator({
        stt,
        tts: createFailingTTS(),
        llm,
        renderer,
      });
      // Start will survive TTS failure
      await o.start();
      expect(o.store.state.phase).toBe("idle");

      o.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));
      mockRec.emitResult(["pregunta"]);

      await o.stopRecording();

      // Should be idle, not error (TTS failure is non-fatal)
      expect(o.store.state.phase).toBe("idle");
      o.destroy();
    });
  });

  // ── Multi-turn context accumulation ─────────────────────────────────

  describe("multi-turn context", () => {
    it("accumulates across turns", async () => {
      const o = new TutorOrchestrator({
        stt,
        tts: createInstantTTS(),
        llm,
        renderer,
      });
      await o.start();

      // Turn 1
      o.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));
      mockRec.emitResult(["turno uno"]);
      await o.stopRecording();

      // Need to create a new mock recognition for second turn since the
      // previous one may have been stopped
      mockRec = createMockRecognition();
      stt = new SpeechRecognitionService(
        { lang: "es-AR" },
        () => mockRec as unknown as SpeechRecognition,
      );
      const o2 = new TutorOrchestrator({
        stt,
        tts: createInstantTTS(),
        llm,
        renderer,
      });
      await o2.start();

      o2.startRecording();
      await vi.waitFor(() => expect(stt.status).toBe("listening"));
      mockRec.emitResult(["turno dos"]);
      await o2.stopRecording();

      expect(o2.context).toHaveLength(3); // system + user + assistant
      expect(o2.context[1].content).toBe("turno dos");

      o.destroy();
      o2.destroy();
    });
  });
});
