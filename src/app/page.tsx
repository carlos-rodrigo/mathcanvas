"use client";

import { useCallback, useReducer } from "react";

import WhiteboardCanvas from "@/components/canvas/WhiteboardCanvas";
import ExercisePanel from "@/components/tutor/ExercisePanel";
import TutorControls from "@/components/tutor/TutorControls";
import TutorHeader from "@/components/tutor/TutorHeader";
import type { CanvasCommand, CanvasElement } from "@/lib/commands/canvasTypes";
import {
  INITIAL_TUTOR_STATE,
  type TutorPhase,
  type TutorState,
} from "@/types/tutorState";

// ── Reducer ──────────────────────────────────────────────────────────

type Action =
  | { type: "SET_PHASE"; phase: TutorPhase }
  | { type: "APPLY_COMMANDS"; commands: CanvasCommand[]; speech: string }
  | { type: "SET_EXERCISE"; exercise: TutorState["exercise"] }
  | { type: "SET_ERROR"; message: string }
  | { type: "RESET" };

function applyCommands(
  current: CanvasElement[],
  commands: CanvasCommand[],
): CanvasElement[] {
  let next = [...current];
  for (const cmd of commands) {
    if (cmd.action === "clear") {
      next = cmd.targetId
        ? next.filter((el) => el.id !== cmd.targetId)
        : [];
    } else {
      // Replace if same id exists, otherwise append.
      const idx = next.findIndex((el) => el.id === cmd.element.id);
      if (idx >= 0) {
        next[idx] = cmd.element;
      } else {
        next.push(cmd.element);
      }
    }
  }
  return next;
}

function tutorReducer(state: TutorState, action: Action): TutorState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.phase, errorMessage: null };
    case "APPLY_COMMANDS":
      return {
        ...state,
        phase: "presenting",
        canvasElements: applyCommands(
          state.canvasElements,
          action.commands,
        ),
        speechText: action.speech,
        errorMessage: null,
      };
    case "SET_EXERCISE":
      return { ...state, exercise: action.exercise };
    case "SET_ERROR":
      return { ...state, phase: "error", errorMessage: action.message };
    case "RESET":
      return INITIAL_TUTOR_STATE;
    default:
      return state;
  }
}

// ── Demo payload used during the greeting phase ──────────────────────

const GREETING_SPEECH =
  "¡Hola! Soy tu tutor de matemáticas. Presiona el botón del micrófono para empezar.";

const GREETING_COMMANDS: CanvasCommand[] = [
  {
    action: "draw",
    element: {
      type: "TextBubble",
      id: "greeting-bubble",
      position: { x: 200, y: 220 },
      text: "¡Bienvenido a MathCanvas!",
      fontSize: 22,
      backgroundColor: "#e0e7ff",
      textColor: "#3730a3",
      maxWidth: 380,
    },
  },
  {
    action: "draw",
    element: {
      type: "FractionDisplay",
      id: "greeting-fraction",
      position: { x: 650, y: 230 },
      numerator: 1,
      denominator: 2,
      fontSize: 36,
      color: "#6366f1",
      label: "ejemplo",
    },
  },
];

// ── Page component ───────────────────────────────────────────────────

export default function Home() {
  const [state, dispatch] = useReducer(tutorReducer, INITIAL_TUTOR_STATE);

  // Simulate the greeting on first mount-like click or auto-trigger.
  // In a real integration this calls the orchestrator API.
  const ensureGreeted = useCallback(() => {
    if (state.phase === "greeting") {
      dispatch({
        type: "APPLY_COMMANDS",
        commands: GREETING_COMMANDS,
        speech: GREETING_SPEECH,
      });
    }
  }, [state.phase]);

  // ── Voice control handlers ───────────────────────────────────────

  const handleRecord = useCallback(() => {
    ensureGreeted();
    if (state.phase === "idle" || state.phase === "presenting") {
      dispatch({ type: "SET_PHASE", phase: "recording" });
      // Real implementation: start mic recording via Web Audio / MediaRecorder.
    }
  }, [state.phase, ensureGreeted]);

  const handleStop = useCallback(() => {
    if (state.phase === "recording") {
      dispatch({ type: "SET_PHASE", phase: "processing" });
      // Simulate assistant response after a short delay.
      setTimeout(() => {
        dispatch({ type: "SET_PHASE", phase: "idle" });
      }, 1500);
    }
  }, [state.phase]);

  const handleReplay = useCallback(() => {
    // In a real app: re-trigger TTS with state.speechText.
    // For now this is a no-op placeholder.
  }, []);

  // Auto-greet on first render via a one-shot effect substitute:
  // We trigger greeting commands when phase is still "greeting".
  if (state.phase === "greeting") {
    // Schedule outside of render to avoid dispatch during render.
    queueMicrotask(() => {
      dispatch({
        type: "APPLY_COMMANDS",
        commands: GREETING_COMMANDS,
        speech: GREETING_SPEECH,
      });
    });
  }

  // ── isSpeaking placeholder (no TTS provider wired yet) ───────────
  const isSpeaking = state.phase === "presenting";

  return (
    <div className="flex h-full min-h-screen flex-col bg-slate-50 font-sans dark:bg-slate-950">
      {/* ── Header / Status bar ──────────────────────────── */}
      <TutorHeader phase={state.phase} speechText={state.speechText} />

      {/* ── Whiteboard (fills remaining space) ───────────── */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {/* Processing overlay */}
        {state.phase === "processing" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm dark:bg-slate-950/60">
            <div className="flex flex-col items-center gap-3">
              <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Procesando tu respuesta…
              </p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {state.phase === "error" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm dark:bg-slate-950/60">
            <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-red-200 bg-white p-6 text-center shadow-lg dark:border-red-800 dark:bg-slate-900">
              <span className="text-3xl">⚠️</span>
              <p className="text-sm text-red-600 dark:text-red-400">
                {state.errorMessage ?? "Ocurrió un error inesperado."}
              </p>
              <button
                type="button"
                onClick={() => dispatch({ type: "RESET" })}
                className="mt-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="h-full w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <WhiteboardCanvas elements={state.canvasElements} />
        </div>
      </main>

      {/* ── Exercise panel (overlays bottom of canvas area) ── */}
      <ExercisePanel exercise={state.exercise} />

      {/* ── Voice controls ───────────────────────────────── */}
      <TutorControls
        phase={state.phase}
        isSpeaking={isSpeaking}
        onRecord={handleRecord}
        onStop={handleStop}
        onReplay={handleReplay}
      />
    </div>
  );
}
