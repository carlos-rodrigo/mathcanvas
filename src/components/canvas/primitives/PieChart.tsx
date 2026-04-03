import type { PieChart as PieChartType } from "@/lib/commands/canvasTypes";
import type { PrimitiveProps } from "../types";

export default function PieChart({ el }: PrimitiveProps<PieChartType>) {
  const {
    position,
    radius,
    totalSlices,
    filledSlices,
    filledColor = "#6366f1",
    emptyColor = "#e2e8f0",
    label,
  } = el;
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
        className="animate-[fadeSliceIn_0.4s_ease-out_both]"
        style={{ animationDelay: `${i * 60}ms` }}
      />,
    );
  }

  return (
    <g data-element-id={el.id} data-testid={`pie-chart-${el.id}`}>
      {slices}
      {label && (
        <text
          x={position.x}
          y={position.y + radius + 18}
          textAnchor="middle"
          className="text-xs fill-foreground"
        >
          {label}
        </text>
      )}
    </g>
  );
}
