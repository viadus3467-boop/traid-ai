import type { AggregateItem, TrendPoint } from "../types";
import { EmptyState, GlassCard, ProgressBar } from "./primitives";

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, radius, endAngle);
  const end = polar(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

const colors = ["#68f0ff", "#4f7bff", "#8f6cff", "#ff7aa2", "#ffc96b", "#80ef9b"];

export function TrendChart({ title, points }: { title: string; points: TrendPoint[] }) {
  if (points.length === 0 || points.every((point) => point.value === 0)) {
    return <EmptyState title={title} description="Пока нет данных для графика расходов." />;
  }

  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <GlassCard>
      <div className="mb-4 text-sm font-medium text-white/75">{title}</div>
      <div className="space-y-3">
        {points.map((point) => (
          <div key={point.dateKey} className="grid grid-cols-[52px_1fr_auto] items-center gap-3">
            <div className="text-xs text-white/42">{point.label}</div>
            <ProgressBar value={(point.value / max) * 100} />
            <div className="text-xs text-white/68">{point.value.toFixed(0)}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

export function DonutChart({
  title,
  items,
}: {
  title: string;
  items: AggregateItem[];
}) {
  if (items.length === 0) {
    return <EmptyState title={title} description="Пока нет данных для круговой диаграммы." />;
  }

  const total = items.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;

  return (
    <GlassCard>
      <div className="mb-4 text-sm font-medium text-white/75">{title}</div>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0">
          <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="16" />
          {items.map((item, index) => {
            const angle = (item.value / total) * 360;
            const path = describeArc(60, 60, 38, cursor, cursor + angle);
            cursor += angle;
            return (
              <path
                key={item.label}
                d={path}
                fill="none"
                stroke={colors[index % colors.length]}
                strokeLinecap="round"
                strokeWidth="16"
              />
            );
          })}
        </svg>
        <div className="min-w-0 flex-1 space-y-3">
          {items.slice(0, 6).map((item, index) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="truncate text-white/70">{item.label}</span>
              </div>
              <span className="font-medium text-white">{item.value.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
