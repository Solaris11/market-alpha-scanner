import type { Metadata } from "next";
import Link from "next/link";
import { BrainCircuit, Database, GitCompareArrows, History, Layers3, ShieldCheck, Target } from "lucide-react";
import type { ReactNode } from "react";
import type { ScoreFactor, VisualTone } from "@/components/visual/MiniVisuals";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SymbolKnowledgeGraphPanel } from "@/components/symbol/SymbolKnowledgeGraphPanel";
import { marketingMetadata } from "@/lib/marketing-seo";
import { getFullRanking } from "@/lib/scanner-data";
import { getMarketMemoryForSignal } from "@/lib/server/market-memory";
import {
  formatMemoryDate,
  formatMemoryPercent,
  formatMemoryReturn,
  memoryReasonLabel,
  type EvidenceMaturityTier,
  type MarketMemoryAnalog,
  type MarketMemorySummary,
} from "@/lib/trading/market-memory";
import { buildSymbolKnowledgeGraphModel } from "@/lib/trading/symbol-knowledge-graph";
import { humanizeLabel } from "@/lib/ui/labels";
import type { RankingRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = marketingMetadata("/market-memory", {
  title: "Market Memory — TradeVeto",
  description:
    "Direct TradeVeto Market Memory surface with validated historical analogs, similarity context, outcome evidence, regime memory, and limited-data states. Research only.",
});

type MemorySurfaceRow = {
  memory: MarketMemorySummary;
  row: RankingRow;
};

type MarketMemorySurfaceModel = {
  cacheStatus: "hit" | "miss" | "stale";
  generatedAt: string;
  limitedReason: string | null;
  rows: MemorySurfaceRow[];
  universeCount: number;
};

type MemoryClusterItem = {
  detail?: string;
  href?: string;
  label: string;
  symbol?: string;
  tone?: VisualTone;
  value?: string;
};

type MemoryCluster = {
  emptyMessage?: string;
  eyebrow?: string;
  factors?: ScoreFactor[];
  icon?: ReactNode;
  items?: MemoryClusterItem[];
  metric?: string;
  metricLabel?: string;
  score?: number | null;
  summary: string;
  title: string;
  tone?: VisualTone;
  updatedAt?: string;
  values?: Array<number | null | undefined>;
};

type MemoryHeatCell = {
  detail?: string;
  href?: string;
  label: string;
  tone?: VisualTone;
  value: number | null;
};

type MemoryTimelineItem = {
  detail?: string;
  href?: string;
  label: string;
  metric?: string;
  tone?: VisualTone;
  timestamp?: string;
};

type MarketMemorySurfaceCache = {
  expiresAt: number;
  refresh?: Promise<MarketMemorySurfaceModel>;
  staleUntil: number;
  value: Promise<MarketMemorySurfaceModel>;
};

const MEMORY_CARD_LIMIT = 4;
const SAMPLE_SIZE = 6;
const SURFACE_CACHE_TTL_MS = 120_000;
const SURFACE_STALE_TTL_MS = 15 * 60_000;

let marketMemorySurfaceCache: MarketMemorySurfaceCache | null = null;

export default async function MarketMemoryPage() {
  const model = await loadMarketMemorySurface();
  const allAnalogs = model.rows.flatMap((item) => item.memory.analogs.map((analog) => ({ analog, currentSymbol: item.row.symbol })));
  const strongestAnalog = allAnalogs.slice().sort((left, right) => right.analog.similarityScore - left.analog.similarityScore)[0]?.analog ?? null;
  const analogCount = allAnalogs.length;
  const totalComparableSetups = model.rows.reduce((sum, item) => sum + item.memory.evidence.sampleSize, 0);
  const strongestScore = strongestAnalog?.similarityScore ?? null;
  const clusters = buildMemoryClusters(model);
  const heatCells = buildMemoryHeatCells(model);
  const timelineItems = buildMemoryTimelineItems(model);
  const knowledgeModels = model.rows.slice(0, 3).map((item) =>
    buildSymbolKnowledgeGraphModel({
      contextRows: model.rows.map((rowItem) => rowItem.row),
      generatedAt: model.generatedAt,
      marketMemory: item.memory,
      row: item.row,
    }),
  );

  return (
    <MarketingShell>
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-10">
          <section className="relative overflow-hidden rounded-[2.35rem] border border-violet-300/20 bg-[radial-gradient(circle_at_14%_0%,rgba(167,139,250,0.22),transparent_32rem),radial-gradient(circle_at_90%_10%,rgba(34,211,238,0.14),transparent_28rem),linear-gradient(135deg,rgba(2,8,23,0.98),rgba(15,23,42,0.72))] p-6 shadow-2xl shadow-black/30 ring-1 ring-white/5 sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-violet-200/70 to-transparent" />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.62fr)]">
              <div className="min-w-0">
                <div className="inline-flex rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-violet-100">
                  Market Memory
                </div>
                <h1 className="mt-4 max-w-5xl text-balance text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl">
                  Historical context for today’s market setup.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  Market Memory compares current scanner rows against validated historical setup, regime, score, event, and sector context. When comparable history is missing, TradeVeto shows a limited-memory state instead of inventing analogs.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <HeroMetric detail="Latest production scanner universe." label="Universe" tone="cyan" value={model.universeCount.toLocaleString("en-US")} />
                  <HeroMetric detail={`Route model cache ${model.cacheStatus}.`} label="Cache" tone={cacheStatusTone(model.cacheStatus)} value={model.cacheStatus.toUpperCase()} />
                  <HeroMetric detail="Validated comparable setups across sampled rows." label="Comparables" tone={analogCount ? "emerald" : "amber"} value={totalComparableSetups.toLocaleString("en-US")} />
                  <HeroMetric detail="Strongest observed analog similarity." label="Top Similarity" tone={strongestScore === null ? "amber" : strongestScore >= 70 ? "emerald" : "cyan"} value={strongestScore === null ? "Limited" : `${strongestScore}%`} />
                </div>
                <MemoryTrustStrip model={model} />
              </div>
              <aside className="rounded-3xl border border-white/10 bg-slate-950/46 p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Closest memory</div>
                    <div className="text-2xl font-black text-white">{strongestAnalog ? strongestAnalog.symbol : "Limited"}</div>
                  </div>
                </div>
                {strongestAnalog ? (
                  <div className="mt-5 space-y-3">
                    <p className="text-sm leading-6 text-slate-300">
                      {strongestAnalog.symbol} on {formatMemoryDate(strongestAnalog.signalTimestamp)} is the strongest current analog at {strongestAnalog.similarityScore}% similarity.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {strongestAnalog.reasonCodes.slice(0, 4).map((code) => (
                        <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-2.5 py-1 text-[11px] font-black text-violet-100" key={code}>
                          {memoryReasonLabel(code)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 text-sm leading-6 text-slate-400">Limited comparable memory is available for the current production packet.</p>
                )}
                <div className="mt-5 rounded-2xl border border-amber-300/18 bg-amber-400/[0.055] p-3 text-xs leading-5 text-amber-100">
                  Research only. Historical similarity is context, not a forecast.
                </div>
              </aside>
            </div>
          </section>

          {model.limitedReason ? (
            <section className="rounded-3xl border border-amber-300/18 bg-amber-400/[0.055] p-5 text-sm leading-6 text-amber-100">
              {model.limitedReason}
            </section>
          ) : null}

          <MemoryClusterGrid
            clusters={clusters}
            eyebrow="Memory cognition surface"
            summary="Clusters are derived from current scanner rows and validated historical memory. Empty clusters stay limited instead of being simulated."
            title="Market Memory Command Surface"
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
            <MemoryHeatGrid
              cells={heatCells}
              emptyMessage="No validated market-memory heat cells are available yet."
              eyebrow="Similarity heat"
              summary="Heat cells show strongest similarity and evidence depth across sampled current rows."
              title="Analog Similarity Matrix"
            />
            <MemoryTimelineRail
              emptyMessage="No validated historical analog timeline is available yet."
              eyebrow="Memory timeline"
              items={timelineItems}
              summary="Timeline points are anchored to real historical analog timestamps returned by Market Memory."
              title="Historical Analog Timeline"
            />
          </div>

          {knowledgeModels.length ? (
            <section className="space-y-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-300">Knowledge graph samples</div>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Living Market Memory Links</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  These graph samples connect current scanner rows to sector, sympathy, macro, event, and replay evidence without fabricating missing inverse links or event domains.
                </p>
              </div>
              <div className="grid gap-4">
                {knowledgeModels.map((knowledgeModel) => (
                  <SymbolKnowledgeGraphPanel key={knowledgeModel.symbol} model={knowledgeModel} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-2">
            {model.rows.slice(0, MEMORY_CARD_LIMIT).map((item) => (
              <MemoryResearchCard item={item} key={item.row.symbol} />
            ))}
          </section>
        </div>
      </section>
    </MarketingShell>
  );
}

async function loadMarketMemorySurface(): Promise<MarketMemorySurfaceModel> {
  const now = Date.now();
  const cached = marketMemorySurfaceCache;
  if (cached && cached.expiresAt > now) {
    const model = await cached.value;
    return { ...model, cacheStatus: "hit" };
  }
  if (cached && cached.staleUntil > now) {
    if (!cached.refresh) {
      const refresh = buildMarketMemorySurfaceModel(now)
        .then((model) => {
          marketMemorySurfaceCache = {
            expiresAt: Date.now() + SURFACE_CACHE_TTL_MS,
            staleUntil: Date.now() + SURFACE_CACHE_TTL_MS + SURFACE_STALE_TTL_MS,
            value: Promise.resolve(model),
          };
          return model;
        })
        .catch(() => cached.value);
      cached.refresh = refresh;
    }
    const model = await cached.value;
    return { ...model, cacheStatus: "stale" };
  }

  const value = buildMarketMemorySurfaceModel(now);
  marketMemorySurfaceCache = {
    expiresAt: now + SURFACE_CACHE_TTL_MS,
    staleUntil: now + SURFACE_CACHE_TTL_MS + SURFACE_STALE_TTL_MS,
    value,
  };
  try {
    const model = await value;
    return model;
  } catch (error) {
    if (marketMemorySurfaceCache?.value === value) marketMemorySurfaceCache = null;
    throw error;
  }
}

async function buildMarketMemorySurfaceModel(now: number): Promise<MarketMemorySurfaceModel> {
  const generatedAt = new Date(now).toISOString();
  try {
    const rankingRows = await getFullRanking();
    const selectedRows = selectMemoryRows(rankingRows).slice(0, SAMPLE_SIZE);
    const rows = await Promise.all(
      selectedRows.map(async (row): Promise<MemorySurfaceRow> => ({
        memory: await getMarketMemoryForSignal(row).catch(() => unavailableMemorySummary()),
        row,
      })),
    );

    return {
      cacheStatus: "miss",
      generatedAt,
      limitedReason: selectedRows.length ? null : "No current scanner rows are available, so Market Memory cannot compare current setups yet.",
      rows,
      universeCount: rankingRows.length,
    };
  } catch {
    return {
      cacheStatus: "miss",
      generatedAt,
      limitedReason: "Market Memory source queries are unavailable right now. The surface remains intentionally limited instead of fabricating historical analogs.",
      rows: [],
      universeCount: 0,
    };
  }
}

function unavailableMemorySummary(): MarketMemorySummary {
  return {
    analogs: [],
    available: false,
    evidence: {
      explanation: "Market Memory source query was unavailable for this symbol.",
      label: "Memory unavailable",
      sampleSize: 0,
      tier: "unavailable",
    },
    freshness: {
      ageMinutes: null,
      generatedAt: new Date().toISOString(),
      label: "Freshness unknown",
      sourceLatestAt: null,
      status: "unknown",
    },
    generatedAt: new Date().toISOString(),
    insight: {
      invalidationConditions: ["Memory source queries must recover before analog context can be used."],
      supportingEvidence: ["Market Memory source query was unavailable for this symbol."],
      whatDiffers: ["No validated differentiator is available yet."],
      whatIsSimilar: ["No validated similarity driver is available yet."],
      whyItMatters: "The unavailable state prevents TradeVeto from overstating historical comparison.",
    },
    narrative: ["Market Memory is unavailable for this symbol in the current production request."],
    outcome: null,
    warnings: ["Market Memory source query was unavailable for this symbol."],
  };
}

function selectMemoryRows(rows: RankingRow[]): RankingRow[] {
  return [...rows]
    .filter((row) => Boolean(row.symbol))
    .sort((left, right) => memoryPriorityScore(right) - memoryPriorityScore(left) || String(left.symbol).localeCompare(String(right.symbol)));
}

function memoryPriorityScore(row: RankingRow): number {
  return (
    (finiteScore(row.final_score) ?? 0) * 0.55
    + (finiteScore((row as unknown as Record<string, unknown>).analog_quality_score) ?? 0) * 0.18
    + (finiteScore((row as unknown as Record<string, unknown>).regime_similarity_score) ?? 0) * 0.12
    + (finiteScore((row as unknown as Record<string, unknown>).market_memory_similarity) ?? 0) * 0.12
    + (finiteScore((row as unknown as Record<string, unknown>).volatility_pressure) ?? 0) * 0.03
  );
}

function buildMemoryClusters(model: MarketMemorySurfaceModel): MemoryCluster[] {
  const rowsWithMemory = model.rows.filter((item) => item.memory.available);
  const topAnalogs = model.rows.flatMap((item) => item.memory.analogs.slice(0, 3));
  const outcomeRows = model.rows.filter((item) => item.memory.outcome);
  const strongestScores = model.rows.map((item) => item.memory.analogs[0]?.similarityScore ?? null);
  const evidenceScores = model.rows.map((item) => evidenceTierScore(item.memory.evidence.tier));
  const sampleScores = model.rows.map((item) => clampScore(item.memory.evidence.sampleSize));

  return [
    {
      emptyMessage: "No comparable historical analogs are available yet.",
      eyebrow: "Memory cluster",
      factors: [
        { label: "Analog coverage", tone: rowsWithMemory.length ? "emerald" : "amber", value: percentage(rowsWithMemory.length, Math.max(model.rows.length, 1)) },
        { label: "Sample depth", tone: "violet", value: averageNumber(sampleScores) },
        { label: "Top similarity", tone: "cyan", value: maxNullable(strongestScores) },
      ],
      icon: <BrainCircuit className="h-6 w-6" />,
      items: topAnalogs.slice(0, 6).map((analog) => analogItem(analog)),
      metric: `${topAnalogs.length}`,
      metricLabel: "analogs",
      score: maxNullable(strongestScores),
      summary: "Validated historical analogs are ranked by setup, regime, sector, score, event context, macro signature, and symbol memory similarity.",
      title: "Historical Analog Network",
      tone: "violet",
      updatedAt: model.generatedAt,
      values: strongestScores,
    },
    {
      emptyMessage: "Current scanner rows are unavailable for Market Memory comparison.",
      eyebrow: "Current context",
      factors: [
        { label: "Universe", tone: "cyan", value: clampScore(model.universeCount) },
        { label: "Sampled rows", tone: "violet", value: percentage(model.rows.length, SAMPLE_SIZE) },
        { label: "Decision coverage", tone: "emerald", value: percentage(model.rows.filter((item) => Boolean(item.row.final_decision ?? item.row.action)).length, Math.max(model.rows.length, 1)) },
      ],
      icon: <Database className="h-6 w-6" />,
      items: model.rows.slice(0, 6).map((item) => ({
        detail: `${companyName(item.row)} · ${humanizeOptional(item.row.setup_type)} · ${humanizeOptional(item.row.market_regime)}`,
        href: `/symbol/${encodeURIComponent(item.row.symbol)}`,
        label: item.row.symbol,
        symbol: item.row.symbol,
        tone: toneFromFinalScore(item.row.final_score),
        value: scoreText(item.row.final_score),
      })),
      metric: model.universeCount.toLocaleString("en-US"),
      metricLabel: "universe",
      score: averageNumber(model.rows.map((item) => finiteScore(item.row.final_score))),
      summary: "The direct Market Memory route samples the latest production scanner universe and exposes whether comparable memory exists.",
      title: "Current Research Universe",
      tone: "cyan",
      updatedAt: model.generatedAt,
      values: model.rows.map((item) => finiteScore(item.row.final_score)),
    },
    {
      emptyMessage: "No outcome summary is available across current analogs yet.",
      eyebrow: "Outcome evidence",
      factors: [
        { label: "Outcome coverage", tone: outcomeRows.length ? "emerald" : "amber", value: percentage(outcomeRows.length, Math.max(model.rows.length, 1)) },
        { label: "Median return", tone: "cyan", value: normalizeReturnScore(averageNumber(outcomeRows.map((item) => item.memory.outcome?.medianReturn ?? null))) },
        { label: "Downside risk", tone: "rose", value: normalizeRiskReturnScore(minNullable(outcomeRows.map((item) => item.memory.outcome?.downsideRisk ?? null))) },
      ],
      icon: <Target className="h-6 w-6" />,
      items: outcomeRows.slice(0, 6).map((item) => outcomeItem(item)),
      metric: `${outcomeRows.length}`,
      metricLabel: "outcome rows",
      score: percentage(outcomeRows.length, Math.max(model.rows.length, 1)),
      summary: "Outcome summaries appear only when validated forward-return evidence exists for the historical analog set.",
      title: "Outcome Memory",
      tone: outcomeRows.length ? "emerald" : "amber",
      updatedAt: model.generatedAt,
      values: outcomeRows.map((item) => item.memory.outcome?.winRate === null || item.memory.outcome?.winRate === undefined ? null : item.memory.outcome.winRate * 100),
    },
    {
      emptyMessage: "Evidence maturity is still building across this sample.",
      eyebrow: "Evidence depth",
      factors: evidenceFactors(model.rows),
      icon: <ShieldCheck className="h-6 w-6" />,
      items: model.rows.slice(0, 6).map((item) => ({
        detail: item.memory.evidence.explanation,
        href: `/symbol/${encodeURIComponent(item.row.symbol)}`,
        label: item.row.symbol,
        symbol: item.row.symbol,
        tone: toneFromEvidenceTier(item.memory.evidence.tier),
        value: item.memory.evidence.label,
      })),
      metric: `${totalEvidence(model.rows).toLocaleString("en-US")}`,
      metricLabel: "samples",
      score: averageNumber(evidenceScores),
      summary: "Evidence maturity measures how much comparable historical setup depth exists before the system makes memory claims.",
      title: "Evidence Maturity",
      tone: "amber",
      updatedAt: model.generatedAt,
      values: evidenceScores,
    },
    {
      emptyMessage: "Regime-linked memory is limited for this current packet.",
      eyebrow: "Regime memory",
      factors: regimeFactors(model.rows),
      icon: <Layers3 className="h-6 w-6" />,
      items: regimeItems(model.rows),
      metric: `${distinctRegimeCount(model.rows)}`,
      metricLabel: "regimes",
      score: percentage(distinctRegimeCount(model.rows), Math.max(model.rows.length, 1)),
      summary: "Market Memory keeps current regime, sector, and setup context connected so analogs are not reduced to price similarity alone.",
      title: "Regime Context Memory",
      tone: "cyan",
      updatedAt: model.generatedAt,
      values: regimeItems(model.rows).map((item) => parseNumber(item.value)),
    },
  ];
}

function buildMemoryHeatCells(model: MarketMemorySurfaceModel): MemoryHeatCell[] {
  return model.rows.flatMap((item): MemoryHeatCell[] => {
    const strongest = item.memory.analogs[0] ?? null;
    return [
      {
        detail: strongest ? `${strongest.symbol} on ${formatMemoryDate(strongest.signalTimestamp)}` : item.memory.evidence.explanation,
        href: `/symbol/${encodeURIComponent(item.row.symbol)}`,
        label: `${item.row.symbol} similarity`,
        tone: strongest ? toneFromSimilarity(strongest.similarityScore) : "amber",
        value: strongest?.similarityScore ?? null,
      },
      {
        detail: item.memory.evidence.explanation,
        href: `/symbol/${encodeURIComponent(item.row.symbol)}`,
        label: `${item.row.symbol} evidence`,
        tone: toneFromEvidenceTier(item.memory.evidence.tier),
        value: clampScore(item.memory.evidence.sampleSize),
      },
    ];
  }).slice(0, 16);
}

function buildMemoryTimelineItems(model: MarketMemorySurfaceModel): MemoryTimelineItem[] {
  return model.rows
    .flatMap((item) => item.memory.analogs.slice(0, 2).map((analog): MemoryTimelineItem => ({
      detail: `${item.row.symbol} current context matched ${analog.symbol} through ${analog.reasonCodes.slice(0, 3).map(memoryReasonLabel).join(", ") || "limited reason detail"}.`,
      href: `/symbol/${encodeURIComponent(item.row.symbol)}`,
      label: `${item.row.symbol} -> ${analog.symbol}`,
      metric: `${analog.similarityScore}%`,
      timestamp: formatMemoryDate(analog.signalTimestamp),
      tone: toneFromSimilarity(analog.similarityScore),
    })))
    .slice(0, 10);
}

function MemoryResearchCard({ item }: { item: MemorySurfaceRow }) {
  const top = item.memory.analogs[0] ?? null;
  const tone = toneFromEvidenceTier(item.memory.evidence.tier);
  const insight = item.memory.insight;
  return (
    <article className={`rounded-3xl border p-5 shadow-2xl shadow-black/20 ring-1 ring-white/5 ${tonePanelClass(tone)}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Symbol Memory</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <h2 className="text-3xl font-black text-white">{item.row.symbol}</h2>
            <span className="text-sm font-semibold text-slate-400">{companyName(item.row)}</span>
          </div>
        </div>
        <Link className="w-fit rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-100 transition hover:border-cyan-200/70" href={`/symbol/${encodeURIComponent(item.row.symbol)}`}>
          Open symbol
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MemoryStat label="Evidence" tone={tone} value={item.memory.evidence.label} />
        <MemoryStat label="Confidence" tone="violet" value={item.memory.confidence ? `${item.memory.confidence.score}/100` : "Limited"} />
        <MemoryStat label="Top analog" tone={top ? toneFromSimilarity(top.similarityScore) : "amber"} value={top ? `${top.symbol} ${top.similarityScore}%` : "Limited"} />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Memory explanation</div>
          <div className="font-mono text-[10px] font-black uppercase text-slate-500">{item.memory.freshness?.label ?? "Freshness limited"}</div>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300">{item.memory.narrative[0] ?? "Market Memory context is limited for this symbol."}</p>
        {insight ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <InsightList label="Similar" tone="cyan" values={insight.whatIsSimilar.slice(0, 3)} />
            <InsightList label="Differs" tone="amber" values={insight.whatDiffers.slice(0, 3)} />
          </div>
        ) : null}
        {item.memory.warnings?.[0] ? (
          <div className="mt-3 rounded-2xl border border-amber-300/18 bg-amber-400/[0.055] p-3 text-xs leading-5 text-amber-100">
            {item.memory.warnings[0]}
          </div>
        ) : null}
      </div>

      {insight ? (
        <div className="mt-4 rounded-2xl border border-violet-300/16 bg-violet-400/[0.045] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">Why it matters</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{insight.whyItMatters}</p>
          <div className="mt-3 text-xs leading-5 text-slate-500">
            Invalidation: {insight.invalidationConditions[0] ?? "Memory conditions must remain comparable."}
          </div>
        </div>
      ) : null}

      {top ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/38 p-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">
              <GitCompareArrows className="h-4 w-4" />
              Closest analog
            </div>
            <div className="mt-3 text-lg font-black text-white">{top.symbol} · {formatMemoryDate(top.signalTimestamp)}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {top.reasonCodes.slice(0, 5).map((reason) => (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-slate-300" key={reason}>
                  {memoryReasonLabel(reason)}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/38 p-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
              <History className="h-4 w-4" />
              Outcome context
            </div>
            {item.memory.outcome ? (
              <div className="mt-3 grid gap-2 text-sm text-slate-300">
                <div>Horizon: <strong className="text-white">{item.memory.outcome.horizon}</strong></div>
                <div>Positive rate: <strong className="text-white">{formatMemoryPercent(item.memory.outcome.winRate)}</strong></div>
                <div>Median: <strong className="text-white">{formatMemoryReturn(item.memory.outcome.medianReturn)}</strong></div>
                <div>Downside: <strong className="text-white">{formatMemoryReturn(item.memory.outcome.downsideRisk)}</strong></div>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-400">Outcome history is not deep enough for this analog cluster yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function MemoryClusterGrid({ clusters, eyebrow, summary, title }: { clusters: MemoryCluster[]; eyebrow: string; summary: string; title: string }) {
  return (
    <section className="rounded-[2rem] border border-cyan-300/16 bg-slate-950/48 p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</div>
          <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{summary}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {clusters.map((cluster) => {
          const tone = cluster.tone ?? "cyan";
          const items = cluster.items ?? [];
          return (
            <article className={`rounded-3xl border bg-white/[0.025] p-4 ${toneBorderClass(tone)}`} key={cluster.title}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{cluster.eyebrow ?? "Memory cluster"}</div>
                  <h3 className="mt-1 truncate text-lg font-black text-white">{cluster.title}</h3>
                </div>
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border bg-black/20 ${toneBorderClass(tone)}`}>{cluster.icon}</div>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="font-mono text-2xl font-black text-white">{cluster.metric ?? (cluster.score === null || cluster.score === undefined ? "Limited" : Math.round(cluster.score))}</div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{cluster.metricLabel ?? "score"}</div>
                </div>
                <div className="text-right text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{cluster.updatedAt ? formatMemoryDate(cluster.updatedAt) : "Latest"}</div>
              </div>
              <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">{cluster.summary}</p>
              {cluster.factors?.length ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {cluster.factors.slice(0, 3).map((factor) => {
                    const factorValue = typeof factor.value === "number" && Number.isFinite(factor.value) ? Math.round(factor.value) : null;
                    return (
                      <div className={`rounded-2xl border bg-black/20 px-2 py-2 ${toneBorderClass(factor.tone ?? "cyan")}`} key={`${cluster.title}:${factor.label}`}>
                        <div className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{factor.label}</div>
                        <div className="mt-1 font-mono text-xs font-black text-slate-100">{factorValue === null ? "N/A" : `${factorValue}`}</div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div className="mt-3 space-y-2">
                {(items.length ? items : [{ detail: cluster.emptyMessage ?? "Limited validated evidence.", label: "Limited", value: "N/A" }]).slice(0, 3).map((item) => (
                  <MemoryInlineItem item={item} key={`${cluster.title}:${item.label}:${item.value ?? ""}`} />
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MemoryHeatGrid({ cells, emptyMessage, eyebrow, summary, title }: { cells: MemoryHeatCell[]; emptyMessage: string; eyebrow: string; summary: string; title: string }) {
  return (
    <section className="rounded-[2rem] border border-violet-300/16 bg-slate-950/48 p-5">
      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-300">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{summary}</p>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(cells.length ? cells : [{ detail: emptyMessage, label: "Limited", value: null, tone: "amber" as const }]).slice(0, 12).map((cell) => (
          <LinkOrDiv className={`min-h-24 rounded-2xl border bg-black/20 p-3 ${toneBorderClass(cell.tone ?? "cyan")}`} href={cell.href} key={`${cell.label}:${cell.value ?? "limited"}`}>
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{cell.label}</div>
            <div className="mt-2 font-mono text-2xl font-black text-white">{cell.value === null ? "N/A" : Math.round(cell.value)}</div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{cell.detail}</p>
          </LinkOrDiv>
        ))}
      </div>
    </section>
  );
}

function MemoryTimelineRail({ emptyMessage, eyebrow, items, summary, title }: { emptyMessage: string; eyebrow: string; items: MemoryTimelineItem[]; summary: string; title: string }) {
  const visible = items.length ? items : [{ detail: emptyMessage, label: "Limited", metric: "N/A", tone: "amber" as const }];
  return (
    <section className="rounded-[2rem] border border-cyan-300/16 bg-slate-950/48 p-5">
      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{summary}</p>
      <div className="mt-5 space-y-2">
        {visible.slice(0, 8).map((item) => (
          <LinkOrDiv className={`block rounded-2xl border bg-black/20 p-3 ${toneBorderClass(item.tone ?? "cyan")}`} href={item.href} key={`${item.label}:${item.timestamp ?? ""}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-black text-slate-100">{item.label}</span>
              <span className="shrink-0 font-mono text-xs font-black text-cyan-100">{item.metric ?? "N/A"}</span>
            </div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.timestamp ?? "Timeline limited"}</div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
          </LinkOrDiv>
        ))}
      </div>
    </section>
  );
}

function MemoryInlineItem({ item }: { item: MemoryClusterItem }) {
  return (
    <LinkOrDiv className="block rounded-2xl border border-white/10 bg-black/20 px-3 py-2" href={item.href}>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-xs font-black text-slate-100">{item.label}</span>
        <span className="shrink-0 font-mono text-[11px] font-black text-cyan-100">{item.value ?? "N/A"}</span>
      </div>
      {item.detail ? <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{item.detail}</p> : null}
    </LinkOrDiv>
  );
}

function LinkOrDiv({ children, className, href }: { children: ReactNode; className: string; href?: string }) {
  if (href) return <Link className={className} href={href}>{children}</Link>;
  return <div className={className}>{children}</div>;
}

function MemoryTrustStrip({ model }: { model: MarketMemorySurfaceModel }) {
  const generated = formatMemoryDate(model.generatedAt);
  const warnings = model.rows.flatMap((item) => item.memory.warnings ?? []);
  const confidence = averageNumber(model.rows.map((item) => item.memory.confidence?.score ?? null));
  const staleCount = model.rows.filter((item) => item.memory.freshness?.status === "stale").length;
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <TrustPill label="Generated" tone="cyan" value={generated} />
      <TrustPill label="Confidence" tone={confidence !== null && confidence >= 60 ? "emerald" : "amber"} value={confidence === null ? "Limited" : `${confidence}/100`} />
      <TrustPill label="Freshness" tone={staleCount ? "amber" : "emerald"} value={staleCount ? `${staleCount} stale` : "Bounded"} />
      <TrustPill label="Warnings" tone={warnings.length ? "amber" : "cyan"} value={warnings.length ? `${warnings.length}` : "None"} />
    </div>
  );
}

function TrustPill({ label, tone, value }: { label: string; tone: VisualTone; value: string }) {
  return (
    <div className={`rounded-2xl border bg-black/20 px-3 py-2 ${toneBorderClass(tone)}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-xs font-black text-slate-100">{value}</div>
    </div>
  );
}

function InsightList({ label, tone, values }: { label: string; tone: VisualTone; values: string[] }) {
  return (
    <div className={`rounded-2xl border bg-slate-950/38 p-3 ${toneBorderClass(tone)}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(values.length ? values : ["Limited"]).map((value) => (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-slate-300" key={`${label}:${value}`}>
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function HeroMetric({ detail, label, tone, value }: { detail: string; label: string; tone: VisualTone; value: string }) {
  return (
    <div className={`rounded-2xl border bg-slate-950/42 p-3 ${toneBorderClass(tone)}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 truncate text-2xl font-black text-slate-50">{value}</div>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function MemoryStat({ label, tone, value }: { label: string; tone: VisualTone; value: string }) {
  return (
    <div className={`rounded-2xl border bg-slate-950/42 p-3 ${toneBorderClass(tone)}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 break-words text-sm font-black text-slate-50">{value}</div>
    </div>
  );
}

function analogItem(analog: MarketMemoryAnalog): MemoryClusterItem {
  return {
    detail: `${formatMemoryDate(analog.signalTimestamp)} · ${analog.reasonCodes.slice(0, 3).map(memoryReasonLabel).join(", ") || "limited reason detail"}`,
    href: `/symbol/${encodeURIComponent(analog.symbol)}`,
    label: analog.symbol,
    symbol: analog.symbol,
    tone: toneFromSimilarity(analog.similarityScore),
    value: `${analog.similarityScore}%`,
  };
}

function outcomeItem(item: MemorySurfaceRow): MemoryClusterItem {
  const outcome = item.memory.outcome;
  return {
    detail: outcome ? `${outcome.horizon} median ${formatMemoryReturn(outcome.medianReturn)}, downside ${formatMemoryReturn(outcome.downsideRisk)}` : "Outcome history is limited.",
    href: `/symbol/${encodeURIComponent(item.row.symbol)}`,
    label: item.row.symbol,
    symbol: item.row.symbol,
    tone: outcome?.winRate !== null && outcome?.winRate !== undefined && outcome.winRate >= 0.55 ? "emerald" : "amber",
    value: outcome ? formatMemoryPercent(outcome.winRate) : "Limited",
  };
}

function evidenceFactors(rows: MemorySurfaceRow[]): ScoreFactor[] {
  const total = Math.max(rows.length, 1);
  return [
    { label: "High", tone: "emerald", value: percentage(rows.filter((item) => item.memory.evidence.tier === "high").length, total) },
    { label: "Moderate", tone: "cyan", value: percentage(rows.filter((item) => item.memory.evidence.tier === "moderate").length, total) },
    { label: "Limited", tone: "amber", value: percentage(rows.filter((item) => item.memory.evidence.tier === "limited").length, total) },
    { label: "Unavailable", tone: "rose", value: percentage(rows.filter((item) => item.memory.evidence.tier === "unavailable").length, total) },
  ];
}

function regimeFactors(rows: MemorySurfaceRow[]): ScoreFactor[] {
  const groups = regimeGroups(rows).slice(0, 4);
  return groups.map((group) => ({
    label: group.label,
    tone: "cyan",
    value: percentage(group.count, Math.max(rows.length, 1)),
  }));
}

function regimeItems(rows: MemorySurfaceRow[]): MemoryClusterItem[] {
  return regimeGroups(rows).slice(0, 6).map((group) => ({
    detail: `${group.count} sampled current row${group.count === 1 ? "" : "s"} in this regime context.`,
    label: group.label,
    tone: "cyan",
    value: `${group.count}`,
  }));
}

function regimeGroups(rows: MemorySurfaceRow[]): Array<{ count: number; label: string }> {
  const counts = new Map<string, number>();
  for (const item of rows) {
    const label = humanizeOptional(item.row.market_regime);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ count, label }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function distinctRegimeCount(rows: MemorySurfaceRow[]): number {
  return regimeGroups(rows).length;
}

function totalEvidence(rows: MemorySurfaceRow[]): number {
  return rows.reduce((sum, item) => sum + item.memory.evidence.sampleSize, 0);
}

function evidenceTierScore(tier: EvidenceMaturityTier): number {
  if (tier === "high") return 100;
  if (tier === "moderate") return 72;
  if (tier === "limited") return 38;
  return 8;
}

function toneFromEvidenceTier(tier: EvidenceMaturityTier): VisualTone {
  if (tier === "high") return "emerald";
  if (tier === "moderate") return "cyan";
  if (tier === "limited") return "amber";
  return "rose";
}

function toneFromSimilarity(score: number): VisualTone {
  if (score >= 75) return "emerald";
  if (score >= 60) return "cyan";
  if (score >= 45) return "amber";
  return "rose";
}

function toneFromFinalScore(score: unknown): VisualTone {
  const value = finiteScore(score);
  if (value === null) return "amber";
  if (value >= 70) return "emerald";
  if (value >= 55) return "cyan";
  if (value >= 40) return "amber";
  return "rose";
}

function cacheStatusTone(status: MarketMemorySurfaceModel["cacheStatus"]): VisualTone {
  if (status === "hit") return "emerald";
  if (status === "stale") return "amber";
  return "violet";
}

function tonePanelClass(tone: VisualTone): string {
  if (tone === "emerald") return "border-emerald-300/20 bg-emerald-400/[0.045]";
  if (tone === "violet") return "border-violet-300/20 bg-violet-400/[0.045]";
  if (tone === "rose") return "border-rose-300/20 bg-rose-400/[0.045]";
  if (tone === "amber") return "border-amber-300/18 bg-amber-400/[0.045]";
  return "border-cyan-300/20 bg-cyan-400/[0.045]";
}

function toneBorderClass(tone: VisualTone): string {
  if (tone === "emerald") return "border-emerald-300/22";
  if (tone === "violet") return "border-violet-300/22";
  if (tone === "rose") return "border-rose-300/22";
  if (tone === "amber") return "border-amber-300/22";
  return "border-cyan-300/22";
}

function companyName(row: RankingRow): string {
  return textOrFallback(row.company_name, "Company context limited");
}

function humanizeOptional(value: unknown): string {
  const text = textOrFallback(value, "Limited context");
  return text === "Limited context" ? text : humanizeLabel(text);
}

function scoreText(value: unknown): string {
  const score = finiteScore(value);
  return score === null ? "Limited" : `${Math.round(score)}`;
}

function finiteScore(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrFallback(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined", "n/a", "na"].includes(text.toLowerCase())) return fallback;
  return text;
}

function percentage(count: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function averageNumber(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return null;
  return Math.round(finite.reduce((sum, value) => sum + value, 0) / finite.length);
}

function maxNullable(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return null;
  return Math.max(...finite);
}

function minNullable(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return null;
  return Math.min(...finite);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeReturnScore(value: number | null): number | null {
  if (value === null) return null;
  return clampScore(50 + value * 500);
}

function normalizeRiskReturnScore(value: number | null): number | null {
  if (value === null) return null;
  return clampScore(Math.abs(value) * 500);
}
