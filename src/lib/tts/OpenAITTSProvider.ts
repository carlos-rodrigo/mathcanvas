import {
  type PlaybackState,
  type TTSProvider,
  type TTSVoiceOptions,
  SPANISH_TUTOR_DEFAULTS,
} from "./TTSProvider";

export interface OpenAITTSProviderConfig {
  apiKey: string;
  /** OpenAI TTS model – defaults to "tts-1". */
  model?: string;
  /** Base URL override (useful for proxies / self-hosted). */
  baseUrl?: string;
  /** Default voice options merged with SPANISH_TUTOR_DEFAULTS. */
  defaults?: Partial<TTSVoiceOptions>;
}

/**
 * TTS provider backed by the OpenAI `/v1/audio/speech` endpoint.
 *
 * Audio is fetched as an mp3 blob and played through the Web Audio API
 * (falls back to `<audio>` element where `AudioContext` is unavailable).
 */
export class OpenAITTSProvider implements TTSProvider {
  readonly name = "OpenAI TTS";

  private _state: PlaybackState = "idle";
  private readonly listeners = new Set<(s: PlaybackState) => void>();
  private abortController: AbortController | null = null;
  private audioElement: HTMLAudioElement | null = null;

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly defaults: TTSVoiceOptions;

  constructor(config: OpenAITTSProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? "tts-1";
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    this.defaults = { ...SPANISH_TUTOR_DEFAULTS, ...config.defaults };
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
    text: string,
    options?: Partial<TTSVoiceOptions>,
  ): Promise<void> {
    // Stop any in-progress playback first.
    this.stop();

    const merged: TTSVoiceOptions = { ...this.defaults, ...options };
    const abortController = new AbortController();
    this.abortController = abortController;

    this.setState("loading");

    let blob: Blob;
    try {
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          voice: merged.voice,
          speed: merged.speed,
          response_format: "mp3",
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `OpenAI TTS request failed (${response.status}): ${body}`,
        );
      }

      blob = await response.blob();
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        // stop() was called – state already set to idle.
        return;
      }
      this.setState("error");
      throw err;
    }

    // If stop() was called while we were awaiting the response body:
    if (abortController.signal.aborted) return;

    // Play the audio.
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    this.audioElement = audio;

    return new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        this.cleanup(url);
        this.setState("idle");
        resolve();
      };

      audio.onerror = () => {
        this.cleanup(url);
        this.setState("error");
        reject(new Error("Audio playback failed"));
      };

      // Guard against stop() racing with play().
      if (abortController.signal.aborted) {
        this.cleanup(url);
        resolve();
        return;
      }

      this.setState("speaking");
      audio.play().catch((playErr) => {
        this.cleanup(url);
        this.setState("error");
        reject(playErr);
      });
    });
  }

  stop(): void {
    this.abortController?.abort();
    this.abortController = null;

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.onended = null;
      this.audioElement.onerror = null;
      this.audioElement = null;
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

  private cleanup(objectUrl: string) {
    URL.revokeObjectURL(objectUrl);
    this.audioElement = null;
  }
}
