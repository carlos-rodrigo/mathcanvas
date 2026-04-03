"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SpeechRecognitionService,
  type RecognitionErrorCode,
  type RecognitionResult,
  type RecognitionStatus,
  type SpeechRecognitionServiceOptions,
} from "@/lib/speech/SpeechRecognitionService";

// ─── Public return type ───────────────────────────────────────────────────────

export interface UseSpeechInputReturn {
  /** Current high-level status of the recognition session. */
  status: RecognitionStatus;
  /** `true` while the recogniser is actively processing audio. */
  isListening: boolean;
  /** Most-recent interim (partial) transcript – resets on each new phrase. */
  interimTranscript: string;
  /** Accumulated final transcript for the current session. */
  finalTranscript: string;
  /** Last error code, or `null` when there is no error. */
  errorCode: RecognitionErrorCode | null;
  /** Begin listening. */
  start: () => void;
  /** Gracefully stop – pending speech is finalised. */
  stop: () => void;
  /** Immediately abort – partial results are discarded. */
  cancel: () => void;
}

/**
 * React hook that wraps `SpeechRecognitionService` and exposes reactive
 * transcript + status state for the UI.
 *
 * ```tsx
 * const speech = useSpeechInput();
 * <button onClick={speech.isListening ? speech.stop : speech.start}>
 *   {speech.isListening ? "🔴 Stop" : "🎤 Speak"}
 * </button>
 * <p>{speech.interimTranscript || speech.finalTranscript}</p>
 * ```
 */
export function useSpeechInput(
  options?: SpeechRecognitionServiceOptions,
  /** Pass a custom service instance (useful for testing). */
  serviceOverride?: SpeechRecognitionService,
): UseSpeechInputReturn {
  // We keep the service in a ref so it survives re-renders but never
  // triggers them.  A new service is only built when `serviceOverride`
  // changes (which in production is never).
  const serviceRef = useRef<SpeechRecognitionService | null>(null);

  if (serviceOverride) {
    serviceRef.current = serviceOverride;
  } else if (!serviceRef.current) {
    serviceRef.current = new SpeechRecognitionService(options);
  }

  const service = serviceRef.current;

  // ── Reactive state ──────────────────────────────────────────────────────
  const [status, setStatus] = useState<RecognitionStatus>(service.status);
  const [interimTranscript, setInterim] = useState("");
  const [finalTranscript, setFinal] = useState("");
  const [errorCode, setErrorCode] = useState<RecognitionErrorCode | null>(null);

  // ── Subscribe to service events ─────────────────────────────────────────
  useEffect(() => {
    const unsubStatus = service.onStatusChange((s) => {
      setStatus(s);
      // Clear error when transitioning away from error state
      if (s !== "error") {
        setErrorCode(null);
      }
    });

    const unsubResult = service.onResult((result: RecognitionResult) => {
      setInterim(result.interimTranscript);
      setFinal(result.finalTranscript);
    });

    const unsubError = service.onError((code) => {
      setErrorCode(code);
    });

    return () => {
      unsubStatus();
      unsubResult();
      unsubError();
    };
  }, [service]);

  // ── Stable action callbacks ─────────────────────────────────────────────
  const start = useCallback(() => {
    setInterim("");
    setFinal("");
    setErrorCode(null);
    service.start();
  }, [service]);

  const stop = useCallback(() => {
    service.stop();
  }, [service]);

  const cancel = useCallback(() => {
    service.cancel();
    setInterim("");
  }, [service]);

  // ── Clean up on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      service.cancel();
    };
  }, [service]);

  return {
    status,
    isListening: status === "listening",
    interimTranscript,
    finalTranscript,
    errorCode,
    start,
    stop,
    cancel,
  };
}
