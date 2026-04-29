import type { SignalHistoryPoint } from "@/lib/adapters/DataServiceAdapter";
import { formatNumber } from "@/lib/ui/formatters";
import { DecisionBadge } from "./DecisionBadge";
import { EmptyState } from "./ui/EmptyState";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function ConvictionTimeline({ points }: { points: SignalHistoryPoint[] }) {
  if (!points.length) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Signal Memory" title="Conviction Timeline" />
        <div className="mt-4"><EmptyState title="No signal history yet" message="Scanner history will populate this timeline once snapshots are available." /></div>
      </GlassPanel>
    );
  }
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Signal Memory" title="Conviction Timeline" meta={`${points.length} points`} />
      <div className="mt-4 space-y-3">
        {points.slice(-10).reverse().map((point) => (
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs md:grid-cols-[120px_90px_1fr]" key={`${point.timestamp}-${point.final_score}`}>
            <div className="text-slate-400">{new Date(point.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
            <div className="font-mono text-slate-100">{formatNumber(point.final_score)}</div>
            <div className="flex flex-wrap items-center gap-2">
              <DecisionBadge value={point.final_decision} />
              <span className="text-slate-400">{point.recommendation_quality}</span>
              <span className="text-slate-500">{point.rating}</span>
              <span className="text-slate-500">{point.entry_status}</span>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
