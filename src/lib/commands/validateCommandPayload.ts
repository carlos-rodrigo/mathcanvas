import type {
  AssistantPayload,
  CanvasCommand,
  CanvasElement,
  CanvasElementType,
  Exercise,
} from "./canvasTypes";

// ── Helpers ──────────────────────────────────────────────────────────

/** Lightweight result type – avoids throwing on bad input. */
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function fail(msg: string): ParseResult<never> {
  return { ok: false, error: msg };
}

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

// ── Element-type allow-list ──────────────────────────────────────────

const ELEMENT_TYPES: ReadonlySet<CanvasElementType> = new Set<CanvasElementType>([
  "PieChart",
  "FractionBar",
  "NumberLine",
  "FractionDisplay",
  "Operation",
  "StepByStep",
  "TextBubble",
  "Arrow",
  "Highlight",
]);

function isElementType(v: unknown): v is CanvasElementType {
  return isString(v) && ELEMENT_TYPES.has(v as CanvasElementType);
}

// ── Point ────────────────────────────────────────────────────────────

function validatePoint(v: unknown, path: string): ParseResult<{ x: number; y: number }> {
  if (!isObject(v)) return fail(`${path} must be an object`);
  if (!isNumber(v.x)) return fail(`${path}.x must be a number`);
  if (!isNumber(v.y)) return fail(`${path}.y must be a number`);
  return ok({ x: v.x, y: v.y });
}

// ── Individual element validators ────────────────────────────────────

function validateBaseElement(
  v: Record<string, unknown>,
  path: string,
): ParseResult<{ id: string; type: CanvasElementType }> {
  if (!isString(v.id)) return fail(`${path}.id must be a string`);
  if (!isElementType(v.type)) return fail(`${path}.type must be a valid element type`);
  return ok({ id: v.id, type: v.type });
}

function validatePieChart(v: Record<string, unknown>, path: string): ParseResult<null> {
  const pt = validatePoint(v.position, `${path}.position`);
  if (!pt.ok) return pt;
  if (!isNumber(v.radius)) return fail(`${path}.radius must be a number`);
  if (!isNumber(v.totalSlices)) return fail(`${path}.totalSlices must be a number`);
  if (!isNumber(v.filledSlices)) return fail(`${path}.filledSlices must be a number`);
  return ok(null);
}

function validateFractionBar(v: Record<string, unknown>, path: string): ParseResult<null> {
  const pt = validatePoint(v.position, `${path}.position`);
  if (!pt.ok) return pt;
  if (!isNumber(v.width)) return fail(`${path}.width must be a number`);
  if (!isNumber(v.height)) return fail(`${path}.height must be a number`);
  if (!isNumber(v.totalSegments)) return fail(`${path}.totalSegments must be a number`);
  if (!isNumber(v.filledSegments)) return fail(`${path}.filledSegments must be a number`);
  return ok(null);
}

function validateNumberLine(v: Record<string, unknown>, path: string): ParseResult<null> {
  const pt = validatePoint(v.position, `${path}.position`);
  if (!pt.ok) return pt;
  if (!isNumber(v.length)) return fail(`${path}.length must be a number`);
  if (!isNumber(v.min)) return fail(`${path}.min must be a number`);
  if (!isNumber(v.max)) return fail(`${path}.max must be a number`);
  if (!isNumber(v.step)) return fail(`${path}.step must be a number`);
  return ok(null);
}

function validateFractionDisplay(v: Record<string, unknown>, path: string): ParseResult<null> {
  const pt = validatePoint(v.position, `${path}.position`);
  if (!pt.ok) return pt;
  if (!isNumber(v.numerator)) return fail(`${path}.numerator must be a number`);
  if (!isNumber(v.denominator)) return fail(`${path}.denominator must be a number`);
  return ok(null);
}

function validateOperation(v: Record<string, unknown>, path: string): ParseResult<null> {
  const pt = validatePoint(v.position, `${path}.position`);
  if (!pt.ok) return pt;
  if (!isString(v.operator)) return fail(`${path}.operator must be a string`);
  return ok(null);
}

function validateStepByStep(v: Record<string, unknown>, path: string): ParseResult<null> {
  const pt = validatePoint(v.position, `${path}.position`);
  if (!pt.ok) return pt;
  if (!Array.isArray(v.steps)) return fail(`${path}.steps must be an array`);
  for (let i = 0; i < v.steps.length; i++) {
    const s = v.steps[i] as unknown;
    if (!isObject(s)) return fail(`${path}.steps[${i}] must be an object`);
    if (!isNumber(s.index)) return fail(`${path}.steps[${i}].index must be a number`);
    if (!isString(s.text)) return fail(`${path}.steps[${i}].text must be a string`);
  }
  return ok(null);
}

function validateTextBubble(v: Record<string, unknown>, path: string): ParseResult<null> {
  const pt = validatePoint(v.position, `${path}.position`);
  if (!pt.ok) return pt;
  if (!isString(v.text)) return fail(`${path}.text must be a string`);
  return ok(null);
}

