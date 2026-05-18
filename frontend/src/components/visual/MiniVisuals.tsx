import type { ReactNode } from "react";
import {
  PosterFactorBars,
  PosterMetricBars,
  PosterMovementBars,
  PosterRadialGauge,
  PosterTrendChart,
} from "@/components/visual/PosterDataVisuals";

export type VisualTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

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
  return <PosterMetricBars metrics={metrics} />;
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
  return <PosterTrendChart className={className} emptyMessage={emptyMessage} label={label} tone={tone} values={values} />;
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
  return <PosterRadialGauge label={label} score={score} tone={tone} />;
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
  return <PosterMovementBars className={className} emptyMessage={emptyMessage} tone={tone} values={values} />;
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
  return <PosterFactorBars className={className} emptyMessage={emptyMessage} factors={factors} label={label} />;
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
