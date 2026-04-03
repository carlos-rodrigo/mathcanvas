import type { CanvasElement, Highlight as HighlightType } from "@/lib/commands/canvasTypes";
import type { HighlightPrimitiveProps } from "../types";

/**
 * Resolve the visual center of a target element. Falls back to `position`
 * if available, otherwise returns `null`.
 */
function resolveCenter(
  target: CanvasElement,
): { x: number; y: number } | null {
  if ("position" in target) {
    return (target as { position: { x: number; y: number } }).position;
  }
  // Arrow has from/to – use midpoint.
  if (target.type === "Arrow") {
    return {
      x: (target.from.x + target.to.x) / 2,
      y: (target.from.y + target.to.y) / 2,
    };
  }
  return null;
}

const STYLE_CLASS: Record<NonNullable<HighlightType["style"]>, string> = {
  pulse: "animate-ping",
  glow: "animate-pulse",
  outline: "",
};

export default function Highlight({ el, allElements }: HighlightPrimitiveProps) {
  const target = allElements.find((e) => e.id === el.targetId);
  if (!target) return null;

  const center = resolveCenter(target);
  if (!center) return null;

  const color = el.color ?? "#facc15";
  const style = el.style ?? "pulse";

  return (
    <circle
      data-element-id={el.id}
      data-testid={`highlight-${el.id}`}
      cx={center.x}
      cy={center.y}
      r={30}
      fill="none"
      stroke={color}
      strokeWidth={3}
      className={STYLE_CLASS[style]}
      opacity={0.7}
    />
  );
}
