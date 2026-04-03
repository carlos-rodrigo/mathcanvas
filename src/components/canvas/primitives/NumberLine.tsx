import type { NumberLine as NumberLineType } from "@/lib/commands/canvasTypes";
import type { PrimitiveProps } from "../types";

export default function NumberLine({ el }: PrimitiveProps<NumberLineType>) {
  const { position, length, min, max, step, markers = [], label } = el;
  const ticks: React.ReactElement[] = [];
  const count = Math.round((max - min) / step);

  for (let i = 0; i <= count; i++) {
    const val = min + i * step;
    const x = position.x + (i / count) * length;
    ticks.push(
      <g key={i}>
        <line
          x1={x}
          y1={position.y - 6}
          x2={x}
          y2={position.y + 6}
          stroke="#64748b"
          strokeWidth={1}
        />
        <text
          x={x}
          y={position.y + 20}
          textAnchor="middle"
          className="text-[10px] fill-foreground"
        >
          {Number.isInteger(val) ? val : val.toFixed(2)}
        </text>
      </g>,
    );
  }

  const markerEls = markers.map((m) => {
    const x = position.x + ((m - min) / (max - min)) * length;
    return (
      <circle
        key={`m-${m}`}
        cx={x}
        cy={position.y}
        r={5}
        fill="#ef4444"
        className="animate-[popIn_0.3s_ease-out_both]"
      />
    );
  });

  return (
    <g data-element-id={el.id} data-testid={`number-line-${el.id}`}>
      <line
        x1={position.x}
        y1={position.y}
        x2={position.x + length}
        y2={position.y}
        stroke="#334155"
        strokeWidth={2}
        className="animate-[drawLine_0.5s_ease-out_both]"
      />
      {ticks}
      {markerEls}
      {label && (
        <text
          x={position.x + length / 2}
          y={position.y + 36}
          textAnchor="middle"
          className="text-xs fill-foreground"
        >
          {label}
        </text>
      )}
    </g>
  );
}
