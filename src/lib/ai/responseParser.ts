import type { AssistantPayload } from "@/lib/commands/canvasTypes";
import {
  parseAssistantPayload,
  type ParseResult,
} from "@/lib/commands/validateCommandPayload";

// ── JSON extraction helpers ──────────────────────────────────────────

/**
 * Attempt to extract a JSON object string from raw model output.
 *
 * Models sometimes wrap JSON in markdown fences or add preamble text.
 * This function tries (in order):
 *
 * 1. Direct `JSON.parse` on the trimmed input.
 * 2. Extract content inside ```json ... ``` fences.
 * 3. Find the first `{` and last `}` and try that substring.
 *
 * Returns `null` if no valid JSON object can be located.
 */
export function extractJSON(raw: string): unknown | null {
  const trimmed = raw.trim();

  // 1 – direct parse
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed))
      return parsed;
  } catch {
    // fall through
  }

  // 2 – markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch {
      // fall through
    }
  }

  // 3 – first { … last }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch {
      // fall through
    }
  }

  return null;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Parse a raw Claude response string into a validated `AssistantPayload`.
 *
 * This is the single entry-point the rest of the app should use.
 * It handles JSON extraction, structural validation, and returns a
 * discriminated `ParseResult`.
 */
export function parseAssistantResponse(
  raw: string,
): ParseResult<AssistantPayload> {
  if (!raw || raw.trim().length === 0) {
    return { ok: false, error: "Empty response from model" };
  }

  const extracted = extractJSON(raw);
  if (extracted === null) {
    return {
      ok: false,
      error: "Could not extract valid JSON from model response",
    };
  }

  return parseAssistantPayload(extracted);
}
