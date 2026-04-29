import { cleanText, finiteNumber, firstNumber, formatMoney, formatNumber, formatPercent } from "@/lib/ui/formatters";
import type { RankingRow } from "@/lib/types";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

const DEFAULT_ACCOUNT = 10000;
const DEFAULT_RISK_PCT = 2;

function level(value: unknown) {
  return firstNumber(value);
}

function quantityFor(entry: number, stop: number) {
  const perShareRisk = entry - stop;
  if (perShareRisk <= 0) return 0;
  return Math.floor((DEFAULT_ACCOUNT * (DEFAULT_RISK_PCT / 100)) / perShareRisk);
}

function pct(value: number) {
  return formatPercent(value, 1);
}

export function TradePlanCard({ row }: { row: RankingRow }) {
  const decision = String(row.final_decision ?? "").toUpperCase();
  const entry = level(row.suggested_entry ?? row.buy_zone ?? row.entry_zone ?? row.price);
  const stop = level(row.stop_loss ?? row.invalidation_level);
  const target = level(row.conservative_target ?? row.take_profit_zone ?? row.take_profit_high ?? row.target_price);
  const valid = decision !== "AVOID" && decision !== "EXIT" && entry !== null && stop !== null && target !== null && entry > 0 && stop < entry && target > entry;

  if (!valid) {
    return (
      <GlassPanel className="p-6">
        <SectionTitle eyebrow="Trade Plan" title="No Valid Long Plan" />
        <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-5 text-sm leading-6 text-rose-100">
          {decision === "AVOID" || decision === "EXIT" ? "No valid trade plan - risk/reward is not favorable." : "Entry, stop, or target data is incomplete. Scanner insights are still available."}
        </div>
      </GlassPanel>
    );
  }

  const qty = quantityFor(entry, stop);
  const riskPct = (entry - stop) / entry;
  const rewardPct = (target - entry) / entry;
  const maxLoss = (entry - stop) * qty;
  const potentialGain = (target - entry) * qty;
  const riskReward = rewardPct / riskPct;
  const stopPosition = 8;
  const entryPosition = 45;
  const targetPosition = 92;

  return (
    <GlassPanel className="p-6">
      <SectionTitle eyebrow="Trade Plan" title={decision === "WAIT_PULLBACK" ? "Pullback Plan" : "Execution Plan"} meta="default $10k / 2% risk" />
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <PlanMetric label="Suggested Entry" value={formatMoney(entry)} />
        <PlanMetric label="Stop Loss" value={formatMoney(stop)} tone="risk" />
        <PlanMetric label="Target Price" value={formatMoney(target)} tone="reward" />
        <PlanMetric label="Risk %" value={pct(riskPct)} tone="risk" />
        <PlanMetric label="Reward %" value={pct(rewardPct)} tone="reward" />
        <PlanMetric label="Risk/Reward" value={`${formatNumber(finiteNumber(row.risk_reward) ?? riskReward, 2)}R`} />
        <PlanMetric label="Max Loss" value={formatMoney(maxLoss)} tone="risk" />
        <PlanMetric label="Potential Gain" value={formatMoney(potentialGain)} tone="reward" />
        <PlanMetric label="Suggested Qty" value={formatNumber(qty, 0)} />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="relative h-14 rounded-full bg-gradient-to-r from-rose-400/70 via-slate-700 to-emerald-300/80">
          <Marker label="Stop" left={stopPosition} value={formatMoney(stop)} />
          <Marker label="Entry" left={entryPosition} value={formatMoney(entry)} />
          <Marker label="Target" left={targetPosition} value={formatMoney(target)} />
        </div>
        <div className="mt-3 text-xs text-slate-500">{cleanText(row.decision_reason, "Follow the plan only if price, risk, and decision remain valid.")}</div>
      </div>
    </GlassPanel>
  );
}

function PlanMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "risk" | "reward" }) {
  const color = tone === "risk" ? "text-rose-200" : tone === "reward" ? "text-emerald-200" : "text-slate-100";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Marker({ label, left, value }: { label: string; left: number; value: string }) {
  return (
    <div className="absolute top-1/2 min-w-20 -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${left}%` }}>
      <div className="mx-auto h-5 w-1 rounded-full bg-slate-50 shadow-[0_0_18px_rgba(255,255,255,0.35)]" />
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-50">{label}</div>
      <div className="font-mono text-[10px] text-slate-200">{value}</div>
    </div>
  );
}
