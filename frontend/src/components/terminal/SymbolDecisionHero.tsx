import type { RankingRow } from "@/lib/types";
import { cleanText, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { DecisionBadge } from "./DecisionBadge";
import { GlassPanel } from "./ui/GlassPanel";

function actionText(value: unknown) {
  const decision = String(value ?? "").toUpperCase();
  if (decision === "ENTER") return "Consider entry";
  if (decision === "WAIT_PULLBACK") return "Wait for pullback";
  if (decision === "WATCH") return "Monitor only";
  if (decision === "AVOID") return "Do not enter";
  if (decision === "EXIT") return "Exit position";
  return "Review setup";
}

function glow(value: unknown) {
  const decision = String(value ?? "").toUpperCase();
  if (decision === "ENTER") return "shadow-[0_0_80px_rgba(16,185,129,0.22)]";
  if (decision === "WAIT_PULLBACK") return "shadow-[0_0_80px_rgba(245,158,11,0.2)]";
  if (decision === "AVOID" || decision === "EXIT") return "shadow-[0_0_80px_rgba(244,63,94,0.2)]";
  return "shadow-[0_0_80px_rgba(34,211,238,0.14)]";
}

export function SymbolDecisionHero({ row }: { row: RankingRow }) {
  const decision = row.final_decision ?? row.action ?? "WATCH";
  return (
    <GlassPanel className={`overflow-hidden p-6 md:p-8 ${glow(decision)}`}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
        <div className="min-w-0">
          <div className="font-mono text-6xl font-black tracking-tight text-slate-50 md:text-7xl">{row.symbol}</div>
          <div className="mt-2 max-w-2xl text-base text-slate-400">{cleanText(row.company_name || row.sector, "Scanner signal")}</div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <DecisionBadge className="px-5 py-2 text-base" value={decision} />
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200">
              {actionText(decision)}
            </span>
          </div>
          <div className="mt-4 max-w-3xl text-lg leading-7 text-slate-200">
            {cleanText(row.decision_reason ?? row.quality_reason, "No decision reason available.")}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <HeroMetric label="Score" value={formatNumber(row.final_score, 0)} />
          <HeroMetric label="Price" value={formatMoney(row.price)} />
          <HeroMetric label="Entry" value={formatMoney(row.suggested_entry ?? row.buy_zone ?? row.entry_zone)} />
          <HeroMetric label="Risk / Reward" value={`${formatNumber(row.risk_reward, 2)}R`} />
        </div>
      </div>
    </GlassPanel>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 truncate font-mono text-xl font-bold text-slate-50">{value}</div>
    </div>
  );
}
