import { MetricStrip } from "@/components/metric-strip";
import { OverviewWorkspace } from "@/components/overview-workspace";
import { TerminalShell } from "@/components/shell";
import { getAlertOverview } from "@/lib/alerts";
import { formatNumber } from "@/lib/format";
import { getFullRanking, getMarketRegime, getMarketStructure, getScanDataHealth, getTopCandidates, type ScanDataHealth } from "@/lib/scanner-data";

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

function regimeTone(regime: string) {
  if (regime === "RISK_ON") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (regime === "OVERHEATED") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  if (regime === "PULLBACK") return "border-sky-400/30 bg-sky-400/10 text-sky-100";
  if (regime === "RISK_OFF") return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  return "border-slate-800 bg-slate-950/50 text-slate-300";
}

function text(value: unknown, fallback = "N/A") {
  const raw = String(value ?? "").trim();
  return raw && !["nan", "none", "null"].includes(raw.toLowerCase()) ? raw : fallback;
}

function numberText(value: unknown, fallback = "N/A") {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed).toString() : fallback;
}

function percentText(value: unknown, fallback = "N/A") {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? `${Math.round(parsed * 100)}%` : fallback;
}

function MarketRegimePanel({ regime }: { regime: Record<string, unknown> | null }) {
  const label = text(regime?.regime, "UNKNOWN").toUpperCase();
  const trend = text(regime?.trend, "UNKNOWN").toUpperCase();
  const confidence = numberText(regime?.confidence);
  return (
    <section className={`rounded-md border px-3 py-2 ${regimeTone(label)}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">Market Regime</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded border border-current/30 px-2 py-0.5 text-xs font-bold">{label}</span>
            <span className="text-sm">Trend: <span className="font-semibold">{trend}</span></span>
            <span className="text-sm">Confidence: <span className="font-mono font-semibold">{confidence}</span></span>
          </div>
        </div>
        <div className="text-xs opacity-75">Soft modifier only. Base scanner score is unchanged.</div>
      </div>
    </section>
  );
}

function structureTone(structure: Record<string, unknown> | null) {
  const breadth = text(structure?.breadth, "UNKNOWN").toUpperCase();
  const leadership = text(structure?.leadership, "UNKNOWN").toUpperCase();
  if (breadth === "STRONG" && leadership === "BALANCED") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  if (breadth === "WEAK" && leadership === "CONCENTRATED") return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  return "border-amber-400/30 bg-amber-400/10 text-amber-100";
}

function MarketStructurePanel({ structure }: { structure: Record<string, unknown> | null }) {
  const breadth = text(structure?.breadth, "UNKNOWN").toUpperCase();
  const leadership = text(structure?.leadership, "UNKNOWN").toUpperCase();
  const topDrivers = Array.isArray(structure?.top_3_symbols) ? structure.top_3_symbols.map((item) => String(item)).join(", ") : "N/A";
  const warning = text(structure?.warning, "Market structure is not available yet.");
  return (
    <section className={`rounded-md border px-3 py-2 ${structureTone(structure)}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">Market Structure</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm">Breadth: <span className="font-semibold">{breadth}</span></span>
            <span className="text-sm">Leadership: <span className="font-semibold">{leadership}</span></span>
            <span className="text-sm">Breadth Ratio: <span className="font-mono font-semibold">{percentText(structure?.breadth_ratio)}</span></span>
            <span className="text-sm">Top 3: <span className="font-mono font-semibold">{topDrivers}</span></span>
          </div>
        </div>
        <div className="max-w-xl text-xs opacity-80">{warning}</div>
      </div>
    </section>
  );
}

export default async function DashboardOverview() {
  const [ranking, topCandidates, alertOverview, dataHealth, marketRegime, marketStructure] = await Promise.all([
    getFullRanking(),
    getTopCandidates(),
    getAlertOverview({ stateLimit: 25 }).catch(() => ({ rules: [], state: { alerts: {} } })),
    getScanDataHealth(),
    getMarketRegime(),
    getMarketStructure(),
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

        <MarketRegimePanel regime={marketRegime} />
        <MarketStructurePanel structure={marketStructure} />

        <OverviewWorkspace alertRules={alertOverview.rules} alertState={alertOverview.state} ranking={ranking} topCandidates={topCandidates} />
      </div>
    </TerminalShell>
  );
}
