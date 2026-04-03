"use client";

import type { TutorPhase } from "@/types/tutorState";

/** Spanish status labels for each tutor phase. */
const PHASE_LABELS: Record<TutorPhase, string> = {
  greeting: "👋 ¡Hola! Preparando tu clase…",
  idle: "🎤 Presiona el botón para hablar",
  recording: "🔴 Escuchando…",
  processing: "⏳ Pensando…",
  presenting: "📝 Observa la pizarra",
  error: "⚠️ Ocurrió un error",
};

/** Phase → tailwind text-color class. */
const PHASE_COLOR: Record<TutorPhase, string> = {
  greeting: "text-indigo-600 dark:text-indigo-400",
  idle: "text-slate-600 dark:text-slate-300",
  recording: "text-red-600 dark:text-red-400",
  processing: "text-amber-600 dark:text-amber-400",
  presenting: "text-emerald-600 dark:text-emerald-400",
  error: "text-red-600 dark:text-red-400",
};

export interface TutorHeaderProps {
  phase: TutorPhase;
  /** Optional override text (e.g. the tutor's current speech). */
  speechText?: string;
}

export default function TutorHeader({ phase, speechText }: TutorHeaderProps) {
  const showSpeech = phase === "presenting" && speechText;

  return (
    <header className="flex w-full shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-center gap-3">
        {/* Animated phase indicator dot */}
        <span
          aria-hidden
          className={`inline-block h-3 w-3 rounded-full ${
            phase === "recording"
              ? "animate-pulse bg-red-500"
              : phase === "processing"
                ? "animate-pulse bg-amber-500"
                : "bg-indigo-500"
          }`}
        />
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          MathCanvas Tutor
        </h1>
      </div>

      <p className={`text-sm font-medium ${PHASE_COLOR[phase]}`} role="status" aria-live="polite">
        {showSpeech ? speechText : PHASE_LABELS[phase]}
      </p>
    </header>
  );
}
