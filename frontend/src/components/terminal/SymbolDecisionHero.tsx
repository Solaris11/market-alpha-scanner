import type { RankingRow } from "@/lib/types";
import type { DataFreshness } from "@/lib/data-health";
import type { HistoricalEdgeProof } from "@/lib/trading/edge-proof";
import { computeConviction } from "@/lib/trading/conviction";
import { cleanText, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { WatchlistButton } from "@/components/watchlist-controls";
import { DataHealthIndicator } from "@/components/data-health-indicator";
import { TradeLegalNotice } from "@/components/legal/TradeLegalNotice";
import { normalizedToken } from "@/lib/ui/labels";
import { DecisionBadge } from "./DecisionBadge";
import { GlassPanel } from "./ui/GlassPanel";

function actionText(value: unknown) {
  const decision = String(value ?? "").toUpperCase();
  if (decision === "ENTER") return "Research signal";
  if (decision === "WAIT_PULLBACK") return "Wait for pullback";
  if (decision === "WATCH") return "Monitor only";
  if (decision === "AVOID") return "Risk blocked";
  if (decision === "EXIT") return "Exit risk flagged";
  return "Review setup";
}

function glow(value: unknown) {
  const decision = String(value ?? "").toUpperCase();
  if (decision === "ENTER") return "shadow-[0_0_80px_rgba(16,185,129,0.22)]";
  if (decision === "WAIT_PULLBACK") return "shadow-[0_0_80px_rgba(245,158,11,0.2)]";
  if (decision === "AVOID" || decision === "EXIT") return "shadow-[0_0_80px_rgba(244,63,94,0.2)]";
  return "shadow-[0_0_80px_rgba(34,211,238,0.14)]";
}

export function SymbolDecisionHero({
  dataFreshness,
  edge,
  previewMode = false,
  researchModeReason,
  row,
  tradeAllowed = true,
}: {
  dataFreshness: DataFreshness;
  edge?: HistoricalEdgeProof;
  previewMode?: boolean;
  researchModeReason?: string;
  row: RankingRow;
  tradeAllowed?: boolean;
}) {
  const decision = row.final_decision ?? row.action ?? "WATCH";
  const decisionKey = normalizedToken(decision);
  const conviction = computeConviction(row, edge);
  const showTradePlan = tradeAllowed && !previewMode && decisionKey === "ENTER";
  return (
    <GlassPanel className={`overflow-hidden p-6 md:p-8 ${glow(decision)}`}>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div className="min-w-0">
          <div className="min-w-0 font-mono text-5xl font-black tracking-tight text-slate-50 sm:text-6xl md:text-7xl">{row.symbol}</div>
          <div className="mt-2 max-w-2xl text-base text-slate-400">{cleanText(row.company_name || row.sector, "Scanner signal")}</div>
          <div className="mt-6 flex min-w-0 flex-wrap items-center gap-3">
            <DecisionBadge className="px-4 py-2 text-sm sm:px-5 sm:text-base" value={decision} />
            <span className="min-w-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200">
              {actionText(decision)}
            </span>
            <span className="min-w-0 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              Conviction <span className="font-mono">{conviction.score}</span> - {conviction.label}
            </span>
            {!showTradePlan ? (
              <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100">
                No active research setup
              </span>
            ) : null}
            <DataHealthIndicator freshness={dataFreshness} />
            <WatchlistButton symbol={row.symbol} />
          </div>
          <div className="mt-4 max-w-3xl text-lg leading-7 text-slate-200">
            {cleanText(row.decision_reason ?? row.quality_reason, "No decision reason available.")}
          </div>
          <TradeLegalNotice className="mt-4 max-w-3xl" />
          {!showTradePlan ? (
            <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
              Research signal only. {researchModeReason ?? "No active setup is cleared by the decision system."}
            </div>
          ) : null}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <HeroMetric label="Score" value={formatNumber(row.final_score, 0)} />
          <HeroMetric label="Conviction" value={`${conviction.score} ${conviction.label}`} />
          <HeroMetric label="Price" value={formatMoney(row.price)} />
          <HeroMetric label={showTradePlan ? "Entry" : "Mode"} value={showTradePlan ? formatMoney(row.suggested_entry ?? row.buy_zone ?? row.entry_zone) : "Research only"} />
        </div>
      </div>
    </GlassPanel>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 font-mono text-xl font-bold text-slate-50">{value}</div>
    </div>
  );
}
