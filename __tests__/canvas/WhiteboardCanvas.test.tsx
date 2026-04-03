import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import WhiteboardCanvas from "@/components/canvas/WhiteboardCanvas";
import type {
  PieChart,
  FractionBar,
  NumberLine,
  FractionDisplay,
  TextBubble,
  Arrow,
  Operation,
  StepByStep,
  Highlight,
} from "@/lib/commands/canvasTypes";

// ── Fixtures ─────────────────────────────────────────────────────────

const pieFix: PieChart = {
  type: "PieChart",
  id: "pie-a",
  position: { x: 200, y: 200 },
  radius: 60,
  totalSlices: 4,
  filledSlices: 2,
  label: "2/4",
};

const barFix: FractionBar = {
  type: "FractionBar",
  id: "bar-a",
  position: { x: 50, y: 100 },
  width: 200,
  height: 30,
  totalSegments: 6,
  filledSegments: 4,
  label: "4/6",
};

const numberLineFix: NumberLine = {
  type: "NumberLine",
  id: "nl-a",
  position: { x: 50, y: 300 },
  length: 400,
  min: 0,
  max: 1,
  step: 0.25,
  markers: [0.5, 0.75],
  label: "fracciones",
};

const fractionFix: FractionDisplay = {
  type: "FractionDisplay",
  id: "fd-a",
  position: { x: 400, y: 200 },
  numerator: 3,
  denominator: 4,
  fontSize: 28,
  color: "#6366f1",
};

const textFix: TextBubble = {
  type: "TextBubble",
  id: "tb-a",
  position: { x: 100, y: 80 },
  text: "¡Bienvenido!",
  fontSize: 18,
  backgroundColor: "#e0e7ff",
  textColor: "#3730a3",
  maxWidth: 250,
};

const arrowFix: Arrow = {
  type: "Arrow",
  id: "arr-a",
  from: { x: 100, y: 200 },
  to: { x: 400, y: 200 },
  color: "#334155",
  strokeWidth: 2,
  label: "simplificar",
};

const opFix: Operation = {
  type: "Operation",
  id: "op-a",
  position: { x: 350, y: 200 },
  operator: "+",
  fontSize: 32,
};

const stepsFix: StepByStep = {
  type: "StepByStep",
  id: "sbs-a",
  position: { x: 50, y: 50 },
  steps: [
    { index: 1, text: "Encontrar denominador común", active: true },
    { index: 2, text: "Convertir fracciones", active: false },
    { index: 3, text: "Sumar numeradores", active: false },
  ],
};

const highlightFix: Highlight = {
  type: "Highlight",
  id: "hl-a",
  targetId: "pie-a",
  color: "#facc15",
  style: "glow",
};

afterEach(cleanup);

// ── Render smoke tests for each primitive type ───────────────────────

