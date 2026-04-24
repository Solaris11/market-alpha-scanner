import { MetricStrip } from "@/components/metric-strip";
import { RunCommandButton } from "@/components/run-command-button";
import { TerminalShell } from "@/components/shell";
import { getAlertOverview } from "@/lib/alerts";
import { getFullRanking, getHistorySummary, getTopCandidates, scannerOutputDir } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const [ranking, topCandidates, history, alerts] = await Promise.all([getFullRanking(), getTopCandidates(), getHistorySummary(), getAlertOverview()]);

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Ranking Rows", value: ranking.length.toLocaleString(), meta: "full_ranking.csv" },
            { label: "Top Candidates", value: topCandidates.length.toLocaleString(), meta: "top_candidates.csv" },
            { label: "Snapshots", value: history.count.toLocaleString(), meta: "history" },
            { label: "Alert Rules", value: alerts.activeCount.toLocaleString(), meta: "enabled" },
          ]}
        />

        <section className="terminal-panel rounded-md p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Scanner</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Run Scanner</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Launch the existing Python scanner from the Next.js frontend. This runs the same command you would run manually from the project root.
          </p>
          <pre className="mt-3 overflow-x-auto rounded border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
            python investment_scanner_mvp.py --save-history
          </pre>
          <RunCommandButton endpoint="/api/run-scanner" label="Run Scanner" />
          <div className="mt-3 text-xs text-slate-500">Reading output from: {scannerOutputDir()}</div>
        </section>

        <section className="terminal-panel rounded-md p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Alerts</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Rule Engine</h2>
          <div className="mt-2 grid gap-2 text-xs text-slate-400 md:grid-cols-3">
            <div className="rounded border border-slate-800 bg-slate-950/50 p-2">Active rules: {alerts.activeCount.toLocaleString()}</div>
            <div className="rounded border border-slate-800 bg-slate-950/50 p-2">Last sent: {alerts.lastSentAt ?? "Never"}</div>
            <div className="truncate rounded border border-slate-800 bg-slate-950/50 p-2" title={alerts.rulesPath}>
              Rules: {alerts.rulesPath}
            </div>
          </div>
          <pre className="mt-3 overflow-x-auto rounded border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
            python investment_scanner_mvp.py --save-history --send-alerts
          </pre>
        </section>
      </div>
    </TerminalShell>
  );
}
