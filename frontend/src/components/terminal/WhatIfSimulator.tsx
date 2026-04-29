"use client";

import { useTradeSimulator } from "@/hooks/useTradeSimulator";
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

export function WhatIfSimulator({ defaults }: { defaults: { accountSize: number; riskPct: number; entry: number; stop: number; target: number } }) {
  const { state, setters, result } = useTradeSimulator(defaults);
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="What-If" title="Trade Simulator" meta={result.violatesRisk ? "risk warning" : "within profile"} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Input label="Account Size" value={state.accountSize} onChange={setters.setAccountSize} />
        <Input label="Risk %" value={state.riskPct} onChange={setters.setRiskPct} />
        <Input label="Entry" value={state.entryPrice} onChange={setters.setEntryPrice} />
        <Input label="Stop" value={state.stopPrice} onChange={setters.setStopPrice} />
        <Input label="Target" value={state.targetPrice} onChange={setters.setTargetPrice} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
        <div className="rounded-xl bg-white/[0.04] p-2">Qty <div className="font-mono text-slate-100">{formatNumber(result.quantity, 0)}</div></div>
        <div className="rounded-xl bg-white/[0.04] p-2">Max Loss <div className="font-mono text-rose-200">{formatMoney(result.maxLoss)}</div></div>
        <div className="rounded-xl bg-white/[0.04] p-2">Profit <div className="font-mono text-emerald-200">{formatMoney(result.potentialProfit)}</div></div>
        <div className="rounded-xl bg-white/[0.04] p-2">R/R <div className="font-mono text-slate-100">{formatNumber(result.riskRewardRatio, 2)}R</div></div>
        <div className="rounded-xl bg-white/[0.04] p-2">Acct Risk <div className="font-mono text-slate-100">{formatNumber(result.accountRiskPct, 2)}%</div></div>
      </div>
    </GlassPanel>
  );
}
