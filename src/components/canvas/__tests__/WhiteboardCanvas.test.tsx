import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import WhiteboardCanvas, {
  dispatchCanvasCommands,
} from "../WhiteboardCanvas";
import { applyCanvasCommands } from "../types";
import type {
  CanvasCommand,
  CanvasElement,
  PieChart,
  FractionBar,
  NumberLine,
  FractionDisplay,
  Operation,
  StepByStep,
  TextBubble,
  Arrow,
  Highlight,
} from "@/lib/commands/canvasTypes";

// ── Fixtures ─────────────────────────────────────────────────────────

const pieFix: PieChart = {
  type: "PieChart",
  id: "pie-1",
  position: { x: 200, y: 200 },
  radius: 60,
  totalSlices: 4,
  filledSlices: 1,
  label: "1/4",
};

const barFix: FractionBar = {
  type: "FractionBar",
  id: "bar-1",
  position: { x: 100, y: 100 },
  width: 200,
  height: 30,
  totalSegments: 5,
  filledSegments: 3,
};

const numberLineFix: NumberLine = {
  type: "NumberLine",
  id: "nl-1",
  position: { x: 50, y: 300 },
  length: 400,
  min: 0,
  max: 10,
  step: 1,
  markers: [3, 7],
  label: "recta",
};

const fractionDisplayFix: FractionDisplay = {
  type: "FractionDisplay",
  id: "fd-1",
  position: { x: 400, y: 250 },
  numerator: 3,
  denominator: 4,
  fontSize: 28,
  color: "#6366f1",
  label: "resultado",
};

const operationFix: Operation = {
  type: "Operation",
  id: "op-1",
  position: { x: 350, y: 250 },
  operator: "+",
  fontSize: 32,
};

const stepByStepFix: StepByStep = {
  type: "StepByStep",
  id: "steps-1",
  position: { x: 50, y: 50 },
  steps: [
    { index: 1, text: "Primer paso", active: true },
    { index: 2, text: "Segundo paso", active: false },
  ],
};

const textBubbleFix: TextBubble = {
  type: "TextBubble",
  id: "tb-1",
  position: { x: 100, y: 100 },
  text: "¡Hola!",
  fontSize: 16,
  backgroundColor: "#e0e7ff",
  textColor: "#3730a3",
  maxWidth: 200,
};

const arrowFix: Arrow = {
  type: "Arrow",
  id: "arr-1",
  from: { x: 100, y: 100 },
  to: { x: 300, y: 100 },
  color: "#334155",
  strokeWidth: 2,
  headSize: 8,
  label: "dirección",
};

const highlightFix: Highlight = {
  type: "Highlight",
  id: "hl-1",
  targetId: "pie-1",
  color: "#facc15",
  style: "pulse",
};

// ── Tests ────────────────────────────────────────────────────────────

afterEach(cleanup);

