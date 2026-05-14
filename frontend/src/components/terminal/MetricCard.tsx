import { pnlClass } from "@/lib/ui/badge-style";

export function MetricCard({ label, value, meta, tone }: { label: string; value: string | number; meta?: string; tone?: "pnl" | "neutral" }) {
  return (
    <div className="tv-card-motion rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 ring-1 ring-white/5">
      <div className="truncate text-[10px] font-semibold uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`tv-score-change mt-2 truncate font-mono text-lg font-semibold ${tone === "pnl" ? pnlClass(value) : "text-slate-100"}`}>{value}</div>
      {meta ? <div className="mt-1 truncate text-xs text-slate-400">{meta}</div> : null}
    </div>
  );
}
