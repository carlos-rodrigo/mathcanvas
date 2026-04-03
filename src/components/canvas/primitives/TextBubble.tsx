import type { TextBubble as TextBubbleType } from "@/lib/commands/canvasTypes";
import type { PrimitiveProps } from "../types";

export default function TextBubble({ el }: PrimitiveProps<TextBubbleType>) {
  const {
    position,
    text,
    fontSize = 16,
    backgroundColor = "#f1f5f9",
    textColor = "#0f172a",
    maxWidth = 220,
  } = el;

  return (
    <g
      data-element-id={el.id}
      data-testid={`text-bubble-${el.id}`}
      className="animate-[fadeIn_0.4s_ease-out_both]"
    >
      <rect
        x={position.x}
        y={position.y - fontSize}
        rx={8}
        ry={8}
        width={maxWidth}
        height={fontSize * 2.4}
        fill={backgroundColor}
      />
      <text
        x={position.x + 10}
        y={position.y + fontSize * 0.3}
        fontSize={fontSize}
        fill={textColor}
      >
        {text}
      </text>
    </g>
  );
}
