import {
  formatMemoryDate,
  formatMemoryPercent,
  formatMemoryReturn,
  memoryReasonLabel,
  type EvidenceMaturityTier,
  type MarketMemorySummary,
} from "@/lib/trading/market-memory";
import { decisionLabel, humanizeLabel } from "@/lib/ui/labels";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function MarketMemoryCard({ memory }: { memory: MarketMemorySummary }) {
  const tone = evidenceTone(memory.evidence.tier);
  const topAnalogs = memory.analogs.slice(0, 3);
  return (
    <GlassPanel className="p-6">
      <SectionTitle eyebrow="Market Memory" title="Similar Historical Setups" meta={memory.evidence.label} />
      <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${tone.pill}`}>{memory.evidence.label}</div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{memory.evidence.explanation}</p>

      {memory.available ? (
        <>
          {memory.outcome ? (
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Metric label="Analogs" value={String(memory.evidence.sampleSize)} />
              <Metric label={`${memory.outcome.horizon} Median`} tone={(memory.outcome.medianReturn ?? 0) >= 0 ? "positive" : "negative"} value={formatMemoryReturn(memory.outcome.medianReturn)} />
              <Metric label="Positive Rate" tone="positive" value={formatMemoryPercent(memory.outcome.winRate)} />
              <Metric label="Worst Analog" tone="negative" value={formatMemoryReturn(memory.outcome.downsideRisk)} />
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">
              Similar setup memory exists, but forward-return outcomes are still incomplete for this cluster.
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-50">
            {memory.narrative.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {topAnalogs.map((analog) => (
              <div key={`${analog.symbol}-${analog.signalTimestamp}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-lg font-black text-slate-50">{analog.symbol}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatMemoryDate(analog.signalTimestamp)}</div>
                  </div>
                  <div className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-100">{analog.similarityScore}% similar</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                  <span>{humanizeLabel(analog.setupType, "Unknown setup")}</span>
                  <span>{humanizeLabel(analog.marketRegime, "Unknown regime")}</span>
                  <span>{decisionLabel(analog.decision)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {analog.reasonCodes.slice(0, 4).map((reason) => (
                    <span key={reason} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-semibold text-slate-400">
                      {memoryReasonLabel(reason)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-slate-400">
          Market Memory will become more useful as historical scan snapshots and outcome records accumulate. This panel intentionally stays quiet until comparable evidence exists.
        </div>
      )}
    </GlassPanel>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" | "negative" }) {
  const color = tone === "positive" ? "text-emerald-200" : tone === "negative" ? "text-rose-200" : "text-slate-100";
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="min-w-0 truncate text-[10px] font-semibold uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-2 font-mono text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function evidenceTone(tier: EvidenceMaturityTier) {
  if (tier === "high") return { pill: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100" };
  if (tier === "moderate") return { pill: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100" };
  if (tier === "limited") return { pill: "border-amber-300/25 bg-amber-400/10 text-amber-100" };
  return { pill: "border-white/10 bg-white/[0.04] text-slate-300" };
}
