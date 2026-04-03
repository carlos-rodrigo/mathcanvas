import type { Arrow as ArrowType } from "@/lib/commands/canvasTypes";
import type { PrimitiveProps } from "../types";

export default function Arrow({ el }: PrimitiveProps<ArrowType>) {
  const {
    from,
    to,
    color = "#334155",
    strokeWidth = 2,
    headSize = 8,
  } = el;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const tipX1 = to.x - headSize * Math.cos(angle - Math.PI / 6);
  const tipY1 = to.y - headSize * Math.sin(angle - Math.PI / 6);
  const tipX2 = to.x - headSize * Math.cos(angle + Math.PI / 6);
  const tipY2 = to.y - headSize * Math.sin(angle + Math.PI / 6);

  return (
    <g
      data-element-id={el.id}
      data-testid={`arrow-${el.id}`}
      className="animate-[fadeIn_0.3s_ease-out_both]"
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <polygon
        points={`${to.x},${to.y} ${tipX1},${tipY1} ${tipX2},${tipY2}`}
        fill={color}
      />
      {el.label && (
        <text
          x={(from.x + to.x) / 2}
          y={(from.y + to.y) / 2 - 8}
          textAnchor="middle"
          className="text-[10px] fill-foreground"
        >
          {el.label}
        </text>
      )}
    </g>
  );
}
