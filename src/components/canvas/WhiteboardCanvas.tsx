"use client";

import type { CanvasCommand, CanvasElement } from "@/lib/commands/canvasTypes";
import {
  Arrow,
  FractionBar,
  FractionDisplay,
  Highlight,
  NumberLine,
  Operation,
  PieChart,
  StepByStep,
  TextBubble,
} from "./primitives";
import { CANVAS_HEIGHT, CANVAS_WIDTH, applyCanvasCommands } from "./types";

// ── Element dispatcher ───────────────────────────────────────────────

function RenderElement({
  el,
  allElements,
}: {
  el: CanvasElement;
  allElements: CanvasElement[];
}) {
  switch (el.type) {
    case "PieChart":
      return <PieChart el={el} />;
    case "FractionBar":
      return <FractionBar el={el} />;
    case "NumberLine":
      return <NumberLine el={el} />;
    case "FractionDisplay":
      return <FractionDisplay el={el} />;
    case "Operation":
      return <Operation el={el} />;
    case "StepByStep":
      return <StepByStep el={el} />;
    case "TextBubble":
      return <TextBubble el={el} />;
    case "Arrow":
      return <Arrow el={el} />;
    case "Highlight":
      return <Highlight el={el} allElements={allElements} />;
    default:
      return null;
  }
}

// ── Empty-state placeholder ──────────────────────────────────────────

function EmptyState() {
  return (
    <g data-testid="empty-state" className="animate-[fadeIn_0.6s_ease-out_both]">
      {/* Soft grid dots */}
      {Array.from({ length: 7 }).map((_, col) =>
        Array.from({ length: 4 }).map((_, row) => (
          <circle
            key={`dot-${col}-${row}`}
            cx={100 + col * 100}
            cy={100 + row * 100}
            r={2}
            fill="#cbd5e1"
            opacity={0.5}
          />
        )),
      )}
      {/* Pencil icon (simplified) */}
      <g transform="translate(370, 190)" opacity={0.25}>
        <rect x={0} y={0} width={60} height={60} rx={12} fill="#e2e8f0" />
        <text
          x={30}
          y={40}
          textAnchor="middle"
          fontSize={28}
          fill="#94a3b8"
        >
          ✏️
        </text>
      </g>
      <text
        x={CANVAS_WIDTH / 2}
        y={290}
        textAnchor="middle"
        fontSize={16}
        fill="#94a3b8"
        className="animate-[fadeIn_0.8s_ease-out_0.3s_both]"
      >
        La pizarra está vacía — ¡haz una pregunta!
      </text>
    </g>
  );
}

// ── Command dispatcher (pure function) ───────────────────────────────

/**
 * Process a sequence of `CanvasCommand`s against the current element
 * list and return the resulting elements. This is the single entry-point
 * that parent components should use when an `AssistantPayload` arrives.
 */
export function dispatchCanvasCommands(
  current: CanvasElement[],
  commands: CanvasCommand[],
): CanvasElement[] {
  return applyCanvasCommands(current, commands);
}

// ── Main component ───────────────────────────────────────────────────

export interface WhiteboardCanvasProps {
  /** Elements currently visible on the canvas. */
  elements: CanvasElement[];
}

export default function WhiteboardCanvas({ elements }: WhiteboardCanvasProps) {
  const isEmpty = elements.length === 0;

  return (
    <svg
      role="img"
      aria-label="Pizarra interactiva"
      data-testid="whiteboard-svg"
      className="h-full w-full select-none"
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Background (transparent — the parent container provides color) */}
      <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="none" />

      {isEmpty ? (
        <EmptyState />
      ) : (
        elements.map((el) => (
          <RenderElement key={el.id} el={el} allElements={elements} />
        ))
      )}
    </svg>
  );
}
