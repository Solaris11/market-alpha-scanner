import type { ReactNode } from "react";

export type VisualTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

const TONE: Record<VisualTone, { bg: string; border: string; fill: string; hex: string; soft: string; text: string }> = {
  amber: { bg: "bg-amber-400/10", border: "border-amber-300/25", fill: "from-amber-300 to-yellow-200", hex: "#fbbf24", soft: "bg-amber-300/15", text: "text-amber-100" },
  cyan: { bg: "bg-cyan-400/10", border: "border-cyan-300/25", fill: "from-cyan-300 to-sky-300", hex: "#22d3ee", soft: "bg-cyan-300/15", text: "text-cyan-100" },
  emerald: { bg: "bg-emerald-400/10", border: "border-emerald-300/25", fill: "from-emerald-300 to-teal-200", hex: "#34d399", soft: "bg-emerald-300/15", text: "text-emerald-100" },
  rose: { bg: "bg-rose-400/10", border: "border-rose-300/25", fill: "from-rose-300 to-pink-300", hex: "#fb7185", soft: "bg-rose-300/15", text: "text-rose-100" },
  violet: { bg: "bg-violet-400/10", border: "border-violet-300/25", fill: "from-violet-300 to-fuchsia-300", hex: "#a78bfa", soft: "bg-violet-300/15", text: "text-violet-100" },
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toneForValue(value: number): VisualTone {
  if (value >= 70) return "emerald";
  if (value >= 50) return "amber";
  if (value <= 35) return "rose";
  return "cyan";
}

function compactValues(values: Array<number | null | undefined>, limit = 24): number[] {
  return values.filter((value): value is number => Number.isFinite(value)).slice(-limit);
}

function formatValue(value: number | null | undefined): string {
  const safe = finiteNumber(value);
  return safe === null ? "N/A" : `${Math.round(safe)}`;
}

function EmptyVisual({
  className = "",
  message,
}: {
  className?: string;
  message: string;
}) {
  return (
    <div className={`grid min-h-20 place-items-center rounded-2xl border border-dashed border-white/10 bg-slate-950/45 px-4 py-5 text-center text-xs leading-5 text-slate-500 ${className}`}>
      {message}
    </div>
  );
}

export function VisualMetricRail({
  metrics,
}: {
  metrics: Array<{ label: string; tone?: VisualTone; value: number | null }>;
}) {
  const visible = metrics
    .map((metric) => ({ ...metric, value: finiteNumber(metric.value) }))
    .filter((metric): metric is { label: string; tone?: VisualTone; value: number } => metric.value !== null)
    .slice(0, 5);

  if (!visible.length) return <EmptyVisual message="Data unavailable" />;

  return (
    <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
      {visible.map((metric) => {
        const tone = metric.tone ?? toneForValue(metric.value);
        const style = TONE[tone];
        const value = clamp(metric.value);
        return (
          <div className="grid gap-1" key={`${metric.label}:${metric.value}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{metric.label}</span>
              <span className={`font-mono text-[11px] font-black ${style.text}`}>{Math.round(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div className={`h-full rounded-full bg-gradient-to-r ${style.fill}`} style={{ width: `${value}%` }} />
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
  emptyMessage = "No validated trend history yet.",
  tone = "cyan",
  values,
}: {
  className?: string;
  emptyMessage?: string;
  label: string;
  tone?: VisualTone;
  values: Array<number | null | undefined>;
}) {
  const data = compactValues(values);
  const style = TONE[tone];
  const min = data.length ? Math.min(...data) : 0;
  const max = data.length ? Math.max(...data) : 100;
  const range = Math.max(1, max - min);
  const points = data
    .map((value, index) => {
      const x = data.length === 1 ? 0 : (index / (data.length - 1)) * 100;
      const y = 52 - ((value - min) / range) * 44;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-950/45 p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
        <div className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-black ${style.soft} ${style.text}`}>
          {data.length >= 2 ? `${data.length} pts` : "Limited"}
        </div>
      </div>
      {data.length >= 2 ? (
        <svg aria-label={`${label}: ${data.length} validated points`} className="h-20 w-full overflow-visible" role="img" viewBox="0 0 100 60" preserveAspectRatio="none">
          <path d="M0 58H100" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
          <path d="M0 32H100" stroke="rgba(148,163,184,0.10)" strokeDasharray="3 5" strokeWidth="1" />
          <polyline fill="none" points={points} stroke={style.hex} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <EmptyVisual className="h-20" message={emptyMessage} />
      )}
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

export function PosterGauge({
  label,
  score,
  tone = "cyan",
}: {
  label: string;
  score: number | null;
  tone?: VisualTone;
}) {
  const safe = finiteNumber(score);
  const value = safe === null ? null : clamp(safe);
  const style = TONE[tone];
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      {value === null ? (
        <EmptyVisual message="Limited evidence" />
      ) : (
        <div className="mx-auto grid h-32 w-32 place-items-center rounded-full border border-white/10" style={{ background: `conic-gradient(${style.hex} ${value * 3.6}deg, rgba(148,163,184,0.13) 0deg)` }}>
          <div className="grid h-24 w-24 place-items-center rounded-full border border-white/10 bg-slate-950/95">
            <div>
              <div className={`font-mono text-3xl font-black ${style.text}`}>{Math.round(value)}</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MiniCandleStrip({
  className = "",
  emptyMessage = "No validated visual history yet.",
  tone = "cyan",
  values,
}: {
  className?: string;
  emptyMessage?: string;
  tone?: VisualTone;
  values: Array<number | null | undefined>;
}) {
  const data = compactValues(values, 18);
  const style = TONE[tone];
  const min = data.length ? Math.min(...data) : 0;
  const max = data.length ? Math.max(...data) : 100;
  const range = Math.max(1, max - min);
  return (
    <div className={`poster-mini-chart rounded-2xl border border-white/10 bg-slate-950/45 p-3 ${className}`}>
      {data.length >= 2 ? (
        <div className="flex h-24 items-end gap-1.5">
          {data.map((value, index) => {
            const previous = index === 0 ? value : data[index - 1] ?? value;
            const positive = value >= previous;
            const height = Math.max(12, ((value - min) / range) * 82 + 10);
            return (
              <div
                aria-hidden="true"
                className={`flex-1 rounded-t-md ${positive ? `bg-gradient-to-t ${style.fill}` : "bg-gradient-to-t from-rose-400 to-pink-300"}`}
                key={`${index}:${value}`}
                style={{ height }}
              />
            );
          })}
        </div>
      ) : (
        <EmptyVisual className="h-24" message={emptyMessage} />
      )}
    </div>
  );
}

export type ScoreFactor = {
  detail?: string;
  label: string;
  tone?: VisualTone;
  value: number | null | undefined;
};

export function ScoreFactorStrip({
  className = "",
  emptyMessage = "Insufficient scored evidence for a visual breakdown.",
  factors,
  label = "Data-backed factors",
}: {
  className?: string;
  emptyMessage?: string;
  factors: ScoreFactor[];
  label?: string;
}) {
  const data = factors
    .map((factor) => ({ ...factor, value: finiteNumber(factor.value) }))
    .filter((factor): factor is ScoreFactor & { value: number } => factor.value !== null)
    .slice(0, 7)
    .map((factor) => ({ ...factor, tone: factor.tone ?? toneForValue(factor.value), value: clamp(factor.value) }));

  if (!data.length) {
    return (
      <div className={`rounded-2xl border border-dashed border-white/10 bg-slate-950/35 p-3 ${className}`}>
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
        <EmptyVisual className="mt-2" message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-950/35 p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
        <div className="text-[10px] font-bold text-slate-500">{data.length} drivers</div>
      </div>
      <div className="grid gap-2">
        {data.map((factor) => {
          const style = TONE[factor.tone];
          return (
            <div className="grid gap-1" key={`${factor.label}:${factor.value}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-black uppercase tracking-[0.11em] text-slate-500">{factor.label}</span>
                <span className={`font-mono text-[11px] font-black ${style.text}`}>{Math.round(factor.value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div className={`h-full rounded-full bg-gradient-to-r ${style.fill}`} style={{ width: `${factor.value}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function IconInsightRail({
  items,
}: {
  items: Array<{ copy?: string; icon: ReactNode; label: string; tone?: VisualTone }>;
}) {
  return (
    <div className="poster-icon-row overflow-hidden rounded-2xl border border-cyan-300/16 bg-slate-950/45">
      {items.map((item) => {
        const tone = TONE[item.tone ?? "cyan"];
        return (
          <div className="poster-icon-cell" key={item.label}>
            <div className={`poster-icon-orb ${tone.text}`}>{item.icon}</div>
            <div className="text-xs font-black uppercase leading-4 tracking-[0.08em] text-slate-100">{item.label}</div>
            {item.copy ? <p className="max-w-[12rem] text-[11px] leading-4 text-slate-400">{item.copy}</p> : null}
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
