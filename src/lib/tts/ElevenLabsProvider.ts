import {
  type PlaybackState,
  type TTSProvider,
  type TTSVoiceOptions,
  SPANISH_TUTOR_DEFAULTS,
} from "./TTSProvider";

export interface ElevenLabsProviderConfig {
  apiKey: string;
  /** ElevenLabs voice ID. Defaults to a well-known multilingual voice. */
  voiceId?: string;
  /** Default voice options merged with SPANISH_TUTOR_DEFAULTS. */
  defaults?: Partial<TTSVoiceOptions>;
}

/**
 * Stub adapter for ElevenLabs TTS.
 *
 * This implementation validates configuration and transitions through
 * the correct playback states but does **not** make real network
 * requests.  It is provided so that:
 *
 * 1. Consumers can code against the `TTSProvider` interface today.
 * 2. The state-machine contract is fully exercised in tests.
 * 3. Swapping in a real implementation later is a one-file change.
 *
 * Every call to `speak()` resolves after a short simulated delay.
 */
export class ElevenLabsProvider implements TTSProvider {
  readonly name = "ElevenLabs (stub)";

  private _state: PlaybackState = "idle";
  private readonly listeners = new Set<(s: PlaybackState) => void>();
  private cancelToken: { cancelled: boolean } | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  private readonly apiKey: string;
  private readonly voiceId: string;
  private readonly defaults: TTSVoiceOptions;
  private pendingResolve: (() => void) | null = null;

  constructor(config: ElevenLabsProviderConfig) {
    this.apiKey = config.apiKey;
    this.voiceId = config.voiceId ?? "EXAVITQu4vr4xnSDxMaL"; // "Bella" multilingual
    this.defaults = {
      ...SPANISH_TUTOR_DEFAULTS,
      voice: this.voiceId,
      ...config.defaults,
    };
  }

  // ── Public API ──────────────────────────────────────────────────────

  get state(): PlaybackState {
    return this._state;
  }

  onStateChange(listener: (state: PlaybackState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async speak(
    _text: string,
    _options?: Partial<TTSVoiceOptions>,
  ): Promise<void> {
    this.stop();

    const token = { cancelled: false };
    this.cancelToken = token;

    this.setState("loading");

    // Simulate network latency.
    await new Promise<void>((resolve) => {
      this.pendingResolve = resolve;
      this.timeoutId = setTimeout(() => {
        this.pendingResolve = null;
        resolve();
      }, 50);
    });

    if (token.cancelled) return;

    this.setState("speaking");

    // Simulate speech duration.
    await new Promise<void>((resolve) => {
      this.pendingResolve = resolve;
      this.timeoutId = setTimeout(() => {
        this.pendingResolve = null;
        resolve();
      }, 100);
    });

    if (token.cancelled) return;

    this.setState("idle");
  }

  stop(): void {
    if (this.cancelToken) {
      this.cancelToken.cancelled = true;
      this.cancelToken = null;
    }
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.pendingResolve) {
      this.pendingResolve();
      this.pendingResolve = null;
    }
    this.setState("idle");
  }

  // ── Internals ───────────────────────────────────────────────────────

  private setState(next: PlaybackState) {
    if (next === this._state) return;
    this._state = next;
    for (const fn of this.listeners) {
      fn(next);
    }
  }
}
