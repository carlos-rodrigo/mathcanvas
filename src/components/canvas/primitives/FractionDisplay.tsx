import type { FractionDisplay as FractionDisplayType } from "@/lib/commands/canvasTypes";
import type { PrimitiveProps } from "../types";

export default function FractionDisplay({
  el,
}: PrimitiveProps<FractionDisplayType>) {
  const {
    position,
    numerator,
    denominator,
    fontSize = 28,
    color = "currentColor",
  } = el;

  return (
    <g
      data-element-id={el.id}
      data-testid={`fraction-display-${el.id}`}
      className="animate-[fadeIn_0.4s_ease-out_both]"
    >
      <text
        x={position.x}
        y={position.y - 4}
        textAnchor="middle"
        fontSize={fontSize}
        fill={color}
        fontWeight={600}
      >
        {numerator}
      </text>
      <line
        x1={position.x - fontSize * 0.6}
        y1={position.y}
        x2={position.x + fontSize * 0.6}
        y2={position.y}
        stroke={color}
        strokeWidth={2}
      />
      <text
        x={position.x}
        y={position.y + fontSize * 0.85}
        textAnchor="middle"
        fontSize={fontSize}
        fill={color}
        fontWeight={600}
      >
        {denominator}
      </text>
      {el.label && (
        <text
          x={position.x}
          y={position.y + fontSize * 1.5}
          textAnchor="middle"
          className="text-xs fill-foreground"
        >
          {el.label}
        </text>
      )}
    </g>
  );
}
