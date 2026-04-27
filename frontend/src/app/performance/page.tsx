import { MetricStrip } from "@/components/metric-strip";
import { PerformanceDrift } from "@/components/performance-drift";
import { PerformanceValidation } from "@/components/performance-validation";
import { RunCommandButton } from "@/components/run-command-button";
import { TerminalShell } from "@/components/shell";
import { SignalLifecycle } from "@/components/signal-lifecycle";
import { getCalibrationInsights, getFullRanking, getHistorySummary, getIntradaySignalDriftSummary, getPerformanceData } from "@/lib/scanner-data";

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
  return `${text(group.group_type, "group")}=${text(group.group_value, "unknown")} on ${text(group.horizon, "unknown")}`;
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

  return (
    <section className="terminal-panel rounded-md p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Calibration Insights</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Signal Calibration Readout</h2>
          <p className="mt-1 text-sm text-slate-400">Uses completed forward-return observations to highlight which signal buckets are showing edge.</p>
        </div>
        <div className="font-mono text-xs text-slate-500">{generatedAt ? `Generated ${formatDate(generatedAt)}` : "Not generated yet"}</div>
      </div>

      {!insights ? (
        <div className="mt-3 rounded border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">No calibration insights file found. Run performance analysis to generate it.</div>
      ) : (
        <>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="rounded border border-emerald-400/20 bg-emerald-400/10 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">Best Group</div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-50" title={groupTitle(bestGroup)}>{groupTitle(bestGroup)}</div>
              <div className="mt-1 text-xs text-slate-300">
                Avg {percent(bestGroup?.avg_return)} · Hit {ratio(bestGroup?.hit_rate)} · Edge {edge(bestGroup?.edge_score)}
              </div>
            </div>
            <div className="rounded border border-rose-400/20 bg-rose-400/10 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-300">Worst Group</div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-50" title={groupTitle(worstGroup)}>{groupTitle(worstGroup)}</div>
              <div className="mt-1 text-xs text-slate-300">
                Avg {percent(worstGroup?.avg_return)} · Hit {ratio(worstGroup?.hit_rate)} · Edge {edge(worstGroup?.edge_score)}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            <div className="rounded border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Score Bucket Note</div>
              <p className="mt-1 text-sm text-slate-300">{text(insights.score_bucket_note)}</p>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Setup Note</div>
              <p className="mt-1 text-sm text-slate-300">{text(insights.setup_note)}</p>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Rating / Action Note</div>
              <p className="mt-1 text-sm text-slate-300">{text(insights.rating_action_note)}</p>
            </div>
          </div>

          {warnings.length || lowSampleWarnings.length ? (
            <div className="mt-3 rounded border border-amber-400/20 bg-amber-400/10 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">Warnings</div>
              <ul className="mt-2 space-y-1 text-sm text-amber-100">
                {[...warnings, ...lowSampleWarnings].slice(0, 6).map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export default async function PerformancePage() {
  const [performance, history, driftRows, ranking, calibrationInsights] = await Promise.all([getPerformanceData({ forwardTailRows: 5000 }), getHistorySummary(), getIntradaySignalDriftSummary(), getFullRanking(), getCalibrationInsights()]);
  const forwardReturnsReady = performance.forwardReturns.rows.length > 0;
  const forwardObservationCount = Math.max(0, performance.forwardReturns.lineCount - 1);

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Summary Rows", value: performance.summary.rows.length.toLocaleString(), meta: fileStateLabel(performance.summary.state) },
            { label: "Forward Rows", value: forwardObservationCount.toLocaleString(), meta: fileStateLabel(performance.forwardReturns.state) },
            { label: "Snapshots", value: history.count.toLocaleString(), meta: "history files" },
            { label: "Unique Dates", value: history.uniqueDates.length.toLocaleString(), meta: "needed for returns" },
            { label: "Earliest", value: formatDate(history.earliest), meta: "snapshot" },
            { label: "Latest", value: formatDate(history.latest), meta: "snapshot" },
          ]}
        />

        <CalibrationInsightsPanel insights={calibrationInsights} />

        <PerformanceValidation forwardObservationCount={forwardObservationCount} forwardRows={performance.forwardReturns.rows} history={history} rankingRows={ranking} summaryRows={performance.summary.rows} />

        <SignalLifecycle rows={performance.lifecycle.rows} summaryRows={performance.lifecycleSummary.rows} />

        <section className="terminal-panel rounded-md p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Analysis Runner</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Refresh Performance Analysis</h2>
          <pre className="mt-3 overflow-x-auto rounded border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
            python investment_scanner_mvp.py --run-analysis
          </pre>
          <RunCommandButton endpoint="/api/run-analysis" label="Run Analysis" />
        </section>

        <PerformanceDrift forwardReturnsReady={forwardReturnsReady} rows={driftRows} />
      </div>
    </TerminalShell>
  );
}
