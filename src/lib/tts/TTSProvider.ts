/**
 * Playback state exposed to the UI so it can, for example,
 * disable the input field while the tutor is speaking.
 */
export type PlaybackState = "idle" | "loading" | "speaking" | "error";

/**
 * Voice configuration defaults suited for a Spanish classroom tutor.
 */
export interface TTSVoiceOptions {
  /** Provider-specific voice identifier. */
  voice: string;
  /** Playback speed multiplier (1.0 = normal). A value slightly below 1
   *  gives learners more time to parse spoken Spanish. */
  speed: number;
  /** BCP-47 language hint – providers that support it will use this. */
  language: string;
}

/**
 * Sensible classroom defaults: clear female voice, slightly slower pace,
 * Spanish language hint.
 */
export const SPANISH_TUTOR_DEFAULTS: Readonly<TTSVoiceOptions> = {
  voice: "nova",
  speed: 0.92,
  language: "es",
} as const;

/**
 * Common interface every TTS back-end must implement.
 *
 * Usage:
 * ```ts
 * const provider: TTSProvider = new OpenAITTSProvider({ apiKey });
 * const unsub = provider.onStateChange(s => console.log(s));
 * await provider.speak("Hola, ¿cómo estás?");
 * provider.stop();
 * unsub();
 * ```
 */
export interface TTSProvider {
  /** Human-readable name shown in UI pickers. */
  readonly name: string;

  /** Current playback state. */
  readonly state: PlaybackState;

  /**
   * Subscribe to playback-state transitions.
   * Returns an unsubscribe function.
   */
  onStateChange(listener: (state: PlaybackState) => void): () => void;

  /**
   * Synthesise and play `text`.
   * Resolves when playback finishes or is stopped.
   * Rejects on unrecoverable errors (network, auth, …).
   */
  speak(text: string, options?: Partial<TTSVoiceOptions>): Promise<void>;

  /**
   * Immediately stop any in-progress playback and reset state to `"idle"`.
   */
  stop(): void;
}
