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
  const { metrics, riskEvaluation, state, validity } = activeEngine;
  const displayRiskStatus = validity.isBlocked ? "OK" : riskEvaluation.status;
  const copilotClass = displayRiskStatus === "VETO"
    ? "border-rose-300/30 bg-rose-500/10 text-rose-50 shadow-[0_0_28px_rgba(244,63,94,0.18)]"
    : displayRiskStatus === "WARNING"
      ? "border-amber-300/30 bg-amber-400/10 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.14)]"
      : "border-cyan-300/20 bg-cyan-400/10 text-cyan-50";
  return (
    <div data-onboarding-target="ai-decision">
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="AI Copilot" title="Decision Assistant" meta={displayRiskStatus === "OK" ? undefined : displayRiskStatus.toLowerCase()} />
        <div className="mt-3 inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
          Protected by Risk Rules
        </div>
        <div className={`mt-4 whitespace-pre-line rounded-2xl border p-4 text-sm font-semibold leading-6 transition-all duration-200 ${copilotClass}`}>{activeEngine.copilotText}</div>
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
        {validity.isBlocked ? <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">Execution remains blocked until the signal clears system rules.</div> : null}
        {!validity.isBlocked && !validity.isCalculable ? <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">{validity.message}</div> : null}
      </GlassPanel>
    </div>
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