describe("WhiteboardCanvas – primitive render tests", () => {
  it("renders PieChart with correct number of slices", () => {
    render(<WhiteboardCanvas elements={[pieFix]} />);
    const group = screen.getByTestId("pie-chart-pie-a");
    // 4 slices → 4 <path> elements
    const paths = group.querySelectorAll("path");
    expect(paths).toHaveLength(4);
  });

  it("PieChart filled slices use the filled color", () => {
    render(<WhiteboardCanvas elements={[pieFix]} />);
    const group = screen.getByTestId("pie-chart-pie-a");
    const paths = group.querySelectorAll("path");
    // First 2 slices filled (default indigo), last 2 empty (default slate)
    expect(paths[0].getAttribute("fill")).toBe("#6366f1");
    expect(paths[1].getAttribute("fill")).toBe("#6366f1");
    expect(paths[2].getAttribute("fill")).toBe("#e2e8f0");
  });

  it("PieChart renders a label when provided", () => {
    render(<WhiteboardCanvas elements={[pieFix]} />);
    expect(screen.getByText("2/4")).toBeTruthy();
  });

  it("renders FractionBar with correct number of segments", () => {
    render(<WhiteboardCanvas elements={[barFix]} />);
    const group = screen.getByTestId("fraction-bar-bar-a");
    const rects = group.querySelectorAll("rect");
    expect(rects).toHaveLength(6);
  });

  it("FractionBar filled segments use the filled color", () => {
    render(<WhiteboardCanvas elements={[barFix]} />);
    const group = screen.getByTestId("fraction-bar-bar-a");
    const rects = group.querySelectorAll("rect");
    expect(rects[0].getAttribute("fill")).toBe("#6366f1");
    expect(rects[3].getAttribute("fill")).toBe("#6366f1");
    expect(rects[4].getAttribute("fill")).toBe("#e2e8f0");
  });

  it("renders NumberLine with tick marks", () => {
    render(<WhiteboardCanvas elements={[numberLineFix]} />);
    const group = screen.getByTestId("number-line-nl-a");
    // min=0, max=1, step=0.25 → 5 ticks (0, 0.25, 0.50, 0.75, 1)
    const ticks = group.querySelectorAll("g > line");
    expect(ticks.length).toBeGreaterThanOrEqual(5);
  });

  it("NumberLine renders marker circles", () => {
    render(<WhiteboardCanvas elements={[numberLineFix]} />);
    const group = screen.getByTestId("number-line-nl-a");
    const circles = group.querySelectorAll("circle");
    expect(circles).toHaveLength(2); // markers: [0.5, 0.75]
  });

  it("renders FractionDisplay with numerator and denominator text", () => {
    render(<WhiteboardCanvas elements={[fractionFix]} />);
    const group = screen.getByTestId("fraction-display-fd-a");
    expect(group).toBeTruthy();
    // Check that numerator and denominator are present as text
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("renders TextBubble with visible text", () => {
    render(<WhiteboardCanvas elements={[textFix]} />);
    expect(screen.getByTestId("text-bubble-tb-a")).toBeTruthy();
    expect(screen.getByText("¡Bienvenido!")).toBeTruthy();
  });

  it("TextBubble uses custom colors", () => {
    render(<WhiteboardCanvas elements={[textFix]} />);
    const group = screen.getByTestId("text-bubble-tb-a");
    const rect = group.querySelector("rect");
    expect(rect?.getAttribute("fill")).toBe("#e0e7ff");
    const text = group.querySelector("text");
    expect(text?.getAttribute("fill")).toBe("#3730a3");
  });

  it("renders Arrow with a line", () => {
    render(<WhiteboardCanvas elements={[arrowFix]} />);
    expect(screen.getByTestId("arrow-arr-a")).toBeTruthy();
  });

  it("renders Operation with operator symbol", () => {
    render(<WhiteboardCanvas elements={[opFix]} />);
    expect(screen.getByTestId("operation-op-a")).toBeTruthy();
    expect(screen.getByText("+")).toBeTruthy();
  });

  it("renders StepByStep with all step texts", () => {
    render(<WhiteboardCanvas elements={[stepsFix]} />);
    const group = screen.getByTestId("step-by-step-sbs-a");
    expect(group).toBeTruthy();
    // Text is split across child nodes (index + ". " + text), use textContent
    const texts = group.querySelectorAll("text");
    expect(texts).toHaveLength(3);
    expect(texts[0].textContent).toContain("Encontrar denominador común");
    expect(texts[1].textContent).toContain("Convertir fracciones");
    expect(texts[2].textContent).toContain("Sumar numeradores");
  });

  it("renders Highlight when target element exists", () => {
    render(<WhiteboardCanvas elements={[pieFix, highlightFix]} />);
    expect(screen.getByTestId("highlight-hl-a")).toBeTruthy();
  });

  it("does not render Highlight when target element is missing", () => {
    render(<WhiteboardCanvas elements={[highlightFix]} />);
    expect(screen.queryByTestId("highlight-hl-a")).toBeNull();
  });
});

// ── Composite rendering ──────────────────────────────────────────────

describe("WhiteboardCanvas – composite scenes", () => {
  it("renders a fraction lesson scene (pie + fraction + arrow)", () => {
    render(
      <WhiteboardCanvas elements={[pieFix, fractionFix, arrowFix]} />,
    );
    expect(screen.getByTestId("pie-chart-pie-a")).toBeTruthy();
    expect(screen.getByTestId("fraction-display-fd-a")).toBeTruthy();
    expect(screen.getByTestId("arrow-arr-a")).toBeTruthy();
    expect(screen.queryByTestId("empty-state")).toBeNull();
  });

  it("renders all 9 primitive types simultaneously", () => {
    render(
      <WhiteboardCanvas
        elements={[
          pieFix,
          barFix,
          numberLineFix,
          fractionFix,
          textFix,
          arrowFix,
          opFix,
          stepsFix,
          highlightFix,
        ]}
      />,
    );
    expect(screen.getByTestId("pie-chart-pie-a")).toBeTruthy();
    expect(screen.getByTestId("fraction-bar-bar-a")).toBeTruthy();
    expect(screen.getByTestId("number-line-nl-a")).toBeTruthy();
    expect(screen.getByTestId("fraction-display-fd-a")).toBeTruthy();
    expect(screen.getByTestId("text-bubble-tb-a")).toBeTruthy();
    expect(screen.getByTestId("arrow-arr-a")).toBeTruthy();
    expect(screen.getByTestId("operation-op-a")).toBeTruthy();
    expect(screen.getByTestId("step-by-step-sbs-a")).toBeTruthy();
    expect(screen.getByTestId("highlight-hl-a")).toBeTruthy();
  });
});

// ── High-contrast / accessibility checks ─────────────────────────────

describe("WhiteboardCanvas – accessibility", () => {
  it("SVG has role=img for screen readers", () => {
    render(<WhiteboardCanvas elements={[]} />);
    const svg = screen.getByRole("img");
    expect(svg).toBeTruthy();
  });

  it("SVG has a descriptive aria-label", () => {
    render(<WhiteboardCanvas elements={[]} />);
    const svg = screen.getByRole("img");
    expect(svg.getAttribute("aria-label")).toBe("Pizarra interactiva");
  });

  it("each primitive group has a data-element-id for programmatic access", () => {
    render(<WhiteboardCanvas elements={[pieFix, textFix]} />);
    const pie = screen.getByTestId("pie-chart-pie-a");
    expect(pie.getAttribute("data-element-id")).toBe("pie-a");
    const tb = screen.getByTestId("text-bubble-tb-a");
    expect(tb.getAttribute("data-element-id")).toBe("tb-a");
  });

  it("text elements use sufficient font size for readability", () => {
    render(<WhiteboardCanvas elements={[textFix]} />);
    const textEl = screen.getByTestId("text-bubble-tb-a").querySelector("text");
    // SVG attribute is "font-size" (kebab-case), React renders it from the fontSize prop
    const fontSize = Number(
      textEl?.getAttribute("font-size") || textEl?.getAttribute("fontSize"),
    );
    // WCAG: body text should be at least 16px equivalent
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  it("high-contrast: default filled color differs from empty color", () => {
    render(<WhiteboardCanvas elements={[pieFix]} />);
    const group = screen.getByTestId("pie-chart-pie-a");
    const paths = group.querySelectorAll("path");
    const filledColor = paths[0].getAttribute("fill");
    const emptyColor = paths[2].getAttribute("fill");
    expect(filledColor).not.toBe(emptyColor);
  });

  it("high-contrast: TextBubble textColor contrasts with backgroundColor", () => {
    // textFix uses textColor="#3730a3" (dark indigo) on backgroundColor="#e0e7ff" (light indigo)
    render(<WhiteboardCanvas elements={[textFix]} />);
    const group = screen.getByTestId("text-bubble-tb-a");
    const rect = group.querySelector("rect");
    const text = group.querySelector("text");
    const bg = rect?.getAttribute("fill");
    const fg = text?.getAttribute("fill");
    expect(bg).not.toBe(fg);
    // Both should be present (non-null)
    expect(bg).toBeTruthy();
    expect(fg).toBeTruthy();
  });

  it("PieChart slices have white stroke for visual separation", () => {
    render(<WhiteboardCanvas elements={[pieFix]} />);
    const group = screen.getByTestId("pie-chart-pie-a");
    const paths = group.querySelectorAll("path");
    for (const path of paths) {
      expect(path.getAttribute("stroke")).toBe("#fff");
    }
  });

  it("FractionBar segments have stroke borders for segment separation", () => {
    render(<WhiteboardCanvas elements={[barFix]} />);
    const group = screen.getByTestId("fraction-bar-bar-a");
    const rects = group.querySelectorAll("rect");
    for (const rect of rects) {
      expect(rect.getAttribute("stroke")).toBeTruthy();
    }
  });

  it("empty state has descriptive text for screen readers", () => {
    render(<WhiteboardCanvas elements={[]} />);
    const emptyState = screen.getByTestId("empty-state");
    expect(emptyState).toBeTruthy();
    // Check that there's instructional text
    expect(
      screen.getByText(/pizarra.*vacía|haz una pregunta/i),
    ).toBeTruthy();
  });
});
