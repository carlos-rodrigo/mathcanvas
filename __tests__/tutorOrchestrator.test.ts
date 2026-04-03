import { describe, it, expect } from "vitest";
import {
  INITIAL_TUTOR_STATE,
  type TutorPhase,
  type TutorState,
} from "@/types/tutorState";
import { applyCanvasCommands } from "@/components/canvas/types";
import type {
  CanvasCommand,
  PieChart,
  TextBubble,
  FractionDisplay,
} from "@/lib/commands/canvasTypes";

// ── Reducer replica ──────────────────────────────────────────────────
// The page.tsx reducer is co-located in a "use client" module.
// We replicate its logic here to test transition states in isolation
// without importing React client components into a pure-node test.

type Action =
  | { type: "SET_PHASE"; phase: TutorPhase }
  | { type: "APPLY_COMMANDS"; commands: CanvasCommand[]; speech: string }
  | { type: "SET_EXERCISE"; exercise: TutorState["exercise"] }
  | { type: "SET_ERROR"; message: string }
  | { type: "RESET" };

function tutorReducer(state: TutorState, action: Action): TutorState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.phase, errorMessage: null };
    case "APPLY_COMMANDS":
      return {
        ...state,
        phase: "presenting",
        canvasElements: applyCanvasCommands(state.canvasElements, action.commands),
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

// ── Fixtures ─────────────────────────────────────────────────────────

const pieFix: PieChart = {
  type: "PieChart",
  id: "pie-1",
  position: { x: 200, y: 200 },
  radius: 60,
  totalSlices: 4,
  filledSlices: 1,
};

const bubbleFix: TextBubble = {
  type: "TextBubble",
  id: "tb-1",
  position: { x: 100, y: 100 },
  text: "¡Hola!",
};

const fractionFix: FractionDisplay = {
  type: "FractionDisplay",
  id: "fd-1",
  position: { x: 400, y: 250 },
  numerator: 3,
  denominator: 4,
};

// ── Initial state ────────────────────────────────────────────────────

describe("tutorOrchestrator – initial state", () => {
  it("starts in greeting phase", () => {
    expect(INITIAL_TUTOR_STATE.phase).toBe("greeting");
  });

  it("starts with an empty canvas", () => {
    expect(INITIAL_TUTOR_STATE.canvasElements).toHaveLength(0);
  });

  it("has no speech text", () => {
    expect(INITIAL_TUTOR_STATE.speechText).toBe("");
  });

  it("has no exercise", () => {
    expect(INITIAL_TUTOR_STATE.exercise).toBeNull();
  });

  it("has no error", () => {
    expect(INITIAL_TUTOR_STATE.errorMessage).toBeNull();
  });
});

// ── Phase transitions ────────────────────────────────────────────────

describe("tutorOrchestrator – phase transitions", () => {
  it("greeting → presenting when APPLY_COMMANDS dispatched", () => {
    const state = tutorReducer(INITIAL_TUTOR_STATE, {
      type: "APPLY_COMMANDS",
      commands: [{ action: "draw", element: bubbleFix }],
      speech: "¡Bienvenido!",
    });
    expect(state.phase).toBe("presenting");
    expect(state.speechText).toBe("¡Bienvenido!");
    expect(state.canvasElements).toHaveLength(1);
  });

  it("idle → recording via SET_PHASE", () => {
    const idle: TutorState = { ...INITIAL_TUTOR_STATE, phase: "idle" };
    const state = tutorReducer(idle, {
      type: "SET_PHASE",
      phase: "recording",
    });
    expect(state.phase).toBe("recording");
  });

  it("recording → processing via SET_PHASE", () => {
    const recording: TutorState = { ...INITIAL_TUTOR_STATE, phase: "recording" };
    const state = tutorReducer(recording, {
      type: "SET_PHASE",
      phase: "processing",
    });
    expect(state.phase).toBe("processing");
  });

  it("processing → presenting via APPLY_COMMANDS", () => {
    const processing: TutorState = { ...INITIAL_TUTOR_STATE, phase: "processing" };
    const state = tutorReducer(processing, {
      type: "APPLY_COMMANDS",
      commands: [{ action: "draw", element: pieFix }],
      speech: "Aquí tienes una fracción.",
    });
    expect(state.phase).toBe("presenting");
    expect(state.canvasElements).toHaveLength(1);
  });

  it("presenting → idle via SET_PHASE (after TTS finishes)", () => {
    const presenting: TutorState = {
      ...INITIAL_TUTOR_STATE,
      phase: "presenting",
      canvasElements: [pieFix],
      speechText: "done",
    };
    const state = tutorReducer(presenting, {
      type: "SET_PHASE",
      phase: "idle",
    });
    expect(state.phase).toBe("idle");
    // Canvas elements and speech survive the transition
    expect(state.canvasElements).toHaveLength(1);
    expect(state.speechText).toBe("done");
  });

  it("any phase → error via SET_ERROR", () => {
    const phases: TutorPhase[] = [
      "greeting",
      "idle",
      "recording",
      "processing",
      "presenting",
    ];
    for (const phase of phases) {
      const state = tutorReducer(
        { ...INITIAL_TUTOR_STATE, phase },
        { type: "SET_ERROR", message: "Network failed" },
      );
      expect(state.phase).toBe("error");
      expect(state.errorMessage).toBe("Network failed");
    }
  });

  it("error → greeting via RESET", () => {
    const errorState: TutorState = {
      ...INITIAL_TUTOR_STATE,
      phase: "error",
      errorMessage: "Something broke",
      canvasElements: [pieFix],
      speechText: "old speech",
    };
    const state = tutorReducer(errorState, { type: "RESET" });
    expect(state).toEqual(INITIAL_TUTOR_STATE);
  });

  it("SET_PHASE clears errorMessage", () => {
    const withError: TutorState = {
      ...INITIAL_TUTOR_STATE,
      phase: "error",
      errorMessage: "oops",
    };
    const state = tutorReducer(withError, {
      type: "SET_PHASE",
      phase: "idle",
    });
    expect(state.errorMessage).toBeNull();
  });

  it("APPLY_COMMANDS clears errorMessage", () => {
    const withError: TutorState = {
      ...INITIAL_TUTOR_STATE,
      phase: "error",
      errorMessage: "oops",
    };
    const state = tutorReducer(withError, {
      type: "APPLY_COMMANDS",
      commands: [],
      speech: "recover",
    });
    expect(state.errorMessage).toBeNull();
    expect(state.phase).toBe("presenting");
  });
});

// ── Canvas element accumulation ──────────────────────────────────────

describe("tutorOrchestrator – canvas element management", () => {
  it("accumulates elements across multiple APPLY_COMMANDS", () => {
    let state = INITIAL_TUTOR_STATE;
    state = tutorReducer(state, {
      type: "APPLY_COMMANDS",
      commands: [{ action: "draw", element: pieFix }],
      speech: "Primero",
    });
    state = tutorReducer(state, {
      type: "APPLY_COMMANDS",
      commands: [{ action: "draw", element: bubbleFix }],
      speech: "Segundo",
    });
    expect(state.canvasElements).toHaveLength(2);
    expect(state.canvasElements.map((e) => e.id)).toEqual(["pie-1", "tb-1"]);
    expect(state.speechText).toBe("Segundo");
  });

  it("replaces an element with the same id", () => {
    let state = tutorReducer(INITIAL_TUTOR_STATE, {
      type: "APPLY_COMMANDS",
      commands: [{ action: "draw", element: pieFix }],
      speech: "Original",
    });
    const updated: PieChart = { ...pieFix, filledSlices: 3 };
    state = tutorReducer(state, {
      type: "APPLY_COMMANDS",
      commands: [{ action: "draw", element: updated }],
      speech: "Actualizado",
    });
    expect(state.canvasElements).toHaveLength(1);
    expect((state.canvasElements[0] as PieChart).filledSlices).toBe(3);
  });

  it("removes a specific element with clear + targetId", () => {
    let state = tutorReducer(INITIAL_TUTOR_STATE, {
      type: "APPLY_COMMANDS",
      commands: [
        { action: "draw", element: pieFix },
        { action: "draw", element: bubbleFix },
      ],
      speech: "Dos elementos",
    });
    expect(state.canvasElements).toHaveLength(2);

    state = tutorReducer(state, {
      type: "APPLY_COMMANDS",
      commands: [{ action: "clear", targetId: "pie-1" }],
      speech: "Solo queda el texto",
    });
    expect(state.canvasElements).toHaveLength(1);
    expect(state.canvasElements[0].id).toBe("tb-1");
  });

  it("clears all elements with clear (no targetId)", () => {
    let state = tutorReducer(INITIAL_TUTOR_STATE, {
      type: "APPLY_COMMANDS",
      commands: [
        { action: "draw", element: pieFix },
        { action: "draw", element: bubbleFix },
      ],
      speech: "Full canvas",
    });
    state = tutorReducer(state, {
      type: "APPLY_COMMANDS",
      commands: [{ action: "clear" }],
      speech: "Borrado",
    });
    expect(state.canvasElements).toHaveLength(0);
  });

  it("processes mixed draw+clear in a single command batch", () => {
    const state = tutorReducer(INITIAL_TUTOR_STATE, {
      type: "APPLY_COMMANDS",
      commands: [
        { action: "draw", element: pieFix },
        { action: "draw", element: fractionFix },
        { action: "clear", targetId: "pie-1" },
        { action: "draw", element: bubbleFix },
      ],
      speech: "Mixed batch",
    });
    expect(state.canvasElements).toHaveLength(2);
    expect(state.canvasElements.map((e) => e.id)).toEqual(["fd-1", "tb-1"]);
  });
});

// ── Exercise management ──────────────────────────────────────────────

describe("tutorOrchestrator – exercise management", () => {
  it("SET_EXERCISE stores the exercise", () => {
    const state = tutorReducer(INITIAL_TUTOR_STATE, {
      type: "SET_EXERCISE",
      exercise: {
        question: "¿Cuánto es 1/2 + 1/4?",
        acceptedAnswers: ["3/4"],
        hint: "Piensa en partes",
      },
    });
    expect(state.exercise).not.toBeNull();
    expect(state.exercise?.question).toBe("¿Cuánto es 1/2 + 1/4?");
  });

  it("SET_EXERCISE with null clears the exercise", () => {
    let state = tutorReducer(INITIAL_TUTOR_STATE, {
      type: "SET_EXERCISE",
      exercise: { question: "test" },
    });
    state = tutorReducer(state, {
      type: "SET_EXERCISE",
      exercise: null,
    });
    expect(state.exercise).toBeNull();
  });

  it("exercise persists across phase changes", () => {
    let state = tutorReducer(INITIAL_TUTOR_STATE, {
      type: "SET_EXERCISE",
      exercise: { question: "persist?" },
    });
    state = tutorReducer(state, { type: "SET_PHASE", phase: "idle" });
    state = tutorReducer(state, { type: "SET_PHASE", phase: "recording" });
    expect(state.exercise?.question).toBe("persist?");
  });

  it("RESET clears the exercise", () => {
    let state = tutorReducer(INITIAL_TUTOR_STATE, {
      type: "SET_EXERCISE",
      exercise: { question: "will be reset" },
    });
    state = tutorReducer(state, { type: "RESET" });
    expect(state.exercise).toBeNull();
  });
});

// ── Full interaction cycle ───────────────────────────────────────────

describe("tutorOrchestrator – full cycle simulation", () => {
  it("simulates greeting → record → process → present → idle", () => {
    let state = INITIAL_TUTOR_STATE;

    // 1. Greeting arrives
    state = tutorReducer(state, {
      type: "APPLY_COMMANDS",
      commands: [{ action: "draw", element: bubbleFix }],
      speech: "¡Hola! Soy tu tutor.",
    });
    expect(state.phase).toBe("presenting");

    // 2. User presses record
    state = tutorReducer(state, { type: "SET_PHASE", phase: "idle" });
    state = tutorReducer(state, { type: "SET_PHASE", phase: "recording" });
    expect(state.phase).toBe("recording");

    // 3. Recording stops → processing
    state = tutorReducer(state, { type: "SET_PHASE", phase: "processing" });
    expect(state.phase).toBe("processing");

    // 4. AI response arrives
    state = tutorReducer(state, {
      type: "APPLY_COMMANDS",
      commands: [
        { action: "clear" },
        { action: "draw", element: pieFix },
        { action: "draw", element: fractionFix },
      ],
      speech: "Veamos la fracción 3/4.",
    });
    expect(state.phase).toBe("presenting");
    expect(state.canvasElements).toHaveLength(2);
    expect(state.speechText).toContain("3/4");

    // 5. Set exercise
    state = tutorReducer(state, {
      type: "SET_EXERCISE",
      exercise: {
        question: "¿Cuánto es 3/4?",
        acceptedAnswers: ["3/4", "0.75"],
      },
    });
    expect(state.exercise).not.toBeNull();

    // 6. Back to idle after TTS
    state = tutorReducer(state, { type: "SET_PHASE", phase: "idle" });
    expect(state.phase).toBe("idle");
    expect(state.canvasElements).toHaveLength(2); // preserved
    expect(state.exercise).not.toBeNull(); // preserved
  });

  it("simulates error recovery cycle", () => {
    let state: TutorState = {
      ...INITIAL_TUTOR_STATE,
      phase: "processing",
    };

    // Error occurs
    state = tutorReducer(state, {
      type: "SET_ERROR",
      message: "API timeout",
    });
    expect(state.phase).toBe("error");
    expect(state.errorMessage).toBe("API timeout");

    // User resets
    state = tutorReducer(state, { type: "RESET" });
    expect(state.phase).toBe("greeting");
    expect(state.errorMessage).toBeNull();
    expect(state.canvasElements).toHaveLength(0);
  });
});

// ── Immutability ─────────────────────────────────────────────────────

describe("tutorOrchestrator – immutability", () => {
  it("does not mutate the previous state", () => {
    const original = { ...INITIAL_TUTOR_STATE };
    const next = tutorReducer(original, {
      type: "APPLY_COMMANDS",
      commands: [{ action: "draw", element: pieFix }],
      speech: "New",
    });
    expect(original.canvasElements).toHaveLength(0);
    expect(next.canvasElements).toHaveLength(1);
    expect(original.phase).toBe("greeting");
    expect(next.phase).toBe("presenting");
  });

  it("reducer returns same shape for unknown actions", () => {
    const state = tutorReducer(INITIAL_TUTOR_STATE, {
      type: "UNKNOWN" as never,
    } as never);
    expect(state).toEqual(INITIAL_TUTOR_STATE);
  });
});
