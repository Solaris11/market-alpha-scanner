"use client";

import type { TradePlanEngine } from "@/hooks/useTradePlanEngine";
import { useTradePlanEngine } from "@/hooks/useTradePlanEngine";
import type { RankingRow } from "@/lib/types";
import { formatMoney, formatNumber } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function AICopilotPanel({ engine, signal }: { engine?: TradePlanEngine; signal: RankingRow }) {
  const fallbackEngine = useTradePlanEngine(signal);
  const activeEngine = engine ?? fallbackEngine;
  const { metrics, state, validity } = activeEngine;
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="AI Copilot" title="Decision Assistant" />
      <div className="mt-4 whitespace-pre-line rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm font-semibold leading-6 text-cyan-50">{activeEngine.copilotText}</div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Account Equity" value={formatMoney(state.accountEquity)} />
        <Metric label="Risk Percent" value={`${formatNumber(state.riskPercent, 1)}%`} />
        {validity.isCalculable && metrics.potentialReward !== null && metrics.riskRewardRatio !== null ? (
          <>
            <Metric label="Position Size" value={formatNumber(metrics.positionSize, 0)} />
            <Metric label="Max Risk" value={formatMoney(metrics.maxRiskAmount)} tone="risk" />
            <Metric label="Potential Reward" value={formatMoney(metrics.potentialReward)} tone="reward" />
            <Metric label="Risk/Reward" value={`${formatNumber(metrics.riskRewardRatio, 1)}R`} />
          </>
        ) : null}
      </div>
      {!validity.isCalculable ? <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">{validity.message}</div> : null}
    </GlassPanel>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "reward" | "risk" }) {
  const color = tone === "risk" ? "text-rose-200" : tone === "reward" ? "text-emerald-200" : "text-slate-100";
  return (
    <div className="rounded-xl bg-white/[0.04] p-2">
      <div className="text-slate-500">{label}</div>
      <div className={`font-mono ${color}`}>{value}</div>
    </div>
  );
}