function validateArrow(v: Record<string, unknown>, path: string): ParseResult<null> {
  const from = validatePoint(v.from, `${path}.from`);
  if (!from.ok) return from;
  const to = validatePoint(v.to, `${path}.to`);
  if (!to.ok) return to;
  return ok(null);
}

function validateHighlight(v: Record<string, unknown>, path: string): ParseResult<null> {
  if (!isString(v.targetId)) return fail(`${path}.targetId must be a string`);
  if (v.style !== undefined && !["pulse", "glow", "outline"].includes(v.style as string)) {
    return fail(`${path}.style must be "pulse", "glow", or "outline"`);
  }
  return ok(null);
}

// ── Element dispatcher ───────────────────────────────────────────────

const ELEMENT_VALIDATORS: Record<
  CanvasElementType,
  (v: Record<string, unknown>, path: string) => ParseResult<null>
> = {
  PieChart: validatePieChart,
  FractionBar: validateFractionBar,
  NumberLine: validateNumberLine,
  FractionDisplay: validateFractionDisplay,
  Operation: validateOperation,
  StepByStep: validateStepByStep,
  TextBubble: validateTextBubble,
  Arrow: validateArrow,
  Highlight: validateHighlight,
};

export function validateCanvasElement(
  v: unknown,
  path = "element",
): ParseResult<CanvasElement> {
  if (!isObject(v)) return fail(`${path} must be an object`);

  const base = validateBaseElement(v, path);
  if (!base.ok) return base;

  const validator = ELEMENT_VALIDATORS[base.value.type];
  const fieldResult = validator(v, path);
  if (!fieldResult.ok) return fieldResult;

  // Cast is safe – we verified all required fields above.
  return ok(v as unknown as CanvasElement);
}

// ── Command validators ───────────────────────────────────────────────

export function validateCanvasCommand(
  v: unknown,
  path = "command",
): ParseResult<CanvasCommand> {
  if (!isObject(v)) return fail(`${path} must be an object`);

  if (v.action === "draw") {
    const el = validateCanvasElement(v.element, `${path}.element`);
    if (!el.ok) return el;
    return ok({ action: "draw", element: el.value } as CanvasCommand);
  }

  if (v.action === "clear") {
    if (v.targetId !== undefined && !isString(v.targetId)) {
      return fail(`${path}.targetId must be a string when provided`);
    }
    return ok({
      action: "clear",
      ...(v.targetId !== undefined ? { targetId: v.targetId as string } : {}),
    } as CanvasCommand);
  }

  return fail(`${path}.action must be "draw" or "clear"`);
}

// ── Exercise validator ───────────────────────────────────────────────

export function validateExercise(
  v: unknown,
  path = "exercise",
): ParseResult<Exercise> {
  if (!isObject(v)) return fail(`${path} must be an object`);
  if (!isString(v.question)) return fail(`${path}.question must be a string`);

  if (v.acceptedAnswers !== undefined) {
    if (!Array.isArray(v.acceptedAnswers))
      return fail(`${path}.acceptedAnswers must be an array`);
    for (let i = 0; i < v.acceptedAnswers.length; i++) {
      if (!isString(v.acceptedAnswers[i]))
        return fail(`${path}.acceptedAnswers[${i}] must be a string`);
    }
  }

  if (v.hint !== undefined && !isString(v.hint))
    return fail(`${path}.hint must be a string`);

  return ok(v as unknown as Exercise);
}

// ── Top-level payload ────────────────────────────────────────────────

/**
 * Parse a raw JSON string (or already-parsed object) into a validated
 * `AssistantPayload`.  Use this at the boundary where LLM output enters
 * the application.
 */
export function parseAssistantPayload(raw: unknown): ParseResult<AssistantPayload> {
  // Accept a JSON string as convenience.
  let parsed: unknown = raw;
  if (isString(raw)) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fail("Invalid JSON string");
    }
  }

  if (!isObject(parsed)) return fail("Payload must be an object");

  // canvas_commands
  if (!Array.isArray(parsed.canvas_commands))
    return fail("payload.canvas_commands must be an array");

  const commands: CanvasCommand[] = [];
  for (let i = 0; i < parsed.canvas_commands.length; i++) {
    const cmd = validateCanvasCommand(
      parsed.canvas_commands[i],
      `payload.canvas_commands[${i}]`,
    );
    if (!cmd.ok) return cmd;
    commands.push(cmd.value);
  }

  // speech
  if (!isString(parsed.speech)) return fail("payload.speech must be a string");

  // exercise (optional)
  let exercise: Exercise | undefined;
  if (parsed.exercise !== undefined) {
    const ex = validateExercise(parsed.exercise, "payload.exercise");
    if (!ex.ok) return ex;
    exercise = ex.value;
  }

  // waiting_for_response
  if (!isBoolean(parsed.waiting_for_response))
    return fail("payload.waiting_for_response must be a boolean");

  return ok({
    canvas_commands: commands,
    speech: parsed.speech,
    ...(exercise !== undefined ? { exercise } : {}),
    waiting_for_response: parsed.waiting_for_response,
  });
}
