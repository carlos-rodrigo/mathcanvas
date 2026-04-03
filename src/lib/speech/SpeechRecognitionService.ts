/**
 * Lightweight abstraction over the Web Speech API's `SpeechRecognition`
 * interface.  Designed for capturing student voice responses in Spanish
 * (Argentina locale by default) with interim and final transcript support.
 *
 * The service exposes start / stop / cancel plus observable state so the
 * UI layer can react to permission prompts, unsupported browsers, and
 * recognition results without touching the raw browser API.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** High-level status of the recognition session. */
export type RecognitionStatus =
  | "idle"
  | "starting"
  | "listening"
  | "error"
  | "unsupported";

/** Error codes surfaced to the UI. */
export type RecognitionErrorCode =
  | "not-allowed"        // microphone permission denied
  | "no-speech"          // silence timeout
  | "network"            // network-level failure
  | "aborted"            // cancelled programmatically
  | "service-not-allowed"
  | "unknown";

export interface RecognitionResult {
  /** The most-recent interim (partial) transcript. */
  interimTranscript: string;
  /** Accumulated final (committed) transcript. */
  finalTranscript: string;
}

export type StatusListener = (status: RecognitionStatus) => void;
export type ResultListener = (result: RecognitionResult) => void;
export type ErrorListener = (code: RecognitionErrorCode, message: string) => void;

// ─── Options ──────────────────────────────────────────────────────────────────

export interface SpeechRecognitionServiceOptions {
  /** BCP-47 language tag.  Defaults to `"es-AR"`. */
  lang?: string;
  /** Return interim results while the user is still speaking. */
  interimResults?: boolean;
  /** Keep listening after each final result (continuous mode). */
  continuous?: boolean;
}

const DEFAULTS: Required<SpeechRecognitionServiceOptions> = {
  lang: "es-AR",
  interimResults: true,
  continuous: true,
};

// ─── Browser detection helper ─────────────────────────────────────────────────

/**
 * Returns the `SpeechRecognition` constructor available in the current
 * environment, or `undefined` when the API is not supported.
 *
 * Extracted as a standalone function so tests can override it via the
 * `recognitionFactory` constructor parameter.
 */
export function getGlobalSpeechRecognition():
  | (new () => SpeechRecognition)
  | undefined {
  if (typeof window === "undefined") return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SpeechRecognitionService {
  // -- internal state -------------------------------------------------------
  private _status: RecognitionStatus = "idle";
  private _recognition: SpeechRecognition | null = null;
  private readonly _options: Required<SpeechRecognitionServiceOptions>;
  private readonly _factory: (() => SpeechRecognition) | undefined;

  // -- listeners ------------------------------------------------------------
  private _statusListeners = new Set<StatusListener>();
  private _resultListeners = new Set<ResultListener>();
  private _errorListeners = new Set<ErrorListener>();

  // -- transcript accumulator -----------------------------------------------
  private _finalTranscript = "";

  constructor(
    options?: SpeechRecognitionServiceOptions,
    /**
     * Optional factory for creating `SpeechRecognition` instances.
     * Pass a lambda returning a mock in tests; leave `undefined` in
     * production to use the real browser constructor.
     */
    recognitionFactory?: () => SpeechRecognition,
  ) {
    this._options = { ...DEFAULTS, ...options };

    if (recognitionFactory) {
      this._factory = recognitionFactory;
    } else {
      const Ctor = getGlobalSpeechRecognition();
      this._factory = Ctor ? () => new Ctor() : undefined;
    }

    if (!this._factory) {
      this._setStatus("unsupported");
    }
  }

  // -- public getters -------------------------------------------------------

  get status(): RecognitionStatus {
    return this._status;
  }

  get isListening(): boolean {
    return this._status === "listening";
  }

  // -- lifecycle ------------------------------------------------------------

  /**
   * Begin a recognition session.  Resolves once the recogniser has actually
   * started (i.e. the browser has granted mic access).  Rejects when the
   * API is not supported or we are already listening.
   */
  start(): void {
    if (this._status === "unsupported") {
      this._emitError("unknown", "SpeechRecognition is not supported in this browser");
      return;
    }
    if (this._status === "listening" || this._status === "starting") {
      return; // already active – no-op
    }

    this._finalTranscript = "";
    this._setStatus("starting");

    const recognition = this._factory!();
    recognition.lang = this._options.lang;
    recognition.interimResults = this._options.interimResults;
    recognition.continuous = this._options.continuous;

    recognition.onstart = () => {
      this._setStatus("listening");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          this._finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      this._emitResult({
        finalTranscript: this._finalTranscript,
        interimTranscript: interim,
      });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = this._mapErrorCode(event.error);

      // "aborted" is expected when we call cancel() – don't surface as error
      if (code === "aborted") {
        return;
      }
      this._setStatus("error");
      this._emitError(code, event.message || event.error);
    };

    recognition.onend = () => {
      // Only transition to idle if we haven't already moved to error.
      if (this._status !== "error" && this._status !== "idle") {
        this._setStatus("idle");
      }
    };

    this._recognition = recognition;
    recognition.start();
  }

  /**
   * Gracefully stop recognition – any in-progress speech is finalised and
   * the last `onresult` fires before the session closes.
   */
  stop(): void {
    if (!this._recognition) return;
    this._recognition.stop();
    this._recognition = null;
  }

  /**
   * Immediately abort – partial results are discarded and no final result
   * event is emitted.
   */
  cancel(): void {
    if (!this._recognition) return;
    this._recognition.abort();
    this._recognition = null;
    this._setStatus("idle");
  }

  // -- subscriptions --------------------------------------------------------

  onStatusChange(listener: StatusListener): () => void {
    this._statusListeners.add(listener);
    return () => {
      this._statusListeners.delete(listener);
    };
  }

  onResult(listener: ResultListener): () => void {
    this._resultListeners.add(listener);
    return () => {
      this._resultListeners.delete(listener);
    };
  }

  onError(listener: ErrorListener): () => void {
    this._errorListeners.add(listener);
    return () => {
      this._errorListeners.delete(listener);
    };
  }

  // -- private helpers ------------------------------------------------------

  private _setStatus(next: RecognitionStatus): void {
    if (next === this._status) return;
    this._status = next;
    for (const l of this._statusListeners) l(next);
  }

  private _emitResult(result: RecognitionResult): void {
    for (const l of this._resultListeners) l(result);
  }

  private _emitError(code: RecognitionErrorCode, message: string): void {
    for (const l of this._errorListeners) l(code, message);
  }

  private _mapErrorCode(raw: string): RecognitionErrorCode {
    switch (raw) {
      case "not-allowed":
        return "not-allowed";
      case "no-speech":
        return "no-speech";
      case "network":
        return "network";
      case "aborted":
        return "aborted";
      case "service-not-allowed":
        return "service-not-allowed";
      default:
        return "unknown";
    }
  }
}
