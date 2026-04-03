import { describe, it, expect } from "vitest";
import {
  validateCanvasElement,
  validateCanvasCommand,
  validateExercise,
  parseAssistantPayload,
} from "@/lib/commands/validateCommandPayload";

// ── Fixtures ─────────────────────────────────────────────────────────

const validPieChart = {
  type: "PieChart",
  id: "pie-1",
  position: { x: 100, y: 100 },
  radius: 50,
  totalSlices: 4,
  filledSlices: 2,
};

const validFractionBar = {
  type: "FractionBar",
  id: "bar-1",
  position: { x: 50, y: 50 },
  width: 200,
  height: 30,
  totalSegments: 5,
  filledSegments: 3,
};

const validNumberLine = {
  type: "NumberLine",
  id: "nl-1",
  position: { x: 10, y: 300 },
  length: 400,
  min: 0,
  max: 10,
  step: 1,
};

const validFractionDisplay = {
  type: "FractionDisplay",
  id: "fd-1",
  position: { x: 200, y: 200 },
  numerator: 3,
  denominator: 4,
};

const validOperation = {
  type: "Operation",
  id: "op-1",
  position: { x: 300, y: 250 },
  operator: "+",
};

const validStepByStep = {
  type: "StepByStep",
  id: "sbs-1",
  position: { x: 50, y: 50 },
  steps: [
    { index: 1, text: "Paso uno" },
    { index: 2, text: "Paso dos" },
  ],
};

const validTextBubble = {
  type: "TextBubble",
  id: "tb-1",
  position: { x: 100, y: 100 },
  text: "¡Hola!",
};

const validArrow = {
  type: "Arrow",
  id: "arr-1",
  from: { x: 50, y: 50 },
  to: { x: 200, y: 200 },
};

const validHighlight = {
  type: "Highlight",
  id: "hl-1",
  targetId: "pie-1",
};

const ALL_VALID_ELEMENTS = [
  validPieChart,
  validFractionBar,
  validNumberLine,
  validFractionDisplay,
  validOperation,
  validStepByStep,
  validTextBubble,
  validArrow,
  validHighlight,
];

// ── validateCanvasElement ────────────────────────────────────────────

