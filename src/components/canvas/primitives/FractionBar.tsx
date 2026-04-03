import type { FractionBar as FractionBarType } from "@/lib/commands/canvasTypes";
import type { PrimitiveProps } from "../types";

export default function FractionBar({ el }: PrimitiveProps<FractionBarType>) {
  const {
    position,
    width,
    height,
    totalSegments,
    filledSegments,
    filledColor = "#6366f1",
    emptyColor = "#e2e8f0",
    label,
  } = el;
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
        className="animate-[fadeSliceIn_0.35s_ease-out_both]"
        style={{ animationDelay: `${i * 50}ms` }}
      />,
    );
  }

  return (
    <g data-element-id={el.id} data-testid={`fraction-bar-${el.id}`}>
      {segments}
      {label && (
        <text
          x={position.x + width / 2}
          y={position.y + height + 18}
          textAnchor="middle"
          className="text-xs fill-foreground"
        >
          {label}
        </text>
      )}
    </g>
  );
}
