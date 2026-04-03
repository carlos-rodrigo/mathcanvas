"use client";

import type { Exercise } from "@/lib/commands/canvasTypes";

export interface ExercisePanelProps {
  exercise: Exercise | null;
}

/**
 * Slide-up panel that displays the current exercise question,
 * accepted answer count, and an optional hint — all in Spanish.
 *
 * Renders nothing when there is no active exercise.
 */
export default function ExercisePanel({ exercise }: ExercisePanelProps) {
  if (!exercise) return null;

  return (
    <section
      aria-label="Ejercicio actual"
      className="mx-4 mb-2 animate-[slideUp_0.3s_ease-out] rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-md dark:border-indigo-800 dark:bg-indigo-950"
    >
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
        Ejercicio
      </h2>
      <p className="text-base font-medium text-slate-800 dark:text-slate-100">
        {exercise.question}
      </p>

      {exercise.hint && (
        <p className="mt-2 text-sm italic text-slate-500 dark:text-slate-400">
          💡 Pista: {exercise.hint}
        </p>
      )}

      {exercise.acceptedAnswers && exercise.acceptedAnswers.length > 0 && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Respuestas aceptadas: {exercise.acceptedAnswers.length}
        </p>
      )}
    </section>
  );
}
