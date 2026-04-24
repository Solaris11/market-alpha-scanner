import { DataTable } from "@/components/data-table";
import { MetricStrip } from "@/components/metric-strip";
import { TerminalShell } from "@/components/shell";
import { getHistorySummary, getPerformanceData } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const [performance, history] = await Promise.all([getPerformanceData(), getHistorySummary()]);
  const hasPerformance = performance.summary.length > 0 || performance.forwardReturns.length > 0;

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Summary Rows", value: performance.summary.length.toLocaleString(), meta: "performance_summary.csv" },
            { label: "Forward Rows", value: performance.forwardReturns.length.toLocaleString(), meta: "forward_returns.csv" },
            { label: "Snapshots", value: history.count.toLocaleString(), meta: "history files" },
            { label: "Unique Dates", value: history.uniqueDates.length.toLocaleString(), meta: "needed for returns" },
          ]}
        />

        {!hasPerformance ? (
          <section className="terminal-panel rounded-md p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Readiness</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Performance Analysis Not Ready</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Forward-return analysis needs saved scanner history from earlier trading days. If history exists but all snapshots are from the same day, there are no completed forward-return windows yet.
            </p>
            <pre className="mt-3 overflow-x-auto rounded border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
              python investment_scanner_mvp.py --run-analysis
            </pre>
          </section>
        ) : null}

        <section>
          <div className="mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Performance Summary</div>
            <h2 className="text-lg font-semibold text-slate-50">Grouped Results</h2>
          </div>
          <DataTable rows={performance.summary} emptyMessage="performance_summary.csv is missing or empty." />
        </section>

        <section>
          <div className="mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Forward Returns</div>
            <h2 className="text-lg font-semibold text-slate-50">Observation Rows</h2>
          </div>
          <DataTable rows={performance.forwardReturns} emptyMessage="forward_returns.csv is missing or empty." />
        </section>
      </div>
    </TerminalShell>
  );
}
