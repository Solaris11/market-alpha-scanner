import type { HistoricalEdgeProof } from "@/lib/trading/edge-proof";
import { formatPercent } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function HistoricalEdgeCard({ edge }: { edge: HistoricalEdgeProof }) {
  return (
    <GlassPanel className="p-6">
      <SectionTitle eyebrow="Historical Edge" title="Does This Setup Work?" meta={edge.available ? edge.bestHorizon : "insufficient data"} />
      {edge.available ? (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Metric label="Win Rate" value={formatPercent(edge.winRate, 0)} tone="positive" />
            <Metric label="Avg Return" value={formatPercent(edge.avgReturn, 2)} tone={(edge.avgReturn ?? 0) >= 0 ? "positive" : "negative"} />
            <Metric label="Sample Size" value={`${edge.sampleSize} trades`} />
          </div>
          <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-50">
            Based on similar setups: <span className="font-semibold">{edge.groupLabel}</span>
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">
          Not enough historical data. {edge.sampleSize ? `${edge.sampleSize} similar observations found; at least 20 are needed for a reliable read.` : "Performance history will populate this card over time."}
        </div>
      )}
    </GlassPanel>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" | "negative" }) {
  const color = tone === "positive" ? "text-emerald-200" : tone === "negative" ? "text-rose-200" : "text-slate-100";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
