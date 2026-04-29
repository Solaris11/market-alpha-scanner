"use client";

import { useEffect, useState } from "react";
import type { TradePlanEngine } from "@/hooks/useTradePlanEngine";
import { formatMoney, formatNumber } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

function Input({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <input className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 font-mono text-slate-100 outline-none focus:border-cyan-300/60" value={value} onChange={(event) => onChange(Number(event.target.value))} type="number" />
    </label>
  );
}

export function WhatIfSimulator({ engine }: { engine: TradePlanEngine }) {
  const [pulse, setPulse] = useState(false);
  const { metrics, state, validity } = engine;
  useEffect(() => {
    setPulse(true);
    const timeout = window.setTimeout(() => setPulse(false), 200);
    return () => window.clearTimeout(timeout);
  }, [metrics.maxRiskAmount, metrics.positionSize, metrics.potentialReward, metrics.riskRewardRatio]);

  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="What-If" title="Trade Simulator" meta={validity.isCalculable ? "synced live" : "blocked"} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Input label="Account Equity" value={state.accountEquity} onChange={engine.setters.setAccountEquity} />
        <Input label="Risk %" value={state.riskPercent} onChange={engine.setters.setRiskPercent} />
      </div>
      {validity.isCalculable && metrics.potentialReward !== null && metrics.riskRewardRatio !== null ? (
        <div className={`mt-4 grid grid-cols-2 gap-2 text-xs transition-all duration-200 md:grid-cols-4 ${pulse ? "scale-[1.05] shadow-[0_0_30px_rgba(34,211,238,0.18)]" : "scale-100"}`}>
          <SimulatorMetric label="Position Size" value={formatNumber(metrics.positionSize, 0)} />
          <SimulatorMetric label="Max Risk" value={`${formatMoney(metrics.maxRiskAmount)} risk`} tone="risk" />
          <SimulatorMetric label="Potential Reward" value={formatMoney(metrics.potentialReward)} tone="reward" />
          <SimulatorMetric label="Risk/Reward" value={`${formatNumber(metrics.riskRewardRatio, 1)}R`} />
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">{validity.message}</div>
      )}
    </GlassPanel>
  );
}

function SimulatorMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "risk" | "reward" }) {
  const color = tone === "risk" ? "text-rose-200" : tone === "reward" ? "text-emerald-200" : "text-slate-100";
  return (
    <div className="rounded-xl bg-white/[0.04] p-2">
      <div className="text-slate-500">{label}</div>
      <div className={`font-mono ${color}`}>{value}</div>
    </div>
  );
}
