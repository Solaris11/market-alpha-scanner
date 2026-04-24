import { MetricStrip } from "@/components/metric-strip";
import { TerminalShell } from "@/components/shell";
import { getFullRanking, getHistorySummary, getTopCandidates, scannerOutputDir } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const [ranking, topCandidates, history] = await Promise.all([getFullRanking(), getTopCandidates(), getHistorySummary()]);

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Ranking Rows", value: ranking.length.toLocaleString(), meta: "full_ranking.csv" },
            { label: "Top Candidates", value: topCandidates.length.toLocaleString(), meta: "top_candidates.csv" },
            { label: "Snapshots", value: history.count.toLocaleString(), meta: "history" },
            { label: "Output", value: ranking.length ? "Ready" : "Missing", meta: "scanner_output" },
          ]}
        />

        <section className="terminal-panel rounded-md p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Scanner</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Run Action Not Wired Yet</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            The Next.js frontend is read-only for scanner execution in this first pass. Use the existing Python command from the project root to generate fresh CSVs.
          </p>
          <pre className="mt-3 overflow-x-auto rounded border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
            python investment_scanner_mvp.py --save-history
          </pre>
          <div className="mt-3 text-xs text-slate-500">Reading output from: {scannerOutputDir()}</div>
        </section>
      </div>
    </TerminalShell>
  );
}
