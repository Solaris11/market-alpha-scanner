import { MetricStrip } from "@/components/metric-strip";
import { OverviewWorkspace } from "@/components/overview-workspace";
import { RankingTable } from "@/components/ranking-table";
import { TerminalShell } from "@/components/shell";
import { formatNumber } from "@/lib/format";
import { getFullRanking, getTopCandidates } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

function countBy(rows: { rating?: string }[], rating: string) {
  return rows.filter((row) => String(row.rating ?? "").toUpperCase() === rating).length;
}

export default async function DashboardOverview() {
  const [ranking, topCandidates] = await Promise.all([getFullRanking(), getTopCandidates()]);
  const leader = ranking[0];
  const averageScore = ranking.length
    ? ranking.reduce((total, row) => total + (typeof row.final_score === "number" ? row.final_score : 0), 0) / ranking.length
    : 0;

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Universe", value: ranking.length.toLocaleString(), meta: "symbols" },
            { label: "Leader", value: leader?.symbol ?? "N/A", meta: leader?.company_name || "latest scan" },
            { label: "Avg Score", value: ranking.length ? formatNumber(averageScore) : "N/A", meta: "full ranking" },
            { label: "TOP", value: countBy(ranking, "TOP"), meta: "signals" },
            { label: "ACTIONABLE", value: countBy(ranking, "ACTIONABLE"), meta: "signals" },
            { label: "WATCH", value: countBy(ranking, "WATCH"), meta: "signals" },
            { label: "PASS", value: countBy(ranking, "PASS"), meta: "signals" },
            { label: "Data", value: ranking.length ? "Live" : "Missing", meta: "scanner_output" },
          ]}
        />

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_520px]">
          <OverviewWorkspace ranking={ranking} />

          <aside className="space-y-3">
            <section>
              <div className="mb-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Top Candidates</div>
                <h2 className="text-lg font-semibold text-slate-50">High Conviction</h2>
              </div>
              <RankingTable rows={topCandidates} highlight limit={10} />
            </section>

            <section className="terminal-panel rounded-md p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Watchlist</div>
              <div className="mt-2 divide-y divide-slate-800 text-xs text-slate-400">
                {["Add symbols from detail pages", "Local persistence to be wired next"].map((item) => (
                  <div className="py-2" key={item}>
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </TerminalShell>
  );
}