describe("WhiteboardCanvas", () => {
  // ── Rendering ────────────────────────────────────────────────────

  it("renders an SVG element with the correct viewBox", () => {
    render(<WhiteboardCanvas elements={[]} />);
    const svg = screen.getByTestId("whiteboard-svg");
    expect(svg).toBeTruthy();
    expect(svg.getAttribute("viewBox")).toBe("0 0 800 500");
  });

  it("shows empty-state when no elements are provided", () => {
    render(<WhiteboardCanvas elements={[]} />);
    expect(screen.getByTestId("empty-state")).toBeTruthy();
  });

  it("hides empty-state when elements exist", () => {
    render(<WhiteboardCanvas elements={[pieFix]} />);
    expect(screen.queryByTestId("empty-state")).toBeNull();
  });

  // ── Primitive rendering ──────────────────────────────────────────

  it("renders a PieChart primitive", () => {
    render(<WhiteboardCanvas elements={[pieFix]} />);
    expect(screen.getByTestId("pie-chart-pie-1")).toBeTruthy();
  });

  it("renders a FractionBar primitive", () => {
    render(<WhiteboardCanvas elements={[barFix]} />);
    expect(screen.getByTestId("fraction-bar-bar-1")).toBeTruthy();
  });

  it("renders a NumberLine primitive", () => {
    render(<WhiteboardCanvas elements={[numberLineFix]} />);
    expect(screen.getByTestId("number-line-nl-1")).toBeTruthy();
  });

  it("renders a FractionDisplay primitive", () => {
    render(<WhiteboardCanvas elements={[fractionDisplayFix]} />);
    expect(screen.getByTestId("fraction-display-fd-1")).toBeTruthy();
  });

  it("renders an Operation primitive", () => {
    render(<WhiteboardCanvas elements={[operationFix]} />);
    expect(screen.getByTestId("operation-op-1")).toBeTruthy();
  });

  it("renders a StepByStep primitive", () => {
    render(<WhiteboardCanvas elements={[stepByStepFix]} />);
    expect(screen.getByTestId("step-by-step-steps-1")).toBeTruthy();
  });

  it("renders a TextBubble primitive", () => {
    render(<WhiteboardCanvas elements={[textBubbleFix]} />);
    expect(screen.getByTestId("text-bubble-tb-1")).toBeTruthy();
  });

  it("renders an Arrow primitive", () => {
    render(<WhiteboardCanvas elements={[arrowFix]} />);
    expect(screen.getByTestId("arrow-arr-1")).toBeTruthy();
  });

  it("renders a Highlight around a known target", () => {
    render(<WhiteboardCanvas elements={[pieFix, highlightFix]} />);
    expect(screen.getByTestId("highlight-hl-1")).toBeTruthy();
  });

  it("does not render a Highlight when target is missing", () => {
    render(<WhiteboardCanvas elements={[highlightFix]} />);
    expect(screen.queryByTestId("highlight-hl-1")).toBeNull();
  });

  it("renders multiple elements together", () => {
    render(
      <WhiteboardCanvas
        elements={[pieFix, barFix, operationFix, textBubbleFix]}
      />,
    );
    expect(screen.getByTestId("pie-chart-pie-1")).toBeTruthy();
    expect(screen.getByTestId("fraction-bar-bar-1")).toBeTruthy();
    expect(screen.getByTestId("operation-op-1")).toBeTruthy();
    expect(screen.getByTestId("text-bubble-tb-1")).toBeTruthy();
  });

  // ── Command dispatcher ──────────────────────────────────────────

  describe("dispatchCanvasCommands", () => {
    it("draws a new element onto an empty canvas", () => {
      const result = dispatchCanvasCommands([], [
        { action: "draw", element: pieFix },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("pie-1");
    });

    it("replaces an existing element with the same id", () => {
      const updated: PieChart = { ...pieFix, filledSlices: 3 };
      const result = dispatchCanvasCommands([pieFix], [
        { action: "draw", element: updated },
      ]);
      expect(result).toHaveLength(1);
      expect((result[0] as PieChart).filledSlices).toBe(3);
    });

    it("clears a specific element by targetId", () => {
      const result = dispatchCanvasCommands([pieFix, barFix], [
        { action: "clear", targetId: "pie-1" },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("bar-1");
    });

    it("clears the entire canvas when no targetId is given", () => {
      const result = dispatchCanvasCommands([pieFix, barFix], [
        { action: "clear" },
      ]);
      expect(result).toHaveLength(0);
    });

    it("processes multiple commands in order", () => {
      const commands: CanvasCommand[] = [
        { action: "draw", element: pieFix },
        { action: "draw", element: barFix },
        { action: "clear", targetId: "pie-1" },
        { action: "draw", element: textBubbleFix },
      ];
      const result = dispatchCanvasCommands([], commands);
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.id)).toEqual(["bar-1", "tb-1"]);
    });

    it("appending and clearing all leaves an empty array", () => {
      const commands: CanvasCommand[] = [
        { action: "draw", element: pieFix },
        { action: "clear" },
      ];
      const result = dispatchCanvasCommands([], commands);
      expect(result).toHaveLength(0);
    });
  });

  // ── applyCanvasCommands (types.ts) ─────────────────────────────

  describe("applyCanvasCommands", () => {
    it("is a pure function (does not mutate the input)", () => {
      const original: CanvasElement[] = [pieFix];
      const frozen = Object.freeze([...original]);
      const result = applyCanvasCommands(
        frozen as CanvasElement[],
        [{ action: "draw", element: barFix }],
      );
      expect(result).toHaveLength(2);
      expect(frozen).toHaveLength(1); // original unchanged
    });
  });

  // ── Accessibility ──────────────────────────────────────────────

  it("has role=img and an aria-label", () => {
    render(<WhiteboardCanvas elements={[]} />);
    const svg = screen.getByRole("img");
    expect(svg.getAttribute("aria-label")).toBe("Pizarra interactiva");
  });

  // ── Responsive sizing attributes ──────────────────────────────

  it("uses preserveAspectRatio to maintain desktop coords", () => {
    render(<WhiteboardCanvas elements={[]} />);
    const svg = screen.getByTestId("whiteboard-svg");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  });
});
