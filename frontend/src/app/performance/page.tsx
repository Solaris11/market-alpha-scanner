import Link from "next/link";
import { MetricStrip } from "@/components/metric-strip";
import { AutoCalibrationRecommendations } from "@/components/auto-calibration-recommendations";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { PerformanceDrift } from "@/components/performance-drift";
import { PerformanceValidation } from "@/components/performance-validation";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { RunCommandButton } from "@/components/run-command-button";
import { TerminalShell } from "@/components/shell";
import { UtilitySurfaceMaturityPanel } from "@/components/utility/UtilitySurfaceMaturityPanel";
import { SignalLifecycle } from "@/components/signal-lifecycle";
import { SymbolCommandSearch } from "@/components/symbol/SymbolCommandSearch";
import { PerformanceWorkflowMaturityPanel } from "@/components/symbol/SymbolWorkflowMaturityPanels";
import { ResponsiveAdvancedDetails } from "@/components/ui/ResponsiveAdvancedDetails";
import {
  CinematicClusterMosaic,
  CinematicHeatMatrix,
  CinematicTimeline,
  type CinematicCluster,
  type CinematicHeatCell,
  type CinematicTimelineItem,
} from "@/components/visual/CinematicIntelligencePanels";
import type { ScoreFactor } from "@/components/visual/MiniVisuals";
import { getCalibrationInsights, getFullRanking, getHistorySummary, getHistorySymbolsFromSnapshots, getIntradaySignalDriftSummary, getPerformanceData } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";
import { buildPerformanceWorkflowMaturityModel, buildSymbolSearchIndex } from "@/lib/trading/symbol-workflow-maturity";
import { humanizeLabel, humanizeQuantText } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return value.replace("T", " ").replace("Z", " UTC");
}

function fileStateLabel(state: string) {
  if (state === "data") return "Data rows";
  if (state === "header-only") return "Header only";
  return "Missing";
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown, fallback = "N/A") {
  const raw = String(value ?? "").trim();
  return raw && !["nan", "none", "null"].includes(raw.toLowerCase()) ? raw : fallback;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(value: unknown) {
  const parsed = numberValue(value);
  if (parsed === null) return "N/A";
  const sign = parsed > 0 ? "+" : "";
  return `${sign}${(parsed * 100).toFixed(2)}%`;
}

function ratio(value: unknown) {
  const parsed = numberValue(value);
  if (parsed === null) return "N/A";
  return `${(parsed * 100).toFixed(1)}%`;
}

function edge(value: unknown) {
  const parsed = numberValue(value);
  return parsed === null ? "N/A" : parsed.toFixed(2);
}

function groupTitle(group: Record<string, unknown> | null) {
  if (!group) return "N/A";
  const label = text(group.label, "");
  if (label) return humanizeQuantText(label);
  return `${humanizeLabel(group.group_type, "Group")}: ${humanizeLabel(group.group_value, "unknown")} over ${text(group.horizon, "unknown")}`;
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => text(item, "")).filter(Boolean) : [];
}