describe("validateCanvasElement", () => {
  it.each(ALL_VALID_ELEMENTS)(
    "accepts a valid $type element",
    (element) => {
      const result = validateCanvasElement(element);
      expect(result.ok).toBe(true);
    },
  );

  it("rejects a non-object value", () => {
    const result = validateCanvasElement("not-an-object");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("must be an object");
  });

  it("rejects an element with missing id", () => {
    const result = validateCanvasElement({ type: "PieChart" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("id");
  });

  it("rejects an element with invalid type", () => {
    const result = validateCanvasElement({
      type: "UnknownWidget",
      id: "x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("type");
  });

  it("rejects a PieChart with missing position", () => {
    const result = validateCanvasElement({
      type: "PieChart",
      id: "p1",
      radius: 50,
      totalSlices: 4,
      filledSlices: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("position");
  });

  it("rejects a PieChart with non-numeric radius", () => {
    const result = validateCanvasElement({
      ...validPieChart,
      radius: "big",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("radius");
  });

  it("rejects a FractionBar with missing totalSegments", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { totalSegments: _ts, ...noSegments } = validFractionBar as Record<string, unknown>;
    const result = validateCanvasElement(noSegments);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("totalSegments");
  });

  it("rejects a NumberLine with NaN step", () => {
    const result = validateCanvasElement({
      ...validNumberLine,
      step: NaN,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("step");
  });

  it("rejects a StepByStep with non-array steps", () => {
    const result = validateCanvasElement({
      ...validStepByStep,
      steps: "not-array",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("steps");
  });

  it("rejects a StepByStep step with missing text", () => {
    const result = validateCanvasElement({
      ...validStepByStep,
      steps: [{ index: 1 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("text");
  });

  it("rejects a TextBubble with missing text", () => {
    const result = validateCanvasElement({
      type: "TextBubble",
      id: "tb-x",
      position: { x: 0, y: 0 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("text");
  });

  it("rejects an Arrow with a malformed from point", () => {
    const result = validateCanvasElement({
      ...validArrow,
      from: { x: "not-a-number", y: 0 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("from");
  });

  it("rejects a Highlight with missing targetId", () => {
    const result = validateCanvasElement({
      type: "Highlight",
      id: "hl-x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("targetId");
  });

  it("rejects a Highlight with invalid style", () => {
    const result = validateCanvasElement({
      ...validHighlight,
      style: "sparkle",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("style");
  });

  it("accepts a Highlight with a valid style", () => {
    for (const style of ["pulse", "glow", "outline"]) {
      const result = validateCanvasElement({ ...validHighlight, style });
      expect(result.ok).toBe(true);
    }
  });

  it("accepts optional fields on elements (label, color, etc.)", () => {
    const result = validateCanvasElement({
      ...validPieChart,
      filledColor: "#ff0000",
      emptyColor: "#eee",
      label: "mitad",
    });
    expect(result.ok).toBe(true);
  });
});

// ── validateCanvasCommand ────────────────────────────────────────────

describe("validateCanvasCommand", () => {
  it("accepts a valid draw command", () => {
    const result = validateCanvasCommand({
      action: "draw",
      element: validPieChart,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.action).toBe("draw");
    }
  });

  it("accepts a clear command without targetId (full clear)", () => {
    const result = validateCanvasCommand({ action: "clear" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.action).toBe("clear");
    }
  });

  it("accepts a clear command with a targetId", () => {
    const result = validateCanvasCommand({
      action: "clear",
      targetId: "pie-1",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a clear command with non-string targetId", () => {
    const result = validateCanvasCommand({
      action: "clear",
      targetId: 123,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("targetId");
  });

  it("rejects an unknown action", () => {
    const result = validateCanvasCommand({ action: "explode" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("action");
  });

  it("rejects a non-object input", () => {
    const result = validateCanvasCommand(42);
    expect(result.ok).toBe(false);
  });

  it("rejects a draw command with an invalid element", () => {
    const result = validateCanvasCommand({
      action: "draw",
      element: { type: "Invalid", id: "bad" },
    });
    expect(result.ok).toBe(false);
  });
});

// ── validateExercise ─────────────────────────────────────────────────

describe("validateExercise", () => {
  it("accepts a minimal valid exercise", () => {
    const result = validateExercise({ question: "¿Cuánto es 1/2 + 1/4?" });
    expect(result.ok).toBe(true);
  });

  it("accepts a full exercise with acceptedAnswers and hint", () => {
    const result = validateExercise({
      question: "¿Cuánto es 3/4?",
      acceptedAnswers: ["3/4", "0.75"],
      hint: "Piensa en partes de una pizza",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a non-object", () => {
    const result = validateExercise(null);
    expect(result.ok).toBe(false);
  });

  it("rejects when question is missing", () => {
    const result = validateExercise({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("question");
  });

  it("rejects when acceptedAnswers contains non-strings", () => {
    const result = validateExercise({
      question: "test",
      acceptedAnswers: [42],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("acceptedAnswers");
  });

  it("rejects when hint is not a string", () => {
    const result = validateExercise({
      question: "test",
      hint: 123,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("hint");
  });
});

// ── parseAssistantPayload ────────────────────────────────────────────

describe("parseAssistantPayload", () => {
  const validPayload = {
    canvas_commands: [{ action: "draw", element: validPieChart }],
    speech: "Observa la fracción.",
    waiting_for_response: false,
  };

  it("accepts a valid payload object", () => {
    const result = parseAssistantPayload(validPayload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.speech).toBe("Observa la fracción.");
      expect(result.value.canvas_commands).toHaveLength(1);
      expect(result.value.waiting_for_response).toBe(false);
    }
  });

  it("accepts a valid JSON string", () => {
    const result = parseAssistantPayload(JSON.stringify(validPayload));
    expect(result.ok).toBe(true);
  });

  it("rejects invalid JSON strings", () => {
    const result = parseAssistantPayload("{bad json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("JSON");
  });

  it("rejects when canvas_commands is missing", () => {
    const result = parseAssistantPayload({
      speech: "hola",
      waiting_for_response: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("canvas_commands");
  });

  it("rejects when speech is missing", () => {
    const result = parseAssistantPayload({
      canvas_commands: [],
      waiting_for_response: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("speech");
  });

  it("rejects when waiting_for_response is missing", () => {
    const result = parseAssistantPayload({
      canvas_commands: [],
      speech: "hi",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("waiting_for_response");
  });

  it("rejects when waiting_for_response is not a boolean", () => {
    const result = parseAssistantPayload({
      canvas_commands: [],
      speech: "hi",
      waiting_for_response: "yes",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a payload with an exercise", () => {
    const result = parseAssistantPayload({
      ...validPayload,
      exercise: { question: "¿Cuánto es 1+1?", acceptedAnswers: ["2"] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exercise?.question).toBe("¿Cuánto es 1+1?");
    }
  });

  it("rejects a payload with an invalid exercise", () => {
    const result = parseAssistantPayload({
      ...validPayload,
      exercise: { hint: "nope" }, // missing question
    });
    expect(result.ok).toBe(false);
  });

  it("propagates element validation errors from nested commands", () => {
    const result = parseAssistantPayload({
      canvas_commands: [
        { action: "draw", element: { type: "PieChart", id: "p1" } }, // missing fields
      ],
      speech: "hi",
      waiting_for_response: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("position");
  });

  it("accepts empty canvas_commands array", () => {
    const result = parseAssistantPayload({
      canvas_commands: [],
      speech: "Pensemos un momento.",
      waiting_for_response: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.canvas_commands).toHaveLength(0);
    }
  });

  it("accepts a payload with multiple commands", () => {
    const result = parseAssistantPayload({
      canvas_commands: [
        { action: "draw", element: validPieChart },
        { action: "draw", element: validTextBubble },
        { action: "clear", targetId: "pie-1" },
      ],
      speech: "Primero dibujamos, luego borramos.",
      waiting_for_response: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.canvas_commands).toHaveLength(3);
    }
  });
});
