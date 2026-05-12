import type { ReactNode } from "react";

type VisualTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

const TONE: Record<VisualTone, { bg: string; border: string; fill: string; soft: string; text: string }> = {
  amber: { bg: "bg-amber-400/10", border: "border-amber-300/25", fill: "from-amber-300 to-yellow-200", soft: "bg-amber-300/15", text: "text-amber-100" },
  cyan: { bg: "bg-cyan-400/10", border: "border-cyan-300/25", fill: "from-cyan-300 to-sky-300", soft: "bg-cyan-300/15", text: "text-cyan-100" },
  emerald: { bg: "bg-emerald-400/10", border: "border-emerald-300/25", fill: "from-emerald-300 to-teal-200", soft: "bg-emerald-300/15", text: "text-emerald-100" },
  rose: { bg: "bg-rose-400/10", border: "border-rose-300/25", fill: "from-rose-300 to-pink-300", soft: "bg-rose-300/15", text: "text-rose-100" },
  violet: { bg: "bg-violet-400/10", border: "border-violet-300/25", fill: "from-violet-300 to-fuchsia-300", soft: "bg-violet-300/15", text: "text-violet-100" },
};

export function VisualMetricRail({
  metrics,
}: {
  metrics: Array<{ label: string; tone?: VisualTone; value: number | null }>;
}) {
  return (
    <div className="grid gap-2">
      {metrics.map((metric) => {
        const value = clamp(metric.value ?? 0);
        const tone = TONE[metric.tone ?? "cyan"];
        return (
          <div className="min-w-0" key={metric.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              <span className="truncate">{metric.label}</span>
              <span className={tone.text}>{metric.value === null ? "N/A" : Math.round(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <div className={`h-full rounded-full bg-gradient-to-r ${tone.fill} shadow-[0_0_18px_rgba(34,211,238,0.22)]`} style={{ width: `${Math.max(5, value)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MiniSparkline({
  className = "",
  label,
  tone = "cyan",
  values,
}: {
  className?: string;
  label: string;
  tone?: VisualTone;
  values: number[];
}) {
  const safeValues = values.filter(Number.isFinite);
  const points = sparklinePoints(safeValues);
  const toneClass = TONE[tone];
  return (
    <div className={`rounded-2xl border ${toneClass.border} ${toneClass.bg} p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
        <div className={`h-2 w-2 rounded-full ${toneClass.soft}`} />
      </div>
      <svg aria-hidden="true" className="h-16 w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 120 48">
        <path d="M0 38 C18 34 18 20 36 25 S58 42 74 24 94 10 120 15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
        {points ? <polyline fill="none" points={points} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" className={toneClass.text} /> : null}
      </svg>
    </div>
  );
}

export function SignalFlowVisual({
  items,
}: {
  items: Array<{ icon: ReactNode; label: string; tone?: VisualTone }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((item, index) => {
        const tone = TONE[item.tone ?? "cyan"];
        return (
          <div className={`relative rounded-2xl border ${tone.border} ${tone.bg} p-3`} key={item.label}>
            {index < items.length - 1 ? <div className="absolute left-[calc(100%-0.4rem)] top-1/2 hidden h-px w-4 bg-cyan-300/25 sm:block" /> : null}
            <div className="flex items-center gap-2">
              <div className={`visual-icon-tile h-9 w-9 ${tone.text}`}>{item.icon}</div>
              <div className="text-xs font-bold text-slate-100">{item.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HeatDots({
  active,
  total = 12,
  tone = "cyan",
}: {
  active: number;
  total?: number;
  tone?: VisualTone;
}) {
  const toneClass = TONE[tone];
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {Array.from({ length: total }).map((_, index) => (
        <span
          aria-hidden="true"
          className={`h-2 rounded-full ${index < active ? `bg-gradient-to-r ${toneClass.fill}` : "bg-white/[0.08]"}`}
          key={index}
        />
      ))}
    </div>
  );
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function sparklinePoints(values: number[]): string | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 120;
      const y = 42 - ((value - min) / spread) * 34;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
