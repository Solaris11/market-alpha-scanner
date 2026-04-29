import { gaugePercent } from "@/lib/ui/gauge-utils";

export function ConfidenceGauge({ value, label }: { value: unknown; label: string }) {
  const percent = gaugePercent(value);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
        <span className="font-mono text-slate-200">{Math.round(percent)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800/80">
        <div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-300 shadow-[0_0_18px_rgba(45,212,191,0.35)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
