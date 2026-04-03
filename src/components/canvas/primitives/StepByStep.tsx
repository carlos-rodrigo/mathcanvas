import type { StepByStep as StepByStepType } from "@/lib/commands/canvasTypes";
import type { PrimitiveProps } from "../types";

export default function StepByStep({ el }: PrimitiveProps<StepByStepType>) {
  const { position, steps } = el;

  return (
    <g data-element-id={el.id} data-testid={`step-by-step-${el.id}`}>
      {steps.map((s, i) => (
        <text
          key={s.index}
          x={position.x}
          y={position.y + i * 26}
          className="text-sm animate-[fadeIn_0.35s_ease-out_both]"
          style={{ animationDelay: `${i * 100}ms` }}
          fill={s.active ? "#6366f1" : "#64748b"}
          fontWeight={s.active ? 700 : 400}
        >
          {s.index}. {s.text}
        </text>
      ))}
    </g>
  );
}
