import { describe, it, expect } from "vitest";
import {
  parseAssistantPayload,
  type ParseResult,
} from "@/lib/commands/validateCommandPayload";
import type { AssistantPayload } from "@/lib/commands/canvasTypes";

/**
 * Tests focused on the AI response parsing boundary — simulating raw
 * LLM output entering the app via `parseAssistantPayload`.
 *
 * These complement the schema-level tests in validateCommandPayload.test.ts
 * by exercising realistic LLM response shapes, edge cases, and malformed
 * outputs that real models produce.
 */

// ── Helpers ──────────────────────────────────────────────────────────

function expectOk(result: ParseResult<AssistantPayload>): AssistantPayload {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function expectFail(result: ParseResult<AssistantPayload>): string {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected failure");
  return result.error;
}

// ── Realistic LLM payloads ───────────────────────────────────────────

describe("responseParser – realistic LLM outputs", () => {
  it("parses a full fraction-lesson response", () => {
    const raw = JSON.stringify({
      canvas_commands: [
        {
          action: "draw",
          element: {
            type: "PieChart",
            id: "pie-half",
            position: { x: 200, y: 200 },
            radius: 60,
            totalSlices: 4,
            filledSlices: 2,
            label: "2/4",
          },
        },
        {
          action: "draw",
          element: {
            type: "FractionDisplay",
            id: "fd-result",
            position: { x: 400, y: 200 },
            numerator: 1,
            denominator: 2,
            fontSize: 32,
          },
        },
        {
          action: "draw",
          element: {
            type: "Arrow",
            id: "simplify-arrow",
            from: { x: 280, y: 200 },
            to: { x: 380, y: 200 },
            label: "simplificar",
          },
        },
      ],
      speech:
        "Mira, 2/4 es lo mismo que 1/2. Podemos simplificar dividiendo ambos entre 2.",
      waiting_for_response: false,
    });

    const payload = expectOk(parseAssistantPayload(raw));
    expect(payload.canvas_commands).toHaveLength(3);
    expect(payload.speech).toContain("simplificar");
    expect(payload.waiting_for_response).toBe(false);
    expect(payload.exercise).toBeUndefined();
  });

  it("parses a response with an exercise posed to the student", () => {
    const raw = {
      canvas_commands: [
        {
          action: "draw",
          element: {
            type: "TextBubble",
            id: "prompt",
            position: { x: 100, y: 80 },
            text: "Tu turno",
          },
        },
      ],
      speech: "Ahora inténtalo tú. ¿Cuánto es 1/3 + 1/3?",
      exercise: {
        question: "¿Cuánto es 1/3 + 1/3?",
        acceptedAnswers: ["2/3"],
        hint: "Suma los numeradores",
      },
      waiting_for_response: true,
    };

    const payload = expectOk(parseAssistantPayload(raw));
    expect(payload.waiting_for_response).toBe(true);
    expect(payload.exercise?.question).toBe("¿Cuánto es 1/3 + 1/3?");
    expect(payload.exercise?.acceptedAnswers).toContain("2/3");
  });

  it("parses a clear-then-draw sequence (new topic)", () => {
    const raw = {
      canvas_commands: [
        { action: "clear" },
        {
          action: "draw",
          element: {
            type: "NumberLine",
            id: "nl-new",
            position: { x: 50, y: 250 },
            length: 500,
            min: 0,
            max: 1,
            step: 0.25,
            markers: [0.5],
          },
        },
      ],
      speech: "Cambiemos de tema. Veamos la recta numérica.",
      waiting_for_response: false,
    };

    const payload = expectOk(parseAssistantPayload(raw));
    expect(payload.canvas_commands[0].action).toBe("clear");
    expect(payload.canvas_commands[1].action).toBe("draw");
  });

  it("parses a step-by-step explanation payload", () => {
    const raw = {
      canvas_commands: [
        {
          action: "draw",
          element: {
            type: "StepByStep",
            id: "steps-add",
            position: { x: 50, y: 50 },
            steps: [
              { index: 1, text: "Encuentra el denominador común" },
              { index: 2, text: "Convierte las fracciones" },
              { index: 3, text: "Suma los numeradores" },
            ],
          },
        },
      ],
      speech: "Estos son los pasos para sumar fracciones.",
      waiting_for_response: false,
    };

    const payload = expectOk(parseAssistantPayload(raw));
    const drawCmd = payload.canvas_commands[0];
    expect(drawCmd.action).toBe("draw");
    if (drawCmd.action === "draw") {
      expect(drawCmd.element.type).toBe("StepByStep");
    }
  });

  it("parses a speech-only response (empty commands)", () => {
    const raw = {
      canvas_commands: [],
      speech: "¡Muy bien! Esa respuesta es correcta.",
      waiting_for_response: false,
    };

    const payload = expectOk(parseAssistantPayload(raw));
    expect(payload.canvas_commands).toHaveLength(0);
    expect(payload.speech).toContain("correcta");
  });
});

// ── Malformed LLM outputs ────────────────────────────────────────────

describe("responseParser – malformed LLM outputs", () => {
  it("rejects raw string that is not valid JSON", () => {
    const error = expectFail(parseAssistantPayload("Hola, soy tu tutor"));
    expect(error).toContain("JSON");
  });

  it("rejects when LLM returns a bare array instead of object", () => {
    const error = expectFail(parseAssistantPayload(JSON.stringify([])));
    expect(error).toContain("object");
  });

  it("rejects when LLM omits canvas_commands key", () => {
    const error = expectFail(
      parseAssistantPayload({
        commands: [], // wrong key name
        speech: "hi",
        waiting_for_response: false,
      }),
    );
    expect(error).toContain("canvas_commands");
  });

  it("rejects null input", () => {
    const error = expectFail(parseAssistantPayload(null));
    expect(error).toContain("object");
  });

  it("rejects undefined input", () => {
    const error = expectFail(parseAssistantPayload(undefined));
    expect(error).toContain("object");
  });

  it("rejects when canvas_commands contains a non-object entry", () => {
    const error = expectFail(
      parseAssistantPayload({
        canvas_commands: ["draw a pie"],
        speech: "hi",
        waiting_for_response: false,
      }),
    );
    expect(error).toContain("object");
  });

  it("rejects JSON with trailing text (markdown wrapping)", () => {
    // Models sometimes wrap JSON in ```json ... ```
    const error = expectFail(
      parseAssistantPayload('```json\n{"canvas_commands":[]}\n```'),
    );
    expect(error).toContain("JSON");
  });

  it("rejects when speech is a number instead of string", () => {
    const error = expectFail(
      parseAssistantPayload({
        canvas_commands: [],
        speech: 42,
        waiting_for_response: false,
      }),
    );
    expect(error).toContain("speech");
  });

  it("rejects deeply nested element errors", () => {
    const error = expectFail(
      parseAssistantPayload({
        canvas_commands: [
          {
            action: "draw",
            element: {
              type: "Arrow",
              id: "a1",
              from: { x: 0, y: 0 },
              to: { x: "end", y: 100 }, // x should be number
            },
          },
        ],
        speech: "x",
        waiting_for_response: false,
      }),
    );
    expect(error).toContain("to");
  });
});

// ── Edge cases ───────────────────────────────────────────────────────

describe("responseParser – edge cases", () => {
  it("handles very long speech text", () => {
    const longSpeech = "Hola ".repeat(2000);
    const result = parseAssistantPayload({
      canvas_commands: [],
      speech: longSpeech,
      waiting_for_response: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.speech).toBe(longSpeech);
  });

  it("handles unicode and emoji in speech", () => {
    const result = parseAssistantPayload({
      canvas_commands: [],
      speech: "¡Excelente! 🎉 ½ + ¼ = ¾",
      waiting_for_response: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.speech).toContain("🎉");
  });

  it("handles large number of commands", () => {
    const commands = Array.from({ length: 50 }, (_, i) => ({
      action: "draw" as const,
      element: {
        type: "TextBubble" as const,
        id: `tb-${i}`,
        position: { x: i * 10, y: i * 10 },
        text: `Bubble ${i}`,
      },
    }));
    const result = parseAssistantPayload({
      canvas_commands: commands,
      speech: "Muchos elementos",
      waiting_for_response: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.canvas_commands).toHaveLength(50);
  });

  it("accepts both parsed object and stringified JSON equivalently", () => {
    const obj = {
      canvas_commands: [
        { action: "draw", element: { type: "TextBubble", id: "t1", position: { x: 0, y: 0 }, text: "hi" } },
      ],
      speech: "test",
      waiting_for_response: true,
    };
    const fromObj = parseAssistantPayload(obj);
    const fromStr = parseAssistantPayload(JSON.stringify(obj));
    expect(fromObj.ok).toBe(true);
    expect(fromStr.ok).toBe(true);
    if (fromObj.ok && fromStr.ok) {
      expect(fromObj.value.speech).toBe(fromStr.value.speech);
      expect(fromObj.value.canvas_commands).toHaveLength(
        fromStr.value.canvas_commands.length,
      );
    }
  });
});
