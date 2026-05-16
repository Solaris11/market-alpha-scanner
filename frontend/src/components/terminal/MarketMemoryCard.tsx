import {
  formatMemoryDate,
  formatMemoryPercent,
  formatMemoryReturn,
  memoryReasonLabel,
  type EvidenceMaturityTier,
  type MarketMemorySummary,
} from "@/lib/trading/market-memory";
import { Brain, CalendarClock, GitCompareArrows, Target } from "lucide-react";
import { decisionLabel, humanizeLabel } from "@/lib/ui/labels";
import {
  CinematicClusterMosaic,
  CinematicHeatMatrix,
  CinematicTimeline,
  type CinematicCluster,
  type CinematicHeatCell,
  type CinematicTimelineItem,
} from "@/components/visual/CinematicIntelligencePanels";
import type { ScoreFactor, VisualTone } from "@/components/visual/MiniVisuals";
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
          <MarketMemoryCinematicSystem memory={memory} />

          {memory.outcome ? (
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Metric label="Analogs" value={String(memory.evidence.sampleSize)} />
              <Metric label={`${memory.outcome.horizon} Median`} tone={(memory.outcome.medianReturn ?? 0) >= 0 ? "positive" : "negative"} value={formatMemoryReturn(memory.outcome.medianReturn)} />
              <Metric label="Positive Rate" tone="positive" value={formatMemoryPercent(memory.outcome.winRate)} />
              <Metric label="Worst Analog" tone="negative" value={formatMemoryReturn(memory.outcome.downsideRisk)} />
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">
              Similar setup memory exists, but later outcomes are still incomplete for this group.
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

function MarketMemoryCinematicSystem({ memory }: { memory: MarketMemorySummary }) {
  const analogs = memory.analogs.slice(0, 6);
  const similarityValues = analogs.map((analog) => analog.similarityScore);
  const outcomeValues = analogs
    .flatMap((analog) => analog.outcomes.map((outcome) => outcome.returnPct))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .map((value) => Math.max(0, Math.min(100, 50 + value * 2)));
  const memoryScore = analogs.length ? Math.round(analogs.reduce((sum, analog) => sum + analog.similarityScore, 0) / analogs.length) : null;
  const winRateScore = memory.outcome?.winRate !== null && memory.outcome?.winRate !== undefined ? Math.round(memory.outcome.winRate * 100) : null;
  const medianReturnScore = memory.outcome?.medianReturn !== null && memory.outcome?.medianReturn !== undefined ? Math.round(Math.max(0, Math.min(100, 50 + memory.outcome.medianReturn * 3))) : null;
  const downsideScore = memory.outcome?.downsideRisk !== null && memory.outcome?.downsideRisk !== undefined ? Math.round(Math.max(0, Math.min(100, 100 + memory.outcome.downsideRisk * 3))) : null;

  const factors: ScoreFactor[] = [
    memoryFactor("Analogs", evidenceScore(memory.evidence.tier, memory.evidence.sampleSize), "violet"),
    memoryFactor("Similarity", memoryScore, "cyan"),
    memoryFactor("Positive rate", winRateScore, "emerald"),
    memoryFactor("Downside", downsideScore, "rose"),
  ];

  const clusters: CinematicCluster[] = [
    {
      emptyMessage: "Market Memory is waiting for comparable historical setup evidence.",
      eyebrow: "Memory system",
      factors,
      footer: `${memory.evidence.sampleSize} comparable samples - research context only.`,
      icon: <Brain className="h-6 w-6" />,
      items: analogs.slice(0, 4).map((analog) => ({
        detail: [humanizeLabel(analog.setupType, "Unknown setup"), humanizeLabel(analog.marketRegime, "Unknown regime"), decisionLabel(analog.decision)].join(" / "),
        href: `/symbol/${encodeURIComponent(analog.symbol)}`,
        label: analog.symbol,
        tone: toneForSimilarity(analog.similarityScore),
        value: `${analog.similarityScore}%`,
      })),
      metricLabel: "avg similarity",
      score: memoryScore,
      summary: memory.evidence.explanation,
      title: "Historical Analog Engine",
      tone: "violet",
      values: similarityValues,
    },
    {
      emptyMessage: "Later outcome history is not complete for this memory group yet.",
      eyebrow: "Outcome memory",
      footer: "Historical outcomes are context, not a forecast.",
      icon: <Target className="h-6 w-6" />,
      items: memory.outcome
        ? [
            { label: `${memory.outcome.horizon} median`, tone: toneForReturn(memory.outcome.medianReturn), value: formatMemoryReturn(memory.outcome.medianReturn) },
            { label: "Positive rate", tone: "emerald", value: formatMemoryPercent(memory.outcome.winRate) },
            { label: "Average", tone: toneForReturn(memory.outcome.averageReturn), value: formatMemoryReturn(memory.outcome.averageReturn) },
            { label: "Worst analog", tone: "rose", value: formatMemoryReturn(memory.outcome.downsideRisk) },
          ]
        : [],
      metric: memory.outcome ? formatMemoryReturn(memory.outcome.medianReturn) : "Limited",
      metricLabel: memory.outcome ? `${memory.outcome.horizon} median` : "outcomes",
      summary: memory.outcome
        ? "Later outcomes from similar historical setups are grouped into a compact risk and expectancy view."
        : "Comparable setups exist, but their later outcome windows are still incomplete.",
      title: "What Happened Then",
      tone: memory.outcome ? toneForReturn(memory.outcome.medianReturn) : "amber",
      values: outcomeValues,
    },
    {
      emptyMessage: "No validated analog factor overlap is available yet.",
      eyebrow: "Comparison matrix",
      footer: "Click a symbol chip to open its detail page.",
      icon: <GitCompareArrows className="h-6 w-6" />,
      items: analogs.slice(0, 4).flatMap((analog) =>
        analog.reasonCodes.slice(0, 1).map((reason) => ({
          detail: `${analog.symbol} matched on ${memoryReasonLabel(reason)}.`,
          href: `/symbol/${encodeURIComponent(analog.symbol)}`,
          label: analog.symbol,
          tone: toneForSimilarity(analog.similarityScore),
          value: memoryReasonLabel(reason),
        })),
      ),
      metric: `${memory.evidence.sampleSize}`,
      metricLabel: "factor matches",
      summary: "Memory comparisons are based on setup, market regime, sector, score bucket, decision state, and event or macro signatures when available.",
      title: "Current vs Historical Context",
      tone: "cyan",
      values: similarityValues.slice().reverse(),
    },
    {
      emptyMessage: "No memory timeline is available yet.",
      eyebrow: "Memory freshness",
      footer: "New analogs appear as scanner snapshots mature.",
      icon: <CalendarClock className="h-6 w-6" />,
      items: analogs.slice(0, 4).map((analog) => ({
        detail: `${formatMemoryDate(analog.signalTimestamp)} - ${humanizeLabel(analog.marketRegime, "Unknown regime")}`,
        href: `/symbol/${encodeURIComponent(analog.symbol)}`,
        label: analog.symbol,
        tone: toneForSimilarity(analog.similarityScore),
        value: formatMemoryDate(analog.signalTimestamp),
      })),
      metric: memory.evidence.label,
      metricLabel: "evidence",
      summary: "The memory layer stays quiet when comparable evidence is weak, and becomes denser as validated historical snapshots accumulate.",
      title: "Memory Timeline",
      tone: memory.evidence.tier === "high" ? "emerald" : memory.evidence.tier === "moderate" ? "cyan" : "amber",
      values: similarityValues,
    },
  ];

  const heatCells: CinematicHeatCell[] = analogs.map((analog) => ({
    detail: analog.reasonCodes.slice(0, 3).map(memoryReasonLabel).join(" / ") || "Similarity match only.",
    href: `/symbol/${encodeURIComponent(analog.symbol)}`,
    label: analog.symbol,
    tone: toneForSimilarity(analog.similarityScore),
    value: analog.similarityScore,
  }));

  const timelineItems: CinematicTimelineItem[] = analogs.map((analog) => ({
    detail: [humanizeLabel(analog.setupType, "Unknown setup"), humanizeLabel(analog.marketRegime, "Unknown regime"), decisionLabel(analog.decision)].join(" / "),
    href: `/symbol/${encodeURIComponent(analog.symbol)}`,
    label: analog.symbol,
    metric: `${analog.similarityScore}% similar`,
    timestamp: formatMemoryDate(analog.signalTimestamp),
    tone: toneForSimilarity(analog.similarityScore),
  }));

  return (
    <div className="mt-5 space-y-4">
      <CinematicClusterMosaic
        clusters={clusters}
        eyebrow="Market memory intelligence"
        summary="Validated analogs, outcome windows, factor overlap, and freshness are grouped into one memory surface."
        title="Market Memory Cognition System"
      />
      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <CinematicHeatMatrix cells={heatCells} emptyMessage="Not enough validated analogs to build a memory heatmap yet." title="Analog Similarity Heat" />
        <CinematicTimeline emptyMessage="No comparable memory timeline has been recorded yet." items={timelineItems} title="Historical Setup Timeline" />
      </div>
    </div>
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

function evidenceScore(tier: EvidenceMaturityTier, sampleSize: number): number {
  const sampleScore = Math.min(100, sampleSize * 12);
  if (tier === "high") return Math.max(80, sampleScore);
  if (tier === "moderate") return Math.max(58, Math.min(84, sampleScore));
  if (tier === "limited") return Math.max(28, Math.min(58, sampleScore));
  return 0;
}

function memoryFactor(label: string, value: number | null, tone: VisualTone): ScoreFactor {
  return { label, value, tone };
}

function toneForSimilarity(value: number): VisualTone {
  if (value >= 75) return "emerald";
  if (value >= 60) return "cyan";
  if (value >= 45) return "amber";
  return "violet";
}

function toneForReturn(value: number | null): VisualTone {
  if (value === null || !Number.isFinite(value)) return "amber";
  if (value > 0) return "emerald";
  if (value < 0) return "rose";
  return "cyan";
}
