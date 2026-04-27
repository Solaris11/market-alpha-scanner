import { MetricStrip } from "@/components/metric-strip";
import { OverviewWorkspace } from "@/components/overview-workspace";
import { TerminalShell } from "@/components/shell";
import { getAlertOverview } from "@/lib/alerts";
import { formatNumber } from "@/lib/format";
import { getFullRanking, getScanDataHealth, getTopCandidates, type ScanDataHealth } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

function countBy(rows: { rating?: string }[], rating: string) {
  return rows.filter((row) => String(row.rating ?? "").toUpperCase() === rating).length;
}

function formatScanTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function DataHealthBanner({ health }: { health: ScanDataHealth }) {
  const tone = health.status === "fresh" ? "border-slate-800 bg-slate-950/50 text-slate-400" : health.status === "stale" ? "border-amber-400/30 bg-amber-400/10 text-amber-100" : "border-rose-400/30 bg-rose-400/10 text-rose-100";
  const label = health.status === "missing" ? "❌ No scan data available" : health.status === "schema_mismatch" ? "❌ Data schema mismatch" : health.status === "stale" ? `⚠ ${health.message}` : "Data is fresh";

  return (
    <section className={`rounded-md border px-3 py-2 text-sm ${tone}`}>
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div className="font-semibold">{label}</div>
        <div className="font-mono text-xs">Last Scan Time: {formatScanTime(health.lastUpdated)}</div>
      </div>
    </section>
  );
}

export default async function DashboardOverview() {
  const [ranking, topCandidates, alertOverview, dataHealth] = await Promise.all([
    getFullRanking(),
    getTopCandidates(),
    getAlertOverview({ stateLimit: 25 }).catch(() => ({ rules: [], state: { alerts: {} } })),
    getScanDataHealth(),
  ]);
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
            { label: "Data", value: ranking.length ? "Live" : "Missing", meta: "latest scan" },
          ]}
        />

        <DataHealthBanner health={dataHealth} />

        <OverviewWorkspace alertRules={alertOverview.rules} alertState={alertOverview.state} ranking={ranking} topCandidates={topCandidates} />
      </div>
    </TerminalShell>
  );
}
