import Link from "next/link";
import type { ActiveAlertMatch } from "@/lib/active-alert-matches";
import type { MarketRegime } from "@/lib/adapters/DataServiceAdapter";
import type { RankingRow } from "@/lib/types";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

type ScanSafetySummary = {
  active?: boolean;
  reason?: string;
  status?: string;
};

export function TerminalRightRail({
  alertMatches,
  marketRegime,
  rows,
  scanSafety,
  watchlistSymbols,
}: {
  alertMatches: ActiveAlertMatch[];
  marketRegime: MarketRegime;
  rows: RankingRow[];
  scanSafety: ScanSafetySummary;
  watchlistSymbols: string[];
}) {
  const rowBySymbol = new Map(rows.map((row) => [row.symbol.toUpperCase(), row]));
  const watchlistRows = watchlistSymbols.map((symbol) => ({ row: rowBySymbol.get(symbol.toUpperCase()) ?? null, symbol })).slice(0, 8);
  const candidates = topWatchCandidates(rows);
  const explanation = marketContextExplanation(rows, marketRegime, scanSafety);

  return (
    <aside className="space-y-4">
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Watchlist" title="Tracked Signals" meta={`${watchlistSymbols.length} saved`} />
        <div className="mt-4 space-y-2">
          {watchlistRows.length ? (
            watchlistRows.map((item) => <RightRailSignalRow key={item.symbol} row={item.row} symbol={item.symbol} />)
          ) : (
            <EmptyRailState href="/opportunities" label="Add symbols to watchlist" />
          )}
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Alerts" title="Active Alerts" meta={`${alertMatches.length} matches`} />
        <div className="mt-4 space-y-2">
          {alertMatches.length ? (
            alertMatches.slice(0, 5).map((match) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={`${match.rule_id ?? "rule"}-${match.symbol}-${match.signal}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-semibold text-slate-100">{match.symbol}</span>
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-100">{match.notification_status}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{match.match_reason}</p>
                <div className="mt-2 text-[11px] text-slate-500">{match.last_sent ? `Last sent ${new Date(match.last_sent).toLocaleString()}` : "Radar only"}</div>
              </div>
            ))
          ) : (
            <EmptyRailState href="/alerts" label="No active alert matches" />
          )}
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Review Queue" title="Top Watch Candidates" meta="research only" />
        <div className="mt-4 space-y-2">
          {candidates.map((row) => <RightRailSignalRow key={row.symbol} row={row} symbol={row.symbol} />)}
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Market Context" title={marketRegime.label} meta={scanSafety.status ?? "scanner"} />
        <p className="mt-4 text-sm leading-6 text-slate-300">{explanation}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <ContextMetric label="Breadth" value={marketRegime.breadth} />
          <ContextMetric label="Confidence" value={`${Math.round(marketRegime.confidence)}%`} />
          <ContextMetric label="Scanner" value={scanSafety.status ?? "unknown"} />
          <ContextMetric label="Mode" value={marketRegime.riskMode} />
        </dl>
      </GlassPanel>
    </aside>
  );
}

function RightRailSignalRow({ row, symbol }: { row: RankingRow | null; symbol: string }) {
  const decision = String(row?.final_decision ?? "Not in latest scan").replaceAll("_", " ");
  const confidence = numeric(row?.confidence_score ?? row?.final_score);
  return (
    <Link className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.06]" href={`/symbol/${symbol}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold text-slate-100">{symbol}</span>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase text-slate-300">{decision}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>{row?.setup_type ? String(row.setup_type) : "Research signal"}</span>
        <span>{confidence === null ? "confidence n/a" : `${Math.round(confidence)} confidence`}</span>
      </div>
    </Link>
  );
}

function EmptyRailState({ href, label }: { href: string; label: string }) {
  return (
    <Link className="block rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-sm text-slate-400 transition hover:border-cyan-300/35 hover:text-cyan-100" href={href}>
      {label}
    </Link>
  );
}

function ContextMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <dt className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-slate-100">{value}</dd>
    </div>
  );
}

function topWatchCandidates(rows: RankingRow[]): RankingRow[] {
  const watchRows = rows.filter((row) => {
    const decision = String(row.final_decision ?? "").toUpperCase();
    return decision === "WATCH" || decision === "WAIT_PULLBACK";
  });
  const source = watchRows.length ? watchRows : rows;
  return [...source].sort((a, b) => candidateScore(b) - candidateScore(a)).slice(0, 5);
}

function candidateScore(row: RankingRow): number {
  return (numeric(row.final_score) ?? 0) + (numeric(row.confidence_score) ?? 0) * 0.2;
}

function marketContextExplanation(rows: RankingRow[], marketRegime: MarketRegime, scanSafety: ScanSafetySummary): string {
  if (scanSafety.active) return scanSafety.reason ?? "Scanner data needs review. Decisions remain conservative until data is fresh.";
  const avoid = rows.filter((row) => String(row.final_decision ?? "").toUpperCase() === "AVOID").length;
  const watch = rows.filter((row) => ["WATCH", "WAIT_PULLBACK"].includes(String(row.final_decision ?? "").toUpperCase())).length;
  if (avoid > rows.length * 0.45) return "Market is extended or risk filters are active. Scanner is prioritizing pullbacks and blocking weak entries.";
  if (watch > 0) return "Scanner sees setups worth monitoring, but the decision system is waiting for cleaner confirmation before surfacing active plans.";
  if (marketRegime.riskMode === "risk-off") return "Risk-off conditions are active. The system is reducing trade intent and emphasizing capital protection.";
  return "Market context is being monitored across trend, momentum, volatility, and data quality. Research labels are not financial advice.";
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[%,$]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
