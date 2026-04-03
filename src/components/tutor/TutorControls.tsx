"use client";

import type { TutorPhase } from "@/types/tutorState";

export interface TutorControlsProps {
  phase: TutorPhase;
  isSpeaking: boolean;
  onRecord: () => void;
  onStop: () => void;
  onReplay: () => void;
}

/**
 * Voice-first control bar.
 *
 * - **Record** (big mic button) — starts voice capture.
 * - **Stop** — ends recording or stops TTS playback.
 * - **Replay** — re-plays the last tutor speech.
 *
 * No text input is exposed; the interaction is voice-only.
 */
export default function TutorControls({
  phase,
  isSpeaking,
  onRecord,
  onStop,
  onReplay,
}: TutorControlsProps) {
  const canRecord = phase === "idle" || phase === "presenting";
  const canStop = phase === "recording" || isSpeaking;
  const canReplay = phase === "idle" || phase === "presenting";

  return (
    <nav
      aria-label="Controles de voz"
      className="flex shrink-0 items-center justify-center gap-6 border-t border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80"
    >
      {/* ── Record button ──────────────────────────────────── */}
      <button
        type="button"
        aria-label="Grabar mensaje de voz"
        disabled={!canRecord}
        onClick={onRecord}
        className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition-all
          ${
            canRecord
              ? "bg-red-500 text-white hover:bg-red-600 active:scale-95"
              : "cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-700 dark:text-slate-500"
          }
          ${phase === "recording" ? "animate-pulse ring-4 ring-red-300 dark:ring-red-700" : ""}
        `}
      >
        🎤
      </button>

      {/* ── Stop button ────────────────────────────────────── */}
      <button
        type="button"
        aria-label="Detener"
        disabled={!canStop}
        onClick={onStop}
        className={`flex h-12 w-12 items-center justify-center rounded-full text-xl shadow transition-all
          ${
            canStop
              ? "bg-slate-700 text-white hover:bg-slate-800 active:scale-95 dark:bg-slate-200 dark:text-slate-900"
              : "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
          }
        `}
      >
        ⏹
      </button>

      {/* ── Replay button ──────────────────────────────────── */}
      <button
        type="button"
        aria-label="Repetir explicación"
        disabled={!canReplay}
        onClick={onReplay}
        className={`flex h-12 w-12 items-center justify-center rounded-full text-xl shadow transition-all
          ${
            canReplay
              ? "bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95"
              : "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
          }
        `}
      >
        🔁
      </button>
    </nav>
  );
}
