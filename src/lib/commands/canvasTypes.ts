// ── Geometry & shared primitives ─────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

// ── Canvas element types ─────────────────────────────────────────────

export interface PieChart {
  type: "PieChart";
  id: string;
  position: Point;
  radius: number;
  /** Total number of equal slices */
  totalSlices: number;
  /** How many slices are filled / highlighted */
  filledSlices: number;
  filledColor?: string;
  emptyColor?: string;
  label?: string;
}

export interface FractionBar {
  type: "FractionBar";
  id: string;
  position: Point;
  width: number;
  height: number;
  totalSegments: number;
  filledSegments: number;
  filledColor?: string;
  emptyColor?: string;
  label?: string;
}

export interface NumberLine {
  type: "NumberLine";
  id: string;
  position: Point;
  length: number;
  min: number;
  max: number;
  step: number;
  /** Points to highlight on the line */
  markers?: number[];
  label?: string;
}

export interface FractionDisplay {
  type: "FractionDisplay";
  id: string;
  position: Point;
  numerator: number;
  denominator: number;
  fontSize?: number;
  color?: string;
  label?: string;
}

export interface Operation {
  type: "Operation";
  id: string;
  position: Point;
  /** e.g. "+", "−", "×", "÷", "=" */
  operator: string;
  fontSize?: number;
  color?: string;
}

export interface StepByStep {
  type: "StepByStep";
  id: string;
  position: Point;
  steps: StepItem[];
}

export interface StepItem {
  /** 1-based index */
  index: number;
  text: string;
  /** Whether this step is currently highlighted / active */
  active?: boolean;
}

export interface TextBubble {
  type: "TextBubble";
  id: string;
  position: Point;
  text: string;
  fontSize?: number;
  backgroundColor?: string;
  textColor?: string;
  maxWidth?: number;
}

export interface Arrow {
  type: "Arrow";
  id: string;
  from: Point;
  to: Point;
  color?: string;
  strokeWidth?: number;
  /** Show arrowhead at the end */
  headSize?: number;
  label?: string;
}

export interface Highlight {
  type: "Highlight";
  id: string;
  /** ID of the element to highlight */
  targetId: string;
  color?: string;
  /** e.g. "pulse", "glow", "outline" */
  style?: "pulse" | "glow" | "outline";
}

/** Discriminated union of every drawable element. */
export type CanvasElement =
  | PieChart
  | FractionBar
  | NumberLine
  | FractionDisplay
  | Operation
  | StepByStep
  | TextBubble
  | Arrow
  | Highlight;

export type CanvasElementType = CanvasElement["type"];

// ── Canvas command actions ───────────────────────────────────────────

export interface DrawCommand {
  action: "draw";
  element: CanvasElement;
}

export interface ClearCommand {
  action: "clear";
  /** When omitted the entire canvas is cleared. */
  targetId?: string;
}

export type CanvasCommand = DrawCommand | ClearCommand;

// ── Top-level assistant payload ──────────────────────────────────────

export interface Exercise {
  question: string;
  /** Optional set of acceptable answers (strings to allow fractions like "3/4"). */
  acceptedAnswers?: string[];
  hint?: string;
}

export interface AssistantPayload {
  /** Ordered list of canvas mutations for this turn. */
  canvas_commands: CanvasCommand[];
  /** Text the tutor speaks / displays alongside visuals. */
  speech: string;
  /** Present when the assistant poses a question to the learner. */
  exercise?: Exercise;
  /**
   * `true` when the assistant expects the learner to reply before
   * continuing (e.g. after posing an exercise).
   */
  waiting_for_response: boolean;
}
