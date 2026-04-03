import type { Operation as OperationType } from "@/lib/commands/canvasTypes";
import type { PrimitiveProps } from "../types";

export default function Operation({ el }: PrimitiveProps<OperationType>) {
  const { position, operator, fontSize = 32, color = "currentColor" } = el;

  return (
    <text
      data-element-id={el.id}
      data-testid={`operation-${el.id}`}
      x={position.x}
      y={position.y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={fontSize}
      fill={color}
      fontWeight={700}
      className="animate-[fadeIn_0.3s_ease-out_both]"
    >
      {operator}
    </text>
  );
}
