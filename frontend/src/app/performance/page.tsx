import { MetricStrip } from "@/components/metric-strip";
import { PerformanceDrift } from "@/components/performance-drift";
import { PerformanceValidation } from "@/components/performance-validation";
import { RunCommandButton } from "@/components/run-command-button";
import { TerminalShell } from "@/components/shell";
import { buildIntradaySignalDrift, getFullRanking, getHistorySummary, getPerformanceData, getSymbolHistoryData } from "@/lib/scanner-data";

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
  const [performance, history, symbolHistory, ranking] = await Promise.all([getPerformanceData(), getHistorySummary(), getSymbolHistoryData(), getFullRanking()]);
  const driftRows = buildIntradaySignalDrift(symbolHistory);
  const forwardReturnsReady = performance.forwardReturns.rows.length > 0;

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

        <PerformanceValidation forwardRows={performance.forwardReturns.rows} history={history} rankingRows={ranking} summaryRows={performance.summary.rows} />

        <section className="terminal-panel rounded-md p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Analysis Runner</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Refresh Performance Analysis</h2>
          <pre className="mt-3 overflow-x-auto rounded border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
            python investment_scanner_mvp.py --run-analysis
          </pre>
          <RunCommandButton endpoint="/api/run-analysis" label="Run Analysis" />
        </section>

        <PerformanceDrift forwardReturnsReady={forwardReturnsReady} rows={driftRows} symbolHistory={symbolHistory} />
      </div>
    </TerminalShell>
  );
}
