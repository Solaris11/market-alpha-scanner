import Link from "next/link";
import { MetricStrip } from "@/components/metric-strip";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { RunCommandButton } from "@/components/run-command-button";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { getAlertOverview } from "@/lib/alerts";
import { getFullRanking, getHistorySummary, getTopCandidates } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return value.replace("T", " ").replace("Z", " UTC");
}

export default async function AdvancedPage() {
  const entitlement = await getEntitlement();
  if (!hasPremiumAccess(entitlement)) {
    return (
      <TerminalShell>
        <PremiumLockedState
          authenticated={entitlement.authenticated}
          description="Raw scanner visibility, operational diagnostics, and snapshot inspection are premium/admin-oriented tools. The main terminal stays focused on the current market action."
          previewItems={["Raw ranking and candidate diagnostics", "Scanner snapshot inventory", "Operational command visibility with server-side protections"]}
          title={entitlement.authenticated ? "Advanced diagnostics are available on Premium" : "Sign in to preview advanced diagnostics"}
        />
      </TerminalShell>
    );
  }

  const [ranking, topCandidates, history, alerts] = await Promise.all([getFullRanking(), getTopCandidates(), getHistorySummary(), getAlertOverview({ stateLimit: 25 })]);

  return (
    <TerminalShell>
      <div className="space-y-5">
        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
          <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Advanced Diagnostics</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">Operations and raw scanner visibility</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Technical controls and raw data references live here so the main terminal stays focused on decisions, risk, and trade planning.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <RunCommandButton diagnostic endpoint="/api/run-scanner" label="Refresh Signals" />
            <RunCommandButton diagnostic endpoint="/api/run-analysis" label="Refresh Analysis" />
            <Link className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition-all duration-200 hover:border-cyan-400/40 hover:bg-white/5 hover:text-cyan-100" href="/scanner">
              Scanner controls
            </Link>
          </div>
        </section>

        <MetricStrip
          metrics={[
            { label: "Ranking Rows", value: ranking.length.toLocaleString(), meta: "full_ranking.csv" },
            { label: "Top Candidates", value: topCandidates.length.toLocaleString(), meta: "top_candidates.csv" },
            { label: "Snapshot Files", value: history.count.toLocaleString(), meta: "scanner_output/history" },
            { label: "Alert Rules", value: alerts.activeCount.toLocaleString(), meta: "enabled" },
            { label: "Earliest", value: formatDate(history.earliest), meta: "history" },
            { label: "Latest", value: formatDate(history.latest), meta: "history" },
          ]}
        />

        <details className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-400 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.22em] text-slate-400">Command examples</summary>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {[
              "python investment_scanner_mvp.py --save-history",
              "python investment_scanner_mvp.py --save-history --send-alerts",
              "python investment_scanner_mvp.py --run-analysis",
            ].map((command) => (
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-300" key={command}>
                {command}
              </pre>
            ))}
          </div>
        </details>

        <details className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-400 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.22em] text-slate-400">Raw snapshot files</summary>
          <div className="mt-3 text-xs text-slate-500">Showing {Math.min(history.snapshots.length, 200).toLocaleString()} of {history.snapshots.length.toLocaleString()} files.</div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[760px] table-fixed border-collapse text-xs">
              <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2 text-left">Timestamp</th>
                  <th className="px-3 py-2 text-left">Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/90">
                {history.snapshots.slice(0, 200).map((snapshot) => (
                  <tr className="hover:bg-white/[0.03]" key={snapshot.name}>
                    <td className="truncate px-3 py-2 font-mono text-slate-300">{snapshot.name}</td>
                    <td className="truncate px-3 py-2 text-slate-400">{formatDate(snapshot.timestamp)}</td>
                    <td className="truncate px-3 py-2 text-slate-400">{formatDate(snapshot.modifiedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </TerminalShell>
  );
}
