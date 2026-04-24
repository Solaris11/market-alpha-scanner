import { DataTable } from "@/components/data-table";
import { MetricStrip } from "@/components/metric-strip";
import { RunCommandButton } from "@/components/run-command-button";
import { TerminalShell } from "@/components/shell";
import { getHistorySummary, getPerformanceData } from "@/lib/scanner-data";

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

export default async function PerformancePage() {
  const [performance, history] = await Promise.all([getPerformanceData(), getHistorySummary()]);
  const hasPerformance = performance.summary.rows.length > 0 || performance.forwardReturns.rows.length > 0;
  const isHeaderOnly = !hasPerformance && (performance.summary.state === "header-only" || performance.forwardReturns.state === "header-only");

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Summary Rows", value: performance.summary.rows.length.toLocaleString(), meta: fileStateLabel(performance.summary.state) },
            { label: "Forward Rows", value: performance.forwardReturns.rows.length.toLocaleString(), meta: fileStateLabel(performance.forwardReturns.state) },
            { label: "Snapshots", value: history.count.toLocaleString(), meta: "history files" },
            { label: "Unique Dates", value: history.uniqueDates.length.toLocaleString(), meta: "needed for returns" },
            { label: "Earliest", value: formatDate(history.earliest), meta: "snapshot" },
            { label: "Latest", value: formatDate(history.latest), meta: "snapshot" },
          ]}
        />

        {!hasPerformance ? (
          <section className="terminal-panel rounded-md p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Readiness</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">{isHeaderOnly ? "Analysis Complete, No Observations Yet" : "Performance Analysis Not Ready"}</h2>
            {isHeaderOnly ? (
              <div className="mt-2 max-w-3xl space-y-1 text-sm text-slate-400">
                <p>Analysis ran successfully, but no completed forward-return observations exist yet.</p>
                <p>Saved history exists, but all snapshots are too recent or from the same trading day.</p>
              </div>
            ) : (
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Forward-return analysis needs saved scanner history from earlier trading days. If history exists but all snapshots are from the same day, there are no completed forward-return windows yet.
              </p>
            )}
            <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-4">
              <div className="rounded border border-slate-800 bg-slate-950/50 p-2">Snapshots: {history.count.toLocaleString()}</div>
              <div className="rounded border border-slate-800 bg-slate-950/50 p-2">Unique dates: {history.uniqueDates.length.toLocaleString()}</div>
              <div className="rounded border border-slate-800 bg-slate-950/50 p-2">Earliest: {formatDate(history.earliest)}</div>
              <div className="rounded border border-slate-800 bg-slate-950/50 p-2">Latest: {formatDate(history.latest)}</div>
            </div>
            <pre className="mt-3 overflow-x-auto rounded border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
              python investment_scanner_mvp.py --run-analysis
            </pre>
            <RunCommandButton endpoint="/api/run-analysis" label="Run Analysis" />
          </section>
        ) : null}

        {hasPerformance ? (
          <section className="terminal-panel rounded-md p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Analysis Runner</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Refresh Performance Analysis</h2>
            <pre className="mt-3 overflow-x-auto rounded border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
              python investment_scanner_mvp.py --run-analysis
            </pre>
            <RunCommandButton endpoint="/api/run-analysis" label="Run Analysis" />
          </section>
        ) : null}

        <section>
          <div className="mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Performance Summary</div>
            <h2 className="text-lg font-semibold text-slate-50">Grouped Results</h2>
          </div>
          <DataTable
            rows={performance.summary.rows}
            emptyMessage={
              performance.summary.state === "header-only"
                ? "performance_summary.csv exists with headers only. No grouped performance observations are complete yet."
                : "performance_summary.csv is missing."
            }
          />
        </section>

        <section>
          <div className="mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Forward Returns</div>
            <h2 className="text-lg font-semibold text-slate-50">Observation Rows</h2>
          </div>
          <DataTable
            rows={performance.forwardReturns.rows}
            emptyMessage={
              performance.forwardReturns.state === "header-only"
                ? "forward_returns.csv exists with headers only. No completed forward-return observations are available yet."
                : "forward_returns.csv is missing."
            }
          />
        </section>
      </div>
    </TerminalShell>
  );
}
