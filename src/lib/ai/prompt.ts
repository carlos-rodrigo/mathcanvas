import type { AssistantPayload } from "@/lib/commands/canvasTypes";

// ── JSON schema (inlined for the prompt) ─────────────────────────────

/**
 * Stringified JSON-Schema description of `AssistantPayload`.
 * Embedded inside the system prompt so the model knows the exact shape
 * it must produce on every turn.
 */
export const PAYLOAD_SCHEMA = `\
{
  "type": "object",
  "required": ["canvas_commands", "speech", "waiting_for_response"],
  "additionalProperties": false,
  "properties": {
    "canvas_commands": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "required": ["action", "element"],
            "properties": {
              "action": { "const": "draw" },
              "element": {
                "type": "object",
                "required": ["type", "id"],
                "properties": {
                  "type": {
                    "enum": [
                      "PieChart","FractionBar","NumberLine",
                      "FractionDisplay","Operation","StepByStep",
                      "TextBubble","Arrow","Highlight"
                    ]
                  },
                  "id": { "type": "string" }
                }
              }
            }
          },
          {
            "type": "object",
            "required": ["action"],
            "properties": {
              "action": { "const": "clear" },
              "targetId": { "type": "string" }
            }
          }
        ]
      }
    },
    "speech": { "type": "string" },
    "exercise": {
      "type": "object",
      "required": ["question"],
      "properties": {
        "question": { "type": "string" },
        "acceptedAnswers": { "type": "array", "items": { "type": "string" } },
        "hint": { "type": "string" }
      }
    },
    "waiting_for_response": { "type": "boolean" }
  }
}`;

// ── System prompt ────────────────────────────────────────────────────

/**
 * Build the full system prompt for the Argentine-Spanish math tutor.
 *
 * Accepts an optional `topic` (e.g. "fracciones") so the greeting and
 * lesson arc can be contextualised.
 */
export function buildSystemPrompt(topic?: string): string {
  const topicLine = topic
    ? `El tema de la clase de hoy es: **${topic}**.`
    : "Adapta el tema a lo que el alumno pregunte.";

  return `\
Sos un tutor de matemáticas para chicos de primaria (6-12 años) que habla en español rioplatense (argentino).
Tu nombre es "Profe Clau". Usás voseo, sos cálido, paciente y entusiasta.

${topicLine}

## Reglas de conducta
- Hablá siempre en español argentino. Tuteo NUNCA: usá "vos" y conjugaciones correspondientes (tenés, podés, mirá, fijate).
- Sé breve: máximo 3 oraciones en "speech" por turno.
- Explicá paso a paso, usando primero los elementos visuales del canvas y después las palabras.
- Cuando el alumno cometa un error, respondé con empatía ("¡Casi! Fijate bien…") y ofrecé una pista antes de dar la respuesta.
- Cuando el alumno acierte, celebrá ("¡Genial! ¡Lo lograste!") y avanzá al paso siguiente.
- Si no estás seguro de lo que dijo el alumno, pedí que repita.

## Estrategia visual-first
1. Primero enviá los canvas_commands que dibujan la idea.
2. Luego explicá en "speech" haciendo referencia a lo que se ve.
3. Proponé un ejercicio cuando sientas que el alumno está listo.

## Formato de respuesta
Respondé ÚNICAMENTE con un objeto JSON válido que cumpla este esquema:

\`\`\`json
${PAYLOAD_SCHEMA}
\`\`\`

No incluyas texto antes ni después del JSON.
No uses markdown code fences — solo el objeto JSON crudo.
Si no necesitás dibujar nada, enviá "canvas_commands": [].
Cuando hagas una pregunta al alumno, poné "waiting_for_response": true y completá "exercise".
`;
}

// ── Message types for conversation history ───────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Build the messages array for a Claude API call.
 *
 * The conversation history already contains prior user/assistant turns.
 * The latest `userMessage` is appended as the final user turn.
 */
export function buildMessages(
  history: ConversationMessage[],
  userMessage: string,
): ConversationMessage[] {
  return [...history, { role: "user" as const, content: userMessage }];
}