function CalibrationInsightsPanel({ insights }: { insights: Record<string, unknown> | null }) {
  const bestGroup = record(insights?.best_group);
  const worstGroup = record(insights?.worst_group);
  const warnings = stringList(insights?.warnings);
  const lowSampleWarnings = stringList(insights?.low_sample_warnings).slice(0, 4);
  const generatedAt = text(insights?.generated_at, "");
  const cards = insights ? buildInsightCards(insights, bestGroup, worstGroup, warnings, lowSampleWarnings) : [];

  return (
    <section className="terminal-panel rounded-md p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Recent Signal History</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Scanner Learning Readout</h2>
          <p className="mt-1 text-sm text-slate-400">Simple review of how recent signals behaved after they had time to develop. Use this to understand scanner quality, not guaranteed future returns.</p>
        </div>
        <div className="text-xs text-slate-500">{generatedAt ? `Last updated ${formatDate(generatedAt)}` : "Not generated yet"}</div>
      </div>

      {!insights ? (
        <div className="mt-3 rounded border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">No signal history summary found yet. Refresh performance analysis to generate it.</div>
      ) : (
        <>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="rounded border border-emerald-400/20 bg-emerald-400/10 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">Currently Stronger Evidence</div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-50" title={groupTitle(bestGroup)}>{groupTitle(bestGroup)}</div>
              <div className="mt-1 text-xs text-slate-300">
                Avg {percent(bestGroup?.avg_return)} · Win rate {ratio(bestGroup?.hit_rate)} · Historical advantage {edge(bestGroup?.edge_score)}
              </div>
            </div>
            <div className="rounded border border-rose-400/20 bg-rose-400/10 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-300">Currently Weaker Evidence</div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-50" title={groupTitle(worstGroup)}>{groupTitle(worstGroup)}</div>
              <div className="mt-1 text-xs text-slate-300">
                Avg {percent(worstGroup?.avg_return)} · Win rate {ratio(worstGroup?.hit_rate)} · Historical advantage {edge(worstGroup?.edge_score)}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {cards.map((card) => <InsightCard card={card} key={card.title} />)}
          </div>

          {warnings.length || lowSampleWarnings.length ? (
            <div className="mt-3 rounded border border-amber-400/20 bg-amber-400/10 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">Evidence Notes</div>
              <ul className="mt-2 space-y-1 text-sm text-amber-100">
                {[...warnings, ...lowSampleWarnings].slice(0, 6).map((warning) => <li key={warning}>{humanizeQuantText(warning)}</li>)}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

type InsightCardModel = {
  confidence: string;
  detail: string;
  interpretation: string;
  title: string;
  tone: "good" | "warn" | "bad";
};

function buildInsightCards(insights: Record<string, unknown>, bestGroup: Record<string, unknown> | null, worstGroup: Record<string, unknown> | null, warnings: string[], lowSampleWarnings: string[]): InsightCardModel[] {
  return [
    {
      confidence: evidenceLabel(bestGroup),
      detail: humanizeQuantText(insights.score_bucket_note, "Not enough historical evidence yet."),
      interpretation: "Use score ranges as context while more signal history accumulates.",
      title: "What the scanner is learning",
      tone: warnings.length ? "warn" : "good",
    },
    {
      confidence: evidenceLabel(worstGroup),
      detail: humanizeQuantText(insights.setup_note, "Setup evidence is still developing."),
      interpretation: "Compare setup types in the detailed view before changing how you read this evidence.",
      title: "Why it matters",
      tone: "warn",
    },
    {
      confidence: lowSampleWarnings.length ? "Early/low evidence" : "Medium evidence",
      detail: humanizeQuantText(insights.rating_action_note, "Decision separation needs more observations."),
      interpretation: "Preserve conservative thresholds; these observations are research evidence only.",
      title: "Suggested interpretation",
      tone: lowSampleWarnings.length ? "warn" : "good",
    },
  ];
}

function InsightCard({ card }: { card: InsightCardModel }) {
  const tone = card.tone === "good" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : card.tone === "bad" ? "border-rose-400/20 bg-rose-400/10 text-rose-100" : "border-amber-400/20 bg-amber-400/10 text-amber-100";
  return (
    <div className={`rounded border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em]">{card.title}</div>
        <span className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-[10px] font-semibold">{card.confidence}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-200">{card.detail}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{card.interpretation}</p>
    </div>
  );
}

function evidenceLabel(group: Record<string, unknown> | null): string {
  const count = numberValue(group?.count);
  if (count !== null) {
    if (count > 100) return "High evidence";
    if (count >= 30) return "Medium evidence";
  }
  return "Early/low evidence";
}

function PerformanceHowToUse() {
  return (
    <section className="terminal-panel rounded-2xl p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">How to use this page</div>
      <h2 className="mt-1 text-lg font-semibold text-slate-50">Understand recent scanner behavior</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Use Performance to see where recent signals looked stronger or weaker after they had time to develop. Treat it as evidence quality and process review, not a promise of future returns.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ["1. Read the summary", "Start with what worked recently, what did not work, and how mature the evidence is."],
          ["2. Check uncertainty", "Low sample counts mean the system is still collecting signal history."],
          ["3. Open details only when needed", "Advanced tables stay collapsed so the default view remains scannable."],
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

function PerformanceOperationalUtilityPanel({
  forwardObservationCount,
  historyCount,
}: {
  forwardObservationCount: number;
  historyCount: number;
}) {
  const cards = [
    {
      detail: "Admin monitoring exposes request p50, p95, p99, cache-hit, hot-endpoint, and slow-route drilldowns.",
      href: "/admin/monitoring",
      label: "p50 / p95 / p99",
      value: "Monitoring",
    },
    {
      detail: "Retention, alert-return, scanner-return, watchlist-return, and notification-usefulness proof lives in admin analytics and trust monitoring.",
      href: "/admin/analytics",
      label: "Retention dashboards",
      value: "Analytics",
    },
    {
      detail: "Stream health, provider state, cache behavior, and degraded-mode signals are grouped in the production trust architecture dashboard.",
      href: "/status",
      label: "Cache / stream / provider health",
      value: "Status",
    },
    {
      detail: `${forwardObservationCount.toLocaleString()} completed signal observations and ${historyCount.toLocaleString()} saved runs feed operational drilldowns.`,
      href: "#history",
      label: "Operational drilldowns",
      value: "Evidence",
    },
  ];
  return (
    <section className="terminal-panel rounded-2xl p-5" aria-labelledby="performance-ops-heading">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Performance utility maturity</div>
          <h2 id="performance-ops-heading" className="mt-1 text-lg font-semibold text-slate-50">Operational dashboards and drilldowns</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Performance now separates scanner evidence from production observability: signal behavior is reviewed here, while route latency, retention, cache, stream, and provider health link to the operating dashboards.
          </p>
        </div>
        <Link className="inline-flex min-h-10 items-center rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href="/admin/monitoring">
          Open monitoring
        </Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link className="rounded-xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.055]" href={card.href} key={card.label}>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{card.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{card.value}</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{card.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PerformanceCinematicEvidenceSystem({
  forwardObservationCount,
  history,
  insights,
  performance,
}: {
  forwardObservationCount: number;
  history: Awaited<ReturnType<typeof getHistorySummary>>;
  insights: Record<string, unknown> | null;
  performance: Awaited<ReturnType<typeof getPerformanceData>>;
}) {
  const bestGroup = record(insights?.best_group);
  const worstGroup = record(insights?.worst_group);
  const generatedAt = text(insights?.generated_at, "");
  const returnValues = extractForwardReturnValues(performance.forwardReturns.rows);
  const evidenceCoverage = coverageScore(forwardObservationCount, 500);
  const historyCoverage = coverageScore(history.count, 50);
  const bestAvg = numberValue(bestGroup?.avg_return);
  const worstAvg = numberValue(worstGroup?.avg_return);
  const bestHitRate = numberValue(bestGroup?.hit_rate);
  const worstHitRate = numberValue(worstGroup?.hit_rate);
  const clusters: CinematicCluster[] = [
    {
      emptyMessage: "Forward signal windows are still maturing. The curve appears after enough completed observations exist.",
      eyebrow: "Evidence Cluster",
      factors: [
        scoreFactor("Signal Rows", evidenceCoverage, `${forwardObservationCount.toLocaleString()} completed signal rows`, "cyan"),
        scoreFactor("Saved Runs", historyCoverage, `${history.count.toLocaleString()} saved scanner runs`, "violet"),
        scoreFactor("Unique Dates", coverageScore(history.uniqueDates.length, 30), `${history.uniqueDates.length.toLocaleString()} unique history dates`, "emerald"),
      ],
      footer: "Evidence quality rises only as real scanner outcomes accumulate.",
      items: [
        { detail: fileStateLabel(performance.forwardReturns.state), label: "Signal rows", tone: "cyan", value: forwardObservationCount.toLocaleString() },
        { detail: "Saved scanner runs", href: "/history", label: "Signal memory", tone: "violet", value: history.count.toLocaleString() },
        { detail: "Trading days with saved scans", href: "/history", label: "Unique dates", tone: "emerald", value: history.uniqueDates.length.toLocaleString() },
      ],
      metricLabel: "coverage",
      score: evidenceCoverage,
      summary: "This surface shows how much real scanner evidence is available before interpreting any performance pattern.",
      title: "Evidence Coverage",
      tone: "cyan",
      updatedAt: generatedAt ? formatDate(generatedAt) : formatDate(history.latest),
      values: returnValues,
    },
    {
      emptyMessage: "No stronger evidence group is available yet.",
      eyebrow: "Strength Cluster",
      factors: [
        scoreFactor("Avg Return", returnScore(bestAvg), `Average observed return: ${percent(bestAvg)}`, "emerald"),
        scoreFactor("Win Rate", percentScore(bestHitRate), `Observed hit rate: ${ratio(bestHitRate)}`, "emerald"),
        scoreFactor("Edge", edgeScore(bestGroup?.edge_score), `Historical advantage: ${edge(bestGroup?.edge_score)}`, "cyan"),
      ],
      items: bestGroup ? [
        { detail: `Avg ${percent(bestGroup.avg_return)} · Win rate ${ratio(bestGroup.hit_rate)}`, label: groupTitle(bestGroup), tone: "emerald", value: edge(bestGroup.edge_score) },
      ] : [],
      metric: bestGroup ? percent(bestGroup.avg_return) : "Limited",
      metricLabel: "stronger evidence",
      summary: bestGroup ? `${groupTitle(bestGroup)} currently has the strongest observed evidence.` : "The scanner is still collecting enough grouped evidence to identify a stronger segment.",
      title: "What Worked Recently",
      tone: "emerald",
      updatedAt: generatedAt ? formatDate(generatedAt) : undefined,
      values: [bestAvg, bestHitRate, numberValue(bestGroup?.edge_score)],
    },
    {
      emptyMessage: "No weaker evidence group is available yet.",
      eyebrow: "Risk Cluster",
      factors: [
        scoreFactor("Avg Return", returnScore(worstAvg), `Average observed return: ${percent(worstAvg)}`, "rose"),
        scoreFactor("Win Rate", percentScore(worstHitRate), `Observed hit rate: ${ratio(worstHitRate)}`, "amber"),
        scoreFactor("Edge", edgeScore(worstGroup?.edge_score), `Historical advantage: ${edge(worstGroup?.edge_score)}`, "rose"),
      ],
      items: worstGroup ? [
        { detail: `Avg ${percent(worstGroup.avg_return)} · Win rate ${ratio(worstGroup.hit_rate)}`, label: groupTitle(worstGroup), tone: "rose", value: edge(worstGroup.edge_score) },
      ] : [],
      metric: worstGroup ? percent(worstGroup.avg_return) : "Limited",
      metricLabel: "weaker evidence",
      summary: worstGroup ? `${groupTitle(worstGroup)} currently has weaker observed evidence.` : "The scanner has not accumulated enough grouped evidence to isolate weaker behavior.",
      title: "What Needs Caution",
      tone: "rose",
      updatedAt: generatedAt ? formatDate(generatedAt) : undefined,
      values: [worstAvg, worstHitRate, numberValue(worstGroup?.edge_score)],
    },
    {
      emptyMessage: "No lifecycle rows are available yet.",
      eyebrow: "Lifecycle Cluster",
      items: [
        { detail: fileStateLabel(performance.lifecycle.state), label: "Signal lifecycle", tone: "violet", value: performance.lifecycle.rows.length.toLocaleString() },
        { detail: fileStateLabel(performance.lifecycleSummary.state), label: "Lifecycle summary", tone: "cyan", value: performance.lifecycleSummary.rows.length.toLocaleString() },
        { detail: fileStateLabel(performance.autoCalibration.state), label: "Guidance rows", tone: "amber", value: performance.autoCalibration.rows.length.toLocaleString() },
      ],
      metric: performance.lifecycle.rows.length.toLocaleString(),
      metricLabel: "lifecycle rows",
      summary: "Lifecycle evidence explains whether signals are still fresh, maturing, or old enough to review.",
      title: "Freshness and Signal Aging",
      tone: "violet",
      updatedAt: formatDate(history.latest),
      values: [performance.lifecycle.rows.length, performance.lifecycleSummary.rows.length, performance.autoCalibration.rows.length],
    },
  ];
  const heatCells: CinematicHeatCell[] = [
    { detail: `${forwardObservationCount.toLocaleString()} signal rows`, label: "Signal Coverage", tone: "cyan", value: evidenceCoverage },
    { detail: `${history.count.toLocaleString()} saved runs`, href: "/history", label: "Memory Depth", tone: "violet", value: historyCoverage },
    { detail: `${history.uniqueDates.length.toLocaleString()} unique dates`, href: "/history", label: "Date Coverage", tone: "emerald", value: coverageScore(history.uniqueDates.length, 30) },
    { detail: bestGroup ? groupTitle(bestGroup) : "Not enough evidence", label: "Strong Group", tone: "emerald", value: edgeScore(bestGroup?.edge_score) },
    { detail: worstGroup ? groupTitle(worstGroup) : "Not enough evidence", label: "Weak Group", tone: "rose", value: edgeScore(worstGroup?.edge_score) },
    { detail: fileStateLabel(performance.forwardReturns.state), label: "Data State", tone: performance.forwardReturns.state === "data" ? "emerald" : "amber", value: performance.forwardReturns.state === "data" ? 100 : 35 },
  ];
  const timeline: CinematicTimelineItem[] = [
    { detail: `${history.count.toLocaleString()} saved scanner runs available`, href: "/history", label: "Signal memory loaded", timestamp: formatDate(history.latest), tone: "violet" },
    { detail: `${forwardObservationCount.toLocaleString()} signal rows can be reviewed`, label: "Signal evidence checked", timestamp: generatedAt ? formatDate(generatedAt) : "Current view", tone: "cyan" },
  ];
  if (bestGroup) {
    timeline.push({ detail: `Avg ${percent(bestGroup.avg_return)} · win rate ${ratio(bestGroup.hit_rate)}`, label: `Stronger: ${groupTitle(bestGroup)}`, timestamp: "Current evidence", tone: "emerald" });
  }
  if (worstGroup) {
    timeline.push({ detail: `Avg ${percent(worstGroup.avg_return)} · win rate ${ratio(worstGroup.hit_rate)}`, label: `Weaker: ${groupTitle(worstGroup)}`, timestamp: "Current evidence", tone: "rose" });
  }

  return (
    <div className="grid gap-3">
      <CinematicClusterMosaic
        eyebrow="Performance intelligence system"
        summary="Performance is shown as evidence coverage, recent scanner behavior, weak spots, and signal aging. No chart is rendered unless real observations exist."
        title="Scanner Evidence Command Center"
        clusters={clusters}
      />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
        <CinematicHeatMatrix cells={heatCells} title="Evidence Quality Heatmap" />
        <CinematicTimeline items={timeline} title="Performance Evidence Timeline" />
      </div>
    </div>
  );
}

function scoreFactor(label: string, value: number | null, detail: string, tone: ScoreFactor["tone"]): ScoreFactor {
  return { detail, label, tone, value };
}

function coverageScore(count: number, target: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.max(0, Math.min(100, (count / target) * 100));
}

function percentScore(value: unknown): number | null {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(100, parsed * 100));
}

function edgeScore(value: unknown): number | null {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(100, 50 + parsed * 3));
}

function returnScore(value: unknown): number | null {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(100, 50 + parsed * 100));
}

function extractForwardReturnValues(rows: Awaited<ReturnType<typeof getPerformanceData>>["forwardReturns"]["rows"]): number[] {
  const keys = ["forward_return", "return", "return_pct", "ret", "avg_return", "future_return", "forward_return_pct"];
  return rows
    .slice(-24)
    .map((row) => {
      for (const key of keys) {
        const parsed = numberValue(row[key]);
        if (parsed !== null) return parsed;
      }
      return null;
    })
    .filter((value): value is number => value !== null);
}

export default async function PerformancePage() {
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) {
    return (
      <TerminalShell>
        <h1 className="sr-only">Performance</h1>
        <LegalAcceptanceRequiredState />
      </TerminalShell>
    );
  }

  if (!hasPremiumAccess(entitlement)) {
    return (
      <TerminalShell>
        <h1 className="sr-only">Performance</h1>
        <PremiumLockedState
          authenticated={entitlement.authenticated}
          description="Performance analytics show recent signal history, scanner behavior, and setup reliability. The main terminal remains available as a free market preview."
          previewItems={["Recent signal history and hit-rate summaries", "Signal freshness and behavior diagnostics", "Intraday drift and setup quality review"]}
          title={entitlement.authenticated ? "Performance is available on Premium" : "Sign in to preview performance analytics"}
        />
      </TerminalShell>
    );
  }

  const [performance, history, driftRows, rawRanking, calibrationInsights, scanSafety, historySymbols] = await Promise.all([getPerformanceData({ forwardTailRows: 5000 }), getHistorySummary(), getIntradaySignalDriftSummary(), getFullRanking(), getCalibrationInsights(), getCurrentScanSafety(), getHistorySymbolsFromSnapshots()]);
  const ranking = applyStaleDataSafetyToRows(rawRanking, scanSafety);
  const forwardReturnsReady = performance.forwardReturns.rows.length > 0;
  const forwardObservationCount = Math.max(0, performance.forwardReturns.lineCount - 1);
  const symbolSearchDocuments = buildSymbolSearchIndex({ historySymbols, rows: ranking });
  const performanceMaturity = buildPerformanceWorkflowMaturityModel({ history, performance, rankingRows: ranking });

  return (
    <TerminalShell>
      <div className="space-y-3">
        <h1 className="sr-only">Performance</h1>
        <div id="summary">
          <MetricStrip
            metrics={[
              { label: "Summary Rows", value: performance.summary.rows.length.toLocaleString(), meta: fileStateLabel(performance.summary.state) },
              { label: "Signal Rows", value: forwardObservationCount.toLocaleString(), meta: fileStateLabel(performance.forwardReturns.state) },
              { label: "Saved Runs", value: history.count.toLocaleString(), meta: "signal memory" },
              { label: "Unique Dates", value: history.uniqueDates.length.toLocaleString(), meta: "history depth" },
              { label: "Earliest", value: formatDate(history.earliest), meta: "history" },
              { label: "Latest", value: formatDate(history.latest), meta: "history" },
            ]}
          />
        </div>

        <PerformanceHowToUse />

        <UtilitySurfaceMaturityPanel surfaceId="performance" />

        <SymbolCommandSearch documents={symbolSearchDocuments} title="Search symbols from performance, history, and scanner evidence" />

        <PerformanceOperationalUtilityPanel forwardObservationCount={forwardObservationCount} historyCount={history.count} />

        <PerformanceWorkflowMaturityPanel model={performanceMaturity} />

        <PerformanceCinematicEvidenceSystem
          forwardObservationCount={forwardObservationCount}
          history={history}
          insights={calibrationInsights}
          performance={performance}
        />

        <div id="evidence">
          <CalibrationInsightsPanel insights={calibrationInsights} />
        </div>

        <details className="terminal-panel rounded-2xl p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-100 marker:text-cyan-300">Signal history details</summary>
          <div className="mt-4 space-y-3">
            <AutoCalibrationRecommendations rows={performance.autoCalibration.rows} state={performance.autoCalibration.state} />
            <SignalLifecycle rows={performance.lifecycle.rows} summaryRows={performance.lifecycleSummary.rows} />
          </div>
        </details>

        <div id="history">
        <ResponsiveAdvancedDetails
          deferMount
          eyebrow="Detailed signal history"
          summary="Open for grouped result tables, detailed signal evidence, drift checks, and manual refresh controls."
          title="Signal history and scanner drift"
        >
          <PerformanceValidation forwardObservationCount={forwardObservationCount} forwardRows={performance.forwardReturns.rows} history={history} rankingRows={ranking} summaryRows={performance.summary.rows} />

          <section className="terminal-panel rounded-2xl p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Refresh Data</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Refresh Performance Analysis</h2>
            <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-400">
              Refresh recent signal history, scanner behavior, drift, and setup-quality views from the current data.
            </p>
            <RunCommandButton endpoint="/api/run-analysis" label="Refresh Analysis" />
          </section>

          <PerformanceDrift forwardReturnsReady={forwardReturnsReady} rows={driftRows} />
        </ResponsiveAdvancedDetails>
        </div>
      </div>
    </TerminalShell>
  );
}
