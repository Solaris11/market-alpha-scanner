import { decisionGaugePercent } from "@/lib/ui/gauge-utils";
import { DecisionBadge } from "./DecisionBadge";
import { ConfidenceGauge } from "./ConfidenceGauge";

export function DecisionGauge({ finalDecision, recommendationQuality, finalScore }: { finalDecision: unknown; recommendationQuality: unknown; finalScore: unknown }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <DecisionBadge value={finalDecision} />
        <span className="truncate text-xs text-slate-400">{String(recommendationQuality ?? "UNKNOWN")}</span>
      </div>
      <ConfidenceGauge label="Decision Gauge" value={decisionGaugePercent(finalDecision, recommendationQuality, finalScore)} />
    </div>
  );
}
