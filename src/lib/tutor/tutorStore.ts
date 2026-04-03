/**
 * Lightweight reactive store for tutor interaction state.
 *
 * Holds the current {@link TutorState} and notifies subscribers on every
 * mutation.  No persistence — call {@link TutorStore.reset reset()} to
 * return to the initial state.
 */

import type { TutorState, TutorPhase } from "@/types/tutorState";
import { INITIAL_TUTOR_STATE } from "@/types/tutorState";
import type { CanvasElement, Exercise } from "@/lib/commands/canvasTypes";

export type TutorStoreListener = (state: TutorState) => void;

export class TutorStore {
  private _state: TutorState;
  private readonly _listeners = new Set<TutorStoreListener>();

  constructor(initial?: Partial<TutorState>) {
    this._state = { ...INITIAL_TUTOR_STATE, ...initial };
  }

  // ── Read ────────────────────────────────────────────────────────────

  get state(): TutorState {
    return this._state;
  }

  // ── Subscribe ───────────────────────────────────────────────────────

  subscribe(listener: TutorStoreListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  // ── Mutations ───────────────────────────────────────────────────────

  setPhase(phase: TutorPhase): void {
    this._update({ phase });
  }

  setSpeechText(speechText: string): void {
    this._update({ speechText });
  }

  setCanvasElements(canvasElements: CanvasElement[]): void {
    this._update({ canvasElements });
  }

  setExercise(exercise: Exercise | null): void {
    this._update({ exercise });
  }

  setError(errorMessage: string): void {
    this._update({ phase: "error", errorMessage });
  }

  clearError(): void {
    this._update({ errorMessage: null });
  }

  /**
   * Return the store to its pristine initial state.
   * Notifies all subscribers.
   */
  reset(): void {
    this._state = { ...INITIAL_TUTOR_STATE };
    this._notify();
  }

  // ── Internals ───────────────────────────────────────────────────────

  private _update(partial: Partial<TutorState>): void {
    this._state = { ...this._state, ...partial };
    this._notify();
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener(this._state);
    }
  }
}
