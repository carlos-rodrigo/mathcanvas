import type { CanvasElement, Exercise } from "@/lib/commands/canvasTypes";

/**
 * Phases of the tutor interaction loop.
 *
 * - `greeting`   – initial welcome, tutor speaks first.
 * - `idle`       – waiting for the learner to press record.
 * - `recording`  – microphone is active, learner is speaking.
 * - `processing` – learner input sent, waiting for assistant response.
 * - `presenting` – assistant payload arrived, rendering canvas + TTS.
 * - `error`      – something went wrong; show message & allow retry.
 */
export type TutorPhase =
  | "greeting"
  | "idle"
  | "recording"
  | "processing"
  | "presenting"
  | "error";

/** Top-level state for the tutor orchestration page. */
export interface TutorState {
  phase: TutorPhase;
  /** Elements currently visible on the whiteboard. */
  canvasElements: CanvasElement[];
  /** The last speech text spoken/displayed by the tutor. */
  speechText: string;
  /** Active exercise the learner should answer (if any). */
  exercise: Exercise | null;
  /** Human-readable error message when phase === "error". */
  errorMessage: string | null;
}

export const INITIAL_TUTOR_STATE: TutorState = {
  phase: "greeting",
  canvasElements: [],
  speechText: "",
  exercise: null,
  errorMessage: null,
};
