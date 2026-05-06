import { MetricStrip } from "@/components/metric-strip";
import { AutoCalibrationRecommendations } from "@/components/auto-calibration-recommendations";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { PerformanceDrift } from "@/components/performance-drift";
import { PerformanceValidation } from "@/components/performance-validation";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { RunCommandButton } from "@/components/run-command-button";
import { TerminalShell } from "@/components/shell";
import { SignalLifecycle } from "@/components/signal-lifecycle";
import { SimpleAdvancedTabs } from "@/components/ui/SimpleAdvancedTabs";
import { getCalibrationInsights, getFullRanking, getHistorySummary, getIntradaySignalDriftSummary, getPerformanceData } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";
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
  if (label) return label;
  return `${humanizeLabel(group.group_type, "Group")} ${humanizeLabel(group.group_value, "unknown")} over ${text(group.horizon, "unknown")}`;
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
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Calibration Insights</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Scanner Learning Readout</h2>
          <p className="mt-1 text-sm text-slate-400">Plain-English historical evidence from completed forward-return observations. It does not auto-tune the scanner.</p>
        </div>
        <div className="font-mono text-xs text-slate-500">{generatedAt ? `Generated ${formatDate(generatedAt)}` : "Not generated yet"}</div>
      </div>

      {!insights ? (
        <div className="mt-3 rounded border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">No calibration insights file found. Run performance analysis to generate it.</div>
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
      interpretation: "Use score ranges as context until more forward-return observations accumulate.",
      title: "What the scanner is learning",
      tone: warnings.length ? "warn" : "good",
    },
    {
      confidence: evidenceLabel(worstGroup),
      detail: humanizeQuantText(insights.setup_note, "Setup evidence is still developing."),
      interpretation: "Compare setup types in Advanced before changing any calibration assumptions.",
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

export default async function PerformancePage() {
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
          description="Performance validation, calibration, lifecycle tables, and drift analysis are premium diagnostics. The main terminal remains available as a free market preview."
          previewItems={["Forward-return validation and hit-rate summaries", "Signal lifecycle and calibration diagnostics", "Intraday drift and setup quality review"]}
          title={entitlement.authenticated ? "Performance is available on Premium" : "Sign in to preview performance analytics"}
        />
      </TerminalShell>
    );
  }

  const [performance, history, driftRows, rawRanking, calibrationInsights, scanSafety] = await Promise.all([getPerformanceData({ forwardTailRows: 5000 }), getHistorySummary(), getIntradaySignalDriftSummary(), getFullRanking(), getCalibrationInsights(), getCurrentScanSafety()]);
  const ranking = applyStaleDataSafetyToRows(rawRanking, scanSafety);
  const forwardReturnsReady = performance.forwardReturns.rows.length > 0;
  const forwardObservationCount = Math.max(0, performance.forwardReturns.lineCount - 1);

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Summary Rows", value: performance.summary.rows.length.toLocaleString(), meta: fileStateLabel(performance.summary.state) },
            { label: "Forward Rows", value: forwardObservationCount.toLocaleString(), meta: fileStateLabel(performance.forwardReturns.state) },
            { label: "Saved Runs", value: history.count.toLocaleString(), meta: "signal memory" },
            { label: "Unique Dates", value: history.uniqueDates.length.toLocaleString(), meta: "needed for returns" },
            { label: "Earliest", value: formatDate(history.earliest), meta: "history" },
            { label: "Latest", value: formatDate(history.latest), meta: "history" },
          ]}
        />

        <CalibrationInsightsPanel insights={calibrationInsights} />

        <SimpleAdvancedTabs
          simple={(
            <section className="terminal-panel rounded-md p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Summary View</div>
              <p className="mt-1 text-sm leading-6 text-slate-400">Calibration summaries and validation cards are shown by default. Open Advanced for calibration recommendation and lifecycle tables.</p>
            </section>
          )}
          advanced={(
            <>
              <AutoCalibrationRecommendations rows={performance.autoCalibration.rows} state={performance.autoCalibration.state} />
              <SignalLifecycle rows={performance.lifecycle.rows} summaryRows={performance.lifecycleSummary.rows} />
            </>
          )}
        />

        <PerformanceValidation forwardObservationCount={forwardObservationCount} forwardRows={performance.forwardReturns.rows} history={history} rankingRows={ranking} summaryRows={performance.summary.rows} />

        <section className="terminal-panel rounded-2xl p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Analysis Runner</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Refresh Performance Analysis</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Refresh validation, lifecycle, drift, and calibration views for the current signal history. If manual execution is unavailable from the web container, scheduled analysis jobs continue to update this page after new scanner data is available.
          </p>
          <RunCommandButton endpoint="/api/run-analysis" label="Refresh Analysis" />
        </section>

        <PerformanceDrift forwardReturnsReady={forwardReturnsReady} rows={driftRows} />
      </div>
    </TerminalShell>
  );
}
