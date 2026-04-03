"use client";

import type {
  Arrow,
  CanvasElement,
  FractionBar,
  FractionDisplay,
  Highlight,
  NumberLine,
  Operation,
  PieChart,
  StepByStep,
  TextBubble,
} from "@/lib/commands/canvasTypes";

// ── Individual element renderers ─────────────────────────────────────

function RenderPieChart({ el }: { el: PieChart }) {
  const { position, radius, totalSlices, filledSlices, filledColor = "#6366f1", emptyColor = "#e2e8f0", label } = el;
  const slices: React.ReactElement[] = [];

  for (let i = 0; i < totalSlices; i++) {
    const startAngle = (i / totalSlices) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((i + 1) / totalSlices) * 2 * Math.PI - Math.PI / 2;
    const x1 = position.x + radius * Math.cos(startAngle);
    const y1 = position.y + radius * Math.sin(startAngle);
    const x2 = position.x + radius * Math.cos(endAngle);
    const y2 = position.y + radius * Math.sin(endAngle);
    const largeArc = 1 / totalSlices > 0.5 ? 1 : 0;
    const d = `M ${position.x} ${position.y} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    slices.push(
      <path
        key={i}
        d={d}
        fill={i < filledSlices ? filledColor : emptyColor}
        stroke="#fff"
        strokeWidth={2}
      />,
    );
  }

  return (
    <g data-element-id={el.id}>
      {slices}
      {label && (
        <text x={position.x} y={position.y + radius + 18} textAnchor="middle" className="text-xs fill-foreground">
          {label}
        </text>
      )}
    </g>
  );
}

function RenderFractionBar({ el }: { el: FractionBar }) {
  const { position, width, height, totalSegments, filledSegments, filledColor = "#6366f1", emptyColor = "#e2e8f0", label } = el;
  const segW = width / totalSegments;
  const segments: React.ReactElement[] = [];

  for (let i = 0; i < totalSegments; i++) {
    segments.push(
      <rect
        key={i}
        x={position.x + i * segW}
        y={position.y}
        width={segW}
        height={height}
        fill={i < filledSegments ? filledColor : emptyColor}
        stroke="#94a3b8"
        strokeWidth={1}
        rx={2}
      />,
    );
  }

  return (
    <g data-element-id={el.id}>
      {segments}
      {label && (
        <text x={position.x + width / 2} y={position.y + height + 18} textAnchor="middle" className="text-xs fill-foreground">
          {label}
        </text>
      )}
    </g>
  );
}

function RenderNumberLine({ el }: { el: NumberLine }) {
  const { position, length, min, max, step, markers = [], label } = el;
  const ticks: React.ReactElement[] = [];
  const count = Math.round((max - min) / step);

  for (let i = 0; i <= count; i++) {
    const val = min + i * step;
    const x = position.x + (i / count) * length;
    ticks.push(
      <g key={i}>
        <line x1={x} y1={position.y - 6} x2={x} y2={position.y + 6} stroke="#64748b" strokeWidth={1} />
        <text x={x} y={position.y + 20} textAnchor="middle" className="text-[10px] fill-foreground">
          {Number.isInteger(val) ? val : val.toFixed(2)}
        </text>
      </g>,
    );
  }

  const markerEls = markers.map((m) => {
    const x = position.x + ((m - min) / (max - min)) * length;
    return <circle key={`m-${m}`} cx={x} cy={position.y} r={5} fill="#ef4444" />;
  });

  return (
    <g data-element-id={el.id}>
      <line x1={position.x} y1={position.y} x2={position.x + length} y2={position.y} stroke="#334155" strokeWidth={2} />
      {ticks}
      {markerEls}
      {label && (
        <text x={position.x + length / 2} y={position.y + 36} textAnchor="middle" className="text-xs fill-foreground">
          {label}
        </text>
      )}
    </g>
  );
}

function RenderFractionDisplay({ el }: { el: FractionDisplay }) {
  const { position, numerator, denominator, fontSize = 28, color = "currentColor" } = el;
  return (
    <g data-element-id={el.id}>
      <text x={position.x} y={position.y - 4} textAnchor="middle" fontSize={fontSize} fill={color} fontWeight={600}>
        {numerator}
      </text>
      <line x1={position.x - fontSize * 0.6} y1={position.y} x2={position.x + fontSize * 0.6} y2={position.y} stroke={color} strokeWidth={2} />
      <text x={position.x} y={position.y + fontSize * 0.85} textAnchor="middle" fontSize={fontSize} fill={color} fontWeight={600}>
        {denominator}
      </text>
      {el.label && (
        <text x={position.x} y={position.y + fontSize * 1.5} textAnchor="middle" className="text-xs fill-foreground">
          {el.label}
        </text>
      )}
    </g>
  );
}

function RenderOperation({ el }: { el: Operation }) {
  const { position, operator, fontSize = 32, color = "currentColor" } = el;
  return (
    <text data-element-id={el.id} x={position.x} y={position.y} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fill={color} fontWeight={700}>
      {operator}
    </text>
  );
}

function RenderStepByStep({ el }: { el: StepByStep }) {
  const { position, steps } = el;
  return (
    <g data-element-id={el.id}>
      {steps.map((s, i) => (
        <text
          key={s.index}
          x={position.x}
          y={position.y + i * 26}
          className="text-sm"
          fill={s.active ? "#6366f1" : "#64748b"}
          fontWeight={s.active ? 700 : 400}
        >
          {s.index}. {s.text}
        </text>
      ))}
    </g>
  );
}

function RenderTextBubble({ el }: { el: TextBubble }) {
  const { position, text, fontSize = 16, backgroundColor = "#f1f5f9", textColor = "#0f172a", maxWidth = 220 } = el;
  return (
    <g data-element-id={el.id}>
      <rect x={position.x} y={position.y - fontSize} rx={8} ry={8} width={maxWidth} height={fontSize * 2.4} fill={backgroundColor} />
      <text x={position.x + 10} y={position.y + fontSize * 0.3} fontSize={fontSize} fill={textColor}>
        {text}
      </text>
    </g>
  );
}

function RenderArrow({ el }: { el: Arrow }) {
  const { from, to, color = "#334155", strokeWidth = 2, headSize = 8 } = el;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const tipX1 = to.x - headSize * Math.cos(angle - Math.PI / 6);
  const tipY1 = to.y - headSize * Math.sin(angle - Math.PI / 6);
  const tipX2 = to.x - headSize * Math.cos(angle + Math.PI / 6);
  const tipY2 = to.y - headSize * Math.sin(angle + Math.PI / 6);

  return (
    <g data-element-id={el.id}>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={strokeWidth} />
      <polygon points={`${to.x},${to.y} ${tipX1},${tipY1} ${tipX2},${tipY2}`} fill={color} />
      {el.label && (
        <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle" className="text-[10px] fill-foreground">
          {el.label}
        </text>
      )}
    </g>
  );
}

function RenderHighlight({ el, allElements }: { el: Highlight; allElements: CanvasElement[] }) {
  // Highlights target another element; we render a visual indicator around it.
  // In SVG we can only approximate – render a pulsing ring at the target's position.
  const target = allElements.find((e) => e.id === el.targetId);
  if (!target || !("position" in target)) return null;
  const pos = (target as { position: { x: number; y: number } }).position;
  const color = el.color ?? "#facc15";
  const style = el.style ?? "pulse";

  return (
    <circle
      data-element-id={el.id}
      cx={pos.x}
      cy={pos.y}
      r={30}
      fill="none"
      stroke={color}
      strokeWidth={3}
      className={style === "pulse" ? "animate-ping" : style === "glow" ? "animate-pulse" : ""}
      opacity={0.7}
    />
  );
}

// ── Dispatcher ───────────────────────────────────────────────────────

function RenderElement({ el, allElements }: { el: CanvasElement; allElements: CanvasElement[] }) {
  switch (el.type) {
    case "PieChart":
      return <RenderPieChart el={el} />;
    case "FractionBar":
      return <RenderFractionBar el={el} />;
    case "NumberLine":
      return <RenderNumberLine el={el} />;
    case "FractionDisplay":
      return <RenderFractionDisplay el={el} />;
    case "Operation":
      return <RenderOperation el={el} />;
    case "StepByStep":
      return <RenderStepByStep el={el} />;
    case "TextBubble":
      return <RenderTextBubble el={el} />;
    case "Arrow":
      return <RenderArrow el={el} />;
    case "Highlight":
      return <RenderHighlight el={el} allElements={allElements} />;
    default:
      return null;
  }
}

// ── Main component ───────────────────────────────────────────────────

export interface WhiteboardCanvasProps {
  elements: CanvasElement[];
}

export default function WhiteboardCanvas({ elements }: WhiteboardCanvasProps) {
  return (
    <svg
      role="img"
      aria-label="Pizarra interactiva"
      className="h-full w-full select-none"
      viewBox="0 0 800 500"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width="800" height="500" fill="none" />
      {elements.map((el) => (
        <RenderElement key={el.id} el={el} allElements={elements} />
      ))}
    </svg>
  );
}
