"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackState, TTSProvider } from "@/lib/tts/TTSProvider";

export interface UseSpeechOutputReturn {
  /** Current playback state – the UI can use this to disable inputs. */
  playbackState: PlaybackState;
  /** `true` while the provider is loading or speaking. */
  isSpeaking: boolean;
  /** Speak the given text through the active provider. */
  speak: (text: string) => Promise<void>;
  /** Immediately stop playback and reset state. */
  stop: () => void;
}

/**
 * React hook that wraps any `TTSProvider` and exposes reactive playback
 * state plus `speak` / `stop` helpers.
 *
 * ```tsx
 * const tts = useSpeechOutput(provider);
 * // Disable the text input while the tutor is speaking:
 * <input disabled={tts.isSpeaking} />
 * <button onClick={() => tts.speak(payload.speech)}>🔊</button>
 * ```
 */
export function useSpeechOutput(
  provider: TTSProvider | null,
): UseSpeechOutputReturn {
  const [playbackState, setPlaybackState] = useState<PlaybackState>(
    () => provider?.state ?? "idle",
  );
  const providerRef = useRef(provider);

  // Keep ref in sync outside of render.
  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  // Subscribe to the provider's state changes.
  useEffect(() => {
    if (!provider) return;

    const unsub = provider.onStateChange((next) => {
      setPlaybackState(next);
    });

    return () => {
      unsub();
    };
  }, [provider]);

  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!providerRef.current) return;
      await providerRef.current.speak(text);
    },
    [],
  );

  const stop = useCallback(() => {
    providerRef.current?.stop();
  }, []);

  const isSpeaking = playbackState === "loading" || playbackState === "speaking";

  return { playbackState, isSpeaking, speak, stop };
}
