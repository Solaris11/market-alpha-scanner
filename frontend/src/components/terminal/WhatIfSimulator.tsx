"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { TradePlanEngine } from "@/hooks/useTradePlanEngine";
import { TradeLegalNotice } from "@/components/legal/TradeLegalNotice";
import { formatMoney, formatNumber } from "@/lib/ui/formatters";
import { ChaosEnginePanel } from "./ChaosEnginePanel";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

function Input({ disabled = false, label, value, onChange }: { disabled?: boolean; label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <input
        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 font-mono text-slate-100 outline-none focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={value}
      />
    </label>
  );
}

export function WhatIfSimulator({ canTrade = true, engine, researchModeReason }: { canTrade?: boolean; engine: TradePlanEngine; researchModeReason?: string }) {
  const [pulse, setPulse] = useState(false);
  const { authenticated } = useCurrentUser();
  const { metrics, riskEvaluation, riskProfile, riskProfileActions, state, validity } = engine;
  const readOnly = !canTrade || state.finalDecision === "AVOID" || state.finalDecision === "EXIT";
  const displayRiskStatus = readOnly ? "OK" : riskEvaluation.status;
  useEffect(() => {
    setPulse(true);
    const timeout = window.setTimeout(() => setPulse(false), 200);
    return () => window.clearTimeout(timeout);
  }, [metrics.maxRiskAmount, metrics.positionSize, metrics.potentialReward, metrics.riskRewardRatio]);

  return (
    <div data-onboarding-target="what-if-simulator">
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="What-If" title={canTrade ? "Trade Simulator" : "Research Mode"} meta={readOnly ? "read-only" : displayRiskStatus === "OK" ? (validity.isCalculable ? "synced live" : "blocked") : displayRiskStatus.toLowerCase()} />
        <TradeLegalNotice className="mt-3" />
        {!canTrade ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm font-semibold leading-6 text-amber-100">
            No active trade recommended. {researchModeReason ?? "Correct action: do nothing."} Trade sizing, entry, stop, target, and stress-test outputs are disabled.
          </div>
        ) : null}
        {readOnly ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs font-semibold text-amber-100">
            {canTrade ? `System decision is ${state.finalDecision}. Simulator is read-only, with calculations kept visible.` : "Risk Rules remain editable while trade simulation is locked."}
          </div>
        ) : null}
        {!readOnly && riskEvaluation.status !== "OK" ? <RiskBanner status={riskEvaluation.status} reasons={riskEvaluation.reasons} /> : null}
        {canTrade ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input disabled={readOnly} label="Account Equity" value={state.accountEquity} onChange={engine.setters.setAccountEquity} />
            <Input disabled={readOnly} label="Risk %" value={state.riskPercent} onChange={engine.setters.setRiskPercent} />
          </div>
        ) : null}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Risk Rules</div>
              <div className="mt-1 text-xs text-slate-400">{authenticated ? "Account saved" : "Saved only on this device."}</div>
            </div>
            <button className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100" onClick={riskProfileActions.resetRiskProfile} type="button">Reset</button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <Input label="Max Risk %" value={riskProfile.maxRiskPerTradePercent} onChange={(value) => riskProfileActions.updateRiskProfile({ maxRiskPerTradePercent: value })} />
            <Input label="Sector Max" value={riskProfile.maxSectorExposure} onChange={(value) => riskProfileActions.updateRiskProfile({ maxSectorExposure: value })} />
            <OptionalInput label="Max Daily Loss" value={riskProfile.maxDailyLoss} onChange={(value) => riskProfileActions.updateRiskProfile({ maxDailyLoss: value })} />
            <OptionalInput label="Max Position %" value={riskProfile.maxPositionSizePercent} onChange={(value) => riskProfileActions.updateRiskProfile({ maxPositionSizePercent: value })} />
            <label className="col-span-2 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
              <input checked={riskProfile.allowOverride} className="accent-cyan-300" onChange={(event) => riskProfileActions.updateRiskProfile({ allowOverride: event.target.checked })} type="checkbox" />
              Allow risk-veto override with confirmation
            </label>
          </div>
        </div>
        {canTrade && validity.isCalculable && metrics.potentialReward !== null && metrics.riskRewardRatio !== null ? (
          <div className={`mt-4 grid grid-cols-1 gap-2 text-xs transition-all duration-200 sm:grid-cols-2 md:grid-cols-4 ${validity.isBlocked ? "opacity-60" : ""} ${pulse ? "scale-[1.02] shadow-[0_0_30px_rgba(34,211,238,0.18)]" : "scale-100"}`}>
            <SimulatorMetric label="Position Size" value={formatNumber(metrics.positionSize, 0)} />
            <SimulatorMetric label="Max Risk" value={`${formatMoney(metrics.maxRiskAmount)} risk`} tone="risk" />
            <SimulatorMetric label="Potential Reward" value={formatMoney(metrics.potentialReward)} tone="reward" />
            <SimulatorMetric label="Risk/Reward" value={`${formatNumber(metrics.riskRewardRatio, 1)}R`} />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">{validity.message}</div>
        )}
        {canTrade ? <ChaosEnginePanel engine={engine} /> : null}
      </GlassPanel>
    </div>
  );
}

function RiskBanner({ reasons, status }: { reasons: string[]; status: "WARNING" | "VETO" }) {
  const isVeto = status === "VETO";
  return (
    <div className={`mt-4 rounded-2xl border p-3 text-xs font-semibold leading-5 transition-all duration-200 ${isVeto ? "border-rose-300/30 bg-rose-500/10 text-rose-100 shadow-[0_0_28px_rgba(244,63,94,0.16)]" : "border-amber-300/30 bg-amber-400/10 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.12)]"}`}>
      <div>{isVeto ? "AI risk veto active" : "Risk warning active"}</div>
      {reasons.length ? <div className="mt-1 font-normal">{reasons.join(" ")}</div> : null}
    </div>
  );
}

function OptionalInput({ disabled = false, label, value, onChange }: { disabled?: boolean; label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <input
        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 font-mono text-slate-100 outline-none focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        placeholder="optional"
        type="number"
        value={value ?? ""}
      />
    </label>
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
