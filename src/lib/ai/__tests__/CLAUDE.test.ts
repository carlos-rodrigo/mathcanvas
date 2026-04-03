import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildSystemPrompt,
  buildMessages,
  PAYLOAD_SCHEMA,
  type ConversationMessage,
} from "../prompt";
import { extractJSON, parseAssistantResponse } from "../responseParser";
import { ClaudeClient } from "../claudeClient";
import type { AssistantPayload } from "@/lib/commands/canvasTypes";

// ═══════════════════════════════════════════════════════════════════════
// 1. PROMPT MODULE
// ═══════════════════════════════════════════════════════════════════════

describe("CLAUDE – prompt", () => {
  // ── System prompt ──────────────────────────────────────────────────

  it("builds a system prompt containing Argentine Spanish markers", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("español rioplatense");
    expect(prompt).toContain("vos");
    expect(prompt).toContain("Profe Clau");
  });

  it("includes the JSON schema in the system prompt", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('"canvas_commands"');
    expect(prompt).toContain('"speech"');
    expect(prompt).toContain('"waiting_for_response"');
  });

  it("injects the topic when provided", () => {
    const prompt = buildSystemPrompt("fracciones");
    expect(prompt).toContain("fracciones");
    expect(prompt).toContain("El tema de la clase de hoy es");
  });

  it("falls back to a generic line when no topic is given", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Adapta el tema a lo que el alumno pregunte");
  });

  it("PAYLOAD_SCHEMA is valid JSON", () => {
    expect(() => JSON.parse(PAYLOAD_SCHEMA)).not.toThrow();
  });

  // ── buildMessages ──────────────────────────────────────────────────

  it("appends the user message to an empty history", () => {
    const msgs = buildMessages([], "Hola profe");
    expect(msgs).toEqual([{ role: "user", content: "Hola profe" }]);
  });

  it("preserves existing conversation history", () => {
    const history: ConversationMessage[] = [
      { role: "user", content: "¿Qué son las fracciones?" },
      { role: "assistant", content: '{"speech":"..."}' },
    ];
    const msgs = buildMessages(history, "No entendí");
    expect(msgs).toHaveLength(3);
    expect(msgs[0]).toEqual(history[0]);
    expect(msgs[1]).toEqual(history[1]);
    expect(msgs[2]).toEqual({ role: "user", content: "No entendí" });
  });

  it("does not mutate the original history array", () => {
    const history: ConversationMessage[] = [
      { role: "user", content: "Hola" },
    ];
    const originalLength = history.length;
    buildMessages(history, "Chau");
    expect(history).toHaveLength(originalLength);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. RESPONSE PARSER
// ═══════════════════════════════════════════════════════════════════════

/** Minimal valid payload for reuse across tests. */
const VALID_PAYLOAD: AssistantPayload = {
  canvas_commands: [],
  speech: "¡Hola! Soy el Profe Clau.",
  waiting_for_response: false,
};

const VALID_PAYLOAD_WITH_DRAW: AssistantPayload = {
  canvas_commands: [
    {
      action: "draw",
      element: {
        type: "PieChart",
        id: "pie-1",
        position: { x: 100, y: 100 },
        radius: 50,
        totalSlices: 4,
        filledSlices: 1,
      },
    },
  ],
  speech: "Mirá esta torta.",
  waiting_for_response: false,
};

const VALID_PAYLOAD_WITH_EXERCISE: AssistantPayload = {
  canvas_commands: [],
  speech: "¿Cuánto es 1/2 + 1/4?",
  exercise: {
    question: "¿Cuánto es 1/2 + 1/4?",
    acceptedAnswers: ["3/4"],
    hint: "Buscá un denominador común.",
  },
  waiting_for_response: true,
};

describe("CLAUDE – extractJSON", () => {
  it("parses clean JSON directly", () => {
    const json = JSON.stringify(VALID_PAYLOAD);
    expect(extractJSON(json)).toEqual(VALID_PAYLOAD);
  });

  it("extracts JSON from markdown code fences", () => {
    const raw = "```json\n" + JSON.stringify(VALID_PAYLOAD) + "\n```";
    expect(extractJSON(raw)).toEqual(VALID_PAYLOAD);
  });

  it("extracts JSON from plain code fences", () => {
    const raw = "```\n" + JSON.stringify(VALID_PAYLOAD) + "\n```";
    expect(extractJSON(raw)).toEqual(VALID_PAYLOAD);
  });

  it("extracts JSON surrounded by preamble text", () => {
    const raw =
      "Acá tenés tu respuesta:\n" + JSON.stringify(VALID_PAYLOAD) + "\nEspero que te sirva.";
    expect(extractJSON(raw)).toEqual(VALID_PAYLOAD);
  });

  it("returns null for empty input", () => {
    expect(extractJSON("")).toBeNull();
  });

  it("returns null for random text without JSON", () => {
    expect(extractJSON("Hola, ¿cómo estás?")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(extractJSON('{ "speech": }')).toBeNull();
  });

  it("returns null for JSON arrays (not objects)", () => {
    expect(extractJSON("[1,2,3]")).toBeNull();
  });
});

describe("CLAUDE – parseAssistantResponse", () => {
  it("parses a valid JSON string into an AssistantPayload", () => {
    const result = parseAssistantResponse(JSON.stringify(VALID_PAYLOAD));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.speech).toBe(VALID_PAYLOAD.speech);
      expect(result.value.canvas_commands).toEqual([]);
      expect(result.value.waiting_for_response).toBe(false);
    }
  });

  it("parses a payload with draw commands", () => {
    const result = parseAssistantResponse(JSON.stringify(VALID_PAYLOAD_WITH_DRAW));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.canvas_commands).toHaveLength(1);
      expect(result.value.canvas_commands[0].action).toBe("draw");
    }
  });

  it("parses a payload with an exercise", () => {
    const result = parseAssistantResponse(JSON.stringify(VALID_PAYLOAD_WITH_EXERCISE));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exercise).toBeDefined();
      expect(result.value.exercise!.question).toBe("¿Cuánto es 1/2 + 1/4?");
      expect(result.value.exercise!.acceptedAnswers).toEqual(["3/4"]);
      expect(result.value.waiting_for_response).toBe(true);
    }
  });

  it("handles JSON wrapped in markdown fences", () => {
    const raw = "```json\n" + JSON.stringify(VALID_PAYLOAD) + "\n```";
    const result = parseAssistantResponse(raw);
    expect(result.ok).toBe(true);
  });

  it("handles JSON with surrounding prose", () => {
    const raw =
      "Here is my response:\n" + JSON.stringify(VALID_PAYLOAD) + "\nDone.";
    const result = parseAssistantResponse(raw);
    expect(result.ok).toBe(true);
  });

  it("rejects empty input", () => {
    const result = parseAssistantResponse("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Empty response");
  });

  it("rejects whitespace-only input", () => {
    const result = parseAssistantResponse("   \n  ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Empty response");
  });

  it("rejects non-JSON text", () => {
    const result = parseAssistantResponse("No sé qué decir");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not extract valid JSON");
  });

  it("rejects JSON missing required 'speech' field", () => {
    const bad = { canvas_commands: [], waiting_for_response: false };
    const result = parseAssistantResponse(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("speech");
  });

  it("rejects JSON missing required 'canvas_commands' field", () => {
    const bad = { speech: "Hola", waiting_for_response: false };
    const result = parseAssistantResponse(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("canvas_commands");
  });

  it("rejects JSON missing required 'waiting_for_response' field", () => {
    const bad = { canvas_commands: [], speech: "Hola" };
    const result = parseAssistantResponse(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("waiting_for_response");
  });

  it("rejects a draw command with invalid element type", () => {
    const bad = {
      canvas_commands: [
        {
          action: "draw",
          element: { type: "InvalidType", id: "x", position: { x: 0, y: 0 } },
        },
      ],
      speech: "Hola",
      waiting_for_response: false,
    };
    const result = parseAssistantResponse(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("type");
  });

  it("rejects a draw command with missing element fields", () => {
    const bad = {
      canvas_commands: [
        {
          action: "draw",
          element: { type: "PieChart", id: "pie-1" },
          // missing position, radius, etc.
        },
      ],
      speech: "Hola",
      waiting_for_response: false,
    };
    const result = parseAssistantResponse(JSON.stringify(bad));
    expect(result.ok).toBe(false);
  });

  it("accepts a clear command without targetId", () => {
    const payload = {
      canvas_commands: [{ action: "clear" }],
      speech: "Borro todo.",
      waiting_for_response: false,
    };
    const result = parseAssistantResponse(JSON.stringify(payload));
    expect(result.ok).toBe(true);
  });

  it("accepts a clear command with targetId", () => {
    const payload = {
      canvas_commands: [{ action: "clear", targetId: "pie-1" }],
      speech: "Borro la torta.",
      waiting_for_response: false,
    };
    const result = parseAssistantResponse(JSON.stringify(payload));
    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. CLAUDE CLIENT
// ═══════════════════════════════════════════════════════════════════════

// ── Mock Anthropic client helper ───────────────────────────────────────────────

function createMockAnthropicClient() {
  const mockCreate = vi.fn();
  const mockClient = {
    messages: { create: mockCreate },
  } as any;
  return { mockClient, mockCreate };
}

describe("CLAUDE – ClaudeClient", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-api-key";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    vi.restoreAllMocks();
  });

  // ── Construction ─────────────────────────────────────────────────

  it("creates a client when anthropicClient is provided (env key set)", () => {
    const { mockClient } = createMockAnthropicClient();
    expect(() => new ClaudeClient({ anthropicClient: mockClient })).not.toThrow();
  });

  it("creates a client using explicit apiKey via injected client path", () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { mockClient } = createMockAnthropicClient();
    expect(
      () => new ClaudeClient({ apiKey: "sk-explicit", anthropicClient: mockClient }),
    ).not.toThrow();
  });

  it("throws when no API key is available and no client injected", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => new ClaudeClient()).toThrow(/Missing Anthropic API key/);
  });

  it("does not require apiKey when anthropicClient is injected", () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { mockClient } = createMockAnthropicClient();
    expect(() => new ClaudeClient({ anthropicClient: mockClient })).not.toThrow();
  });

  // ── sendMessage – happy path ─────────────────────────────────────

  it("returns a valid AssistantPayload on a well-formed response", async () => {
    const { mockClient, mockCreate } = createMockAnthropicClient();
    const client = new ClaudeClient({ anthropicClient: mockClient });

    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            canvas_commands: [],
            speech: "¡Hola! Soy Profe Clau.",
            waiting_for_response: false,
          }),
        },
      ],
    });

    const result = await client.sendMessage("Hola profe");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.speech).toBe("¡Hola! Soy Profe Clau.");
    }
  });

  it("passes system prompt, model and messages to the API", async () => {
    const { mockClient, mockCreate } = createMockAnthropicClient();
    const client = new ClaudeClient({
      anthropicClient: mockClient,
      model: "claude-sonnet-4-20250514",
      topic: "fracciones",
    });

    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            canvas_commands: [],
            speech: "Hablemos de fracciones.",
            waiting_for_response: false,
          }),
        },
      ],
    });

    await client.sendMessage("Empecemos");

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-4-20250514");
    expect(callArgs.system).toContain("fracciones");
    expect(callArgs.system).toContain("Profe Clau");
    expect(callArgs.messages).toEqual([
      { role: "user", content: "Empecemos" },
    ]);
  });

  it("includes conversation history in messages", async () => {
    const { mockClient, mockCreate } = createMockAnthropicClient();
    const client = new ClaudeClient({ anthropicClient: mockClient });

    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            canvas_commands: [],
            speech: "Siguiente paso.",
            waiting_for_response: false,
          }),
        },
      ],
    });

    const history: ConversationMessage[] = [
      { role: "user", content: "Hola" },
      { role: "assistant", content: '{"speech":"¡Hola!"}' },
    ];

    await client.sendMessage("Siguiente", history);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(3);
    expect(callArgs.messages[2]).toEqual({ role: "user", content: "Siguiente" });
  });

  // ── sendMessage – malformed response ─────────────────────────────

  it("returns parse error when model returns non-JSON", async () => {
    const { mockClient, mockCreate } = createMockAnthropicClient();
    const client = new ClaudeClient({ anthropicClient: mockClient });

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "No tengo ganas de dar JSON hoy." }],
    });

    const result = await client.sendMessage("Hola");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not extract valid JSON");
  });

  it("returns parse error when model returns invalid payload structure", async () => {
    const { mockClient, mockCreate } = createMockAnthropicClient();
    const client = new ClaudeClient({ anthropicClient: mockClient });

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"not_a_real_field": true}' }],
    });

    const result = await client.sendMessage("Hola");
    expect(result.ok).toBe(false);
  });

  it("returns parse error when model response has no text blocks", async () => {
    const { mockClient, mockCreate } = createMockAnthropicClient();
    const client = new ClaudeClient({ anthropicClient: mockClient });

    mockCreate.mockResolvedValueOnce({
      content: [],
    });

    const result = await client.sendMessage("Hola");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Empty response");
  });

  // ── sendMessage – API error propagation ──────────────────────────

  it("propagates API errors (network, auth, etc.)", async () => {
    const { mockClient, mockCreate } = createMockAnthropicClient();
    const client = new ClaudeClient({ anthropicClient: mockClient });

    mockCreate.mockRejectedValueOnce(new Error("Network failure"));

    await expect(client.sendMessage("Hola")).rejects.toThrow("Network failure");
  });

  // ── sendMessage – JSON in fences ─────────────────────────────────

  it("handles model wrapping JSON in markdown fences", async () => {
    const { mockClient, mockCreate } = createMockAnthropicClient();
    const client = new ClaudeClient({ anthropicClient: mockClient });

    const payload = {
      canvas_commands: [],
      speech: "¡Bienvenido!",
      waiting_for_response: false,
    };
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: "text", text: "```json\n" + JSON.stringify(payload) + "\n```" },
      ],
    });

    const result = await client.sendMessage("Hola");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.speech).toBe("¡Bienvenido!");
    }
  });

  // ── sendMessage – complex payload ────────────────────────────────

  it("correctly parses a response with draw commands and exercise", async () => {
    const { mockClient, mockCreate } = createMockAnthropicClient();
    const client = new ClaudeClient({ anthropicClient: mockClient });

    const payload = {
      canvas_commands: [
        {
          action: "draw",
          element: {
            type: "FractionDisplay",
            id: "frac-1",
            position: { x: 200, y: 150 },
            numerator: 3,
            denominator: 4,
          },
        },
      ],
      speech: "Mirá esta fracción: tres cuartos.",
      exercise: {
        question: "¿Cuánto es 3/4 + 1/4?",
        acceptedAnswers: ["1", "4/4"],
        hint: "Sumá los numeradores.",
      },
      waiting_for_response: true,
    };

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(payload) }],
    });

    const result = await client.sendMessage("Enseñame fracciones");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.canvas_commands).toHaveLength(1);
      expect(result.value.canvas_commands[0].action).toBe("draw");
      expect(result.value.exercise?.question).toBe("¿Cuánto es 3/4 + 1/4?");
      expect(result.value.waiting_for_response).toBe(true);
    }
  });
});
