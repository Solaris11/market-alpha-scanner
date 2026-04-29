import { technicalLabel } from "@/lib/ui/gauge-utils";
import { ConfidenceGauge } from "./ConfidenceGauge";

export function TechnicalGauge({ score }: { score: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <ConfidenceGauge label="Technical Gauge" value={score} />
      <div className="mt-3 text-sm font-semibold text-slate-100">{technicalLabel(score)}</div>
      <div className="mt-1 text-xs text-slate-400">Composite technical score interpreted as a directional bias.</div>
    </div>
  );
}
