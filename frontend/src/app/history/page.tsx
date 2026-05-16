import { HistoryWorkspace } from "@/components/history-workspace";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { MetricStrip } from "@/components/metric-strip";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { TerminalShell } from "@/components/shell";
import {
  CinematicClusterMosaic,
  CinematicHeatMatrix,
  CinematicTimeline,
  type CinematicCluster,
  type CinematicHeatCell,
  type CinematicTimelineItem,
} from "@/components/visual/CinematicIntelligencePanels";
import type { ScoreFactor } from "@/components/visual/MiniVisuals";
import { getFullRanking, getHistorySummary, getHistorySymbolsFromSnapshots } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";
import type { RankingRow } from "@/lib/types";
import { humanizeInsightText, humanizeLabel } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

type HistoryPageProps = {
  searchParams?: Promise<{ symbol?: string | string[] }>;
};

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return value.replace("T", " ").replace("Z", " UTC");
}

function requestedSymbolFromSearchParams(params: { symbol?: string | string[] } | undefined): string {
  const raw = Array.isArray(params?.symbol) ? params?.symbol[0] : params?.symbol;
  return String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

function HowToUseHistory() {
  return (
    <section className="terminal-panel rounded-2xl p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">How to use this page</div>
      <h2 className="mt-1 text-lg font-semibold text-slate-50">Review what changed over time</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Use History to compare previous scanner snapshots, score changes, and decision context. It helps you understand signal behavior over time, not predict guaranteed future returns.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ["1. Pick a symbol", "Start with a ticker you follow or the current leading scanner row."],
          ["2. Scan the timeline", "Look for score, decision, risk, and setup changes between saved runs."],
          ["3. Open details", "Use replay and context panels to understand why a view changed."],
        ].map(([title, copy]) => (
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3" key={title}>
            <div className="text-sm font-semibold text-slate-100">{title}</div>
            <p className="mt-1 text-xs leading-5 text-slate-400">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HistoryCinematicMemorySystem({
  defaultSymbol,
  history,
  ranking,
  symbols,
}: {
  defaultSymbol: string;
  history: Awaited<ReturnType<typeof getHistorySummary>>;
  ranking: RankingRow[];
  symbols: string[];
}) {
  const topRows = ranking.slice(0, 6);
  const focus = ranking.find((row) => String(row.symbol ?? "").trim().toUpperCase() === defaultSymbol) ?? ranking[0] ?? null;
  const scoreValues = topRows.map((row) => rowScore(row));
  const clusters: CinematicCluster[] = [
    {
      emptyMessage: "No saved scanner runs exist yet. Run refreshes over time to build market memory.",
      eyebrow: "Memory Cluster",
      factors: [
        scoreFactor("Saved Runs", coverageScore(history.count, 50), `${history.count.toLocaleString()} saved runs`, "violet"),
        scoreFactor("Unique Dates", coverageScore(history.uniqueDates.length, 30), `${history.uniqueDates.length.toLocaleString()} unique dates`, "cyan"),
        scoreFactor("Symbol Coverage", coverageScore(symbols.length, 100), `${symbols.length.toLocaleString()} symbols with memory coverage`, "emerald"),
      ],
      footer: "History shows recorded scanner state, not a prediction engine.",
      items: history.snapshots.slice(0, 5).map((snapshot) => ({
        detail: snapshot.name,
        label: formatDate(snapshot.timestamp ?? snapshot.modifiedAt),
        tone: "violet",
        value: "run",
      })),
      metricLabel: "memory depth",
      score: coverageScore(history.count, 50),
      summary: "Saved scanner runs create the memory layer for score changes, decision shifts, and replay context.",
      title: "Signal Memory",
      tone: "violet",
      updatedAt: formatDate(history.latest),
      values: [],
    },
    {
      emptyMessage: "No current symbol row is available for the selected memory view.",
      eyebrow: "Symbol Cluster",
      factors: focus ? [
        scoreFactor("Score", rowScore(focus), "Latest available score", "cyan"),
        scoreFactor("Evidence", numberValue(focus.evidence_sample_size), "Stored scanner evidence sample size", "emerald"),
        scoreFactor("Risk", rowRiskScore(focus), "Latest risk pressure context", "rose"),
      ] : [],
      href: focus?.symbol ? `/symbol/${String(focus.symbol).trim().toUpperCase()}` : undefined,
      items: topRows.map((row) => ({
        detail: humanizeInsightText(row.final_decision ?? row.action ?? row.decision_reason ?? "Latest scanner row"),
        href: row.symbol ? `/symbol/${String(row.symbol).trim().toUpperCase()}` : undefined,
        label: String(row.symbol ?? "N/A").trim().toUpperCase(),
        symbol: String(row.symbol ?? "").trim().toUpperCase(),
        tone: "cyan",
        value: scoreText(row),
      })),
      metric: focus ? scoreText(focus) : "Limited",
      metricLabel: "focus symbol",
      summary: focus ? `${String(focus.symbol ?? "").trim().toUpperCase()} is the active history focus.` : "No focus symbol has current scanner memory yet.",
      title: defaultSymbol || "Symbol Timeline",
      tone: "cyan",
      updatedAt: formatDate(history.latest),
      values: scoreValues,
    },
    {
      emptyMessage: "No decision history is available yet.",
      eyebrow: "Decision Cluster",
      factors: [
        scoreFactor("Current Rows", coverageScore(ranking.length, 100), `${ranking.length.toLocaleString()} current ranking rows`, "cyan"),
        scoreFactor("History Symbols", coverageScore(symbols.length, 100), `${symbols.length.toLocaleString()} historical symbols`, "emerald"),
      ],
      href: "/opportunities",
      items: topRows.map((row) => ({
        detail: humanizeInsightText(row.decision_reason ?? row.quality_reason ?? row.selection_reason ?? "Latest decision context"),
        href: row.symbol ? `/symbol/${String(row.symbol).trim().toUpperCase()}` : undefined,
        label: humanizeLabel(row.final_decision ?? row.action ?? "Research signal"),
        tone: toneForDecision(row.final_decision ?? row.action),
        value: String(row.symbol ?? "").trim().toUpperCase(),
      })),
      metric: ranking.length.toLocaleString(),
      metricLabel: "current rows",
      summary: "Decision memory connects current rows to previous scanner runs and symbol detail.",
      title: "Decision Evolution",
      tone: "emerald",
      updatedAt: formatDate(history.latest),
      values: scoreValues,
    },
    {
      emptyMessage: "No replay-ready historical depth is available yet.",
      eyebrow: "Replay Cluster",
      factors: [
        scoreFactor("Run Depth", coverageScore(history.count, 80), "Saved runs available for review", "violet"),
        scoreFactor("Date Span", coverageScore(history.uniqueDates.length, 40), "Distinct days available for review", "cyan"),
      ],
      href: defaultSymbol ? `/history?symbol=${defaultSymbol}` : "/history",
      items: [
        { detail: "Oldest saved scanner memory", label: "Earliest", tone: "violet", value: formatDate(history.earliest) },
        { detail: "Latest saved scanner memory", label: "Latest", tone: "cyan", value: formatDate(history.latest) },
        { detail: "Distinct saved trading days", label: "Unique dates", tone: "emerald", value: history.uniqueDates.length.toLocaleString() },
      ],
      metric: history.uniqueDates.length.toLocaleString(),
      metricLabel: "date layers",
      summary: "Replay review becomes stronger as more saved runs and dates accumulate.",
      title: "Replay Readiness",
      tone: "violet",
      updatedAt: formatDate(history.latest),
      values: [],
    },
  ];
  const heatCells: CinematicHeatCell[] = [
    { detail: `${history.count.toLocaleString()} saved runs`, label: "Run Depth", tone: "violet", value: coverageScore(history.count, 50) },
    { detail: `${history.uniqueDates.length.toLocaleString()} unique dates`, label: "Date Depth", tone: "cyan", value: coverageScore(history.uniqueDates.length, 30) },
    { detail: `${symbols.length.toLocaleString()} symbols`, label: "Symbol Coverage", tone: "emerald", value: coverageScore(symbols.length, 100) },
    ...topRows.slice(0, 6).map((row): CinematicHeatCell => ({
      detail: humanizeInsightText(row.final_decision ?? row.action ?? row.decision_reason ?? "Current scanner context"),
      href: row.symbol ? `/symbol/${String(row.symbol).trim().toUpperCase()}` : undefined,
      label: String(row.symbol ?? "N/A").trim().toUpperCase(),
      tone: toneForDecision(row.final_decision ?? row.action),
      value: rowScore(row),
    })),
  ];
  const timeline: CinematicTimelineItem[] = history.snapshots.slice(0, 7).map((snapshot) => ({
    detail: snapshot.name,
    label: "Scanner snapshot saved",
    timestamp: formatDate(snapshot.timestamp ?? snapshot.modifiedAt),
    tone: "violet",
  }));

  return (
    <div className="grid gap-3">
      <CinematicClusterMosaic
        eyebrow="Market memory system"
        summary="History is now presented as memory depth, symbol focus, decision evolution, and replay readiness instead of a plain log."
        title="Signal Memory Command Center"
        clusters={clusters}
      />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
        <CinematicHeatMatrix cells={heatCells} title="Current Memory Heat" />
        <CinematicTimeline emptyMessage="No saved scanner timeline exists yet." items={timeline} title="Saved Snapshot Timeline" />
      </div>
    </div>
  );
}

function scoreFactor(label: string, value: number | null, detail: string, tone: ScoreFactor["tone"]): ScoreFactor {
  return { detail, label, tone, value };
}

function numberValue(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coverageScore(count: number, target: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.max(0, Math.min(100, (count / target) * 100));
}

function scoreText(row: RankingRow): string {
  const score = rowScore(row);
  return score === null ? "N/A" : `${Math.round(score)}`;
}

function rowScore(row: RankingRow): number | null {
  return numberValue(row.final_score ?? row.final_score_adjusted ?? row.macro_adjusted_score ?? row.quality_score ?? row.base_score);
}

function rowRiskScore(row: RankingRow): number | null {
  return numberValue(row.event_risk_score ?? row.macro_pressure_score ?? row.volatility_pressure ?? row.liquidity_pressure);
}

function toneForDecision(value: unknown): "amber" | "cyan" | "emerald" | "rose" | "violet" {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("avoid") || text.includes("risk")) return "rose";
  if (text.includes("wait") || text.includes("watch")) return "amber";
  if (text.includes("buy") || text.includes("strong")) return "emerald";
  if (text.includes("replay")) return "violet";
  return "cyan";
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) {
    return (
      <TerminalShell>
        <LegalAcceptanceRequiredState />
      </TerminalShell>
    );
  }

  if (!hasPremiumAccess(entitlement)) {
    return (
      <TerminalShell>
        <PremiumLockedState
          authenticated={entitlement.authenticated}
          description="Signal memory, historical symbol timelines, and CSV snapshot exports are premium research tools. Free users can still review the current terminal preview."
          previewItems={["Saved scanner run timeline", "Symbol-by-symbol decision history", "Premium-only CSV history export"]}
          title={entitlement.authenticated ? "History is available on Premium" : "Sign in to preview signal history"}
        />
      </TerminalShell>
    );
  }

  const [history, rawRanking, historySymbols, scanSafety] = await Promise.all([getHistorySummary(), getFullRanking(), getHistorySymbolsFromSnapshots(), getCurrentScanSafety()]);
  const ranking = applyStaleDataSafetyToRows(rawRanking, scanSafety);
  const symbols = Array.from(new Set([...ranking.map((row) => row.symbol), ...historySymbols].filter(Boolean).map((symbol) => String(symbol).trim().toUpperCase()))).sort();
  const params = searchParams ? await searchParams : undefined;
  const requestedSymbol = requestedSymbolFromSearchParams(params);
  const defaultSymbol = requestedSymbol && symbols.includes(requestedSymbol) ? requestedSymbol : String(ranking[0]?.symbol ?? symbols[0] ?? "").trim().toUpperCase();

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Saved Runs", value: history.count.toLocaleString(), meta: "signal memory" },
            { label: "Earliest", value: formatDate(history.earliest), meta: "history" },
            { label: "Latest", value: formatDate(history.latest), meta: "history" },
            { label: "Unique Dates", value: history.uniqueDates.length.toLocaleString(), meta: "trading days" },
          ]}
        />

        <HowToUseHistory />

        <HistoryCinematicMemorySystem defaultSymbol={defaultSymbol} history={history} ranking={ranking} symbols={symbols} />

        {!history.snapshots.length ? (
          <section className="terminal-panel rounded-2xl p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">History</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">No Signal Memory Yet</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Run signal refreshes over time to build conviction timelines, performance context, and symbol history.</p>
          </section>
        ) : (
          <HistoryWorkspace defaultSymbol={defaultSymbol} history={history} symbols={symbols} />
        )}
      </div>
    </TerminalShell>
  );
}
