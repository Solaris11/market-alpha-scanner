import { MetricStrip } from "@/components/metric-strip";
import { OverviewWorkspace } from "@/components/overview-workspace";
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

        <OverviewWorkspace ranking={ranking} topCandidates={topCandidates} />
      </div>
    </TerminalShell>
  );
}
