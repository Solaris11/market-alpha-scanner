"use client";

import type { RankingRow } from "@/lib/types";
import { formatMoney, formatNumber } from "@/lib/ui/formatters";
import { useCopilotExplanation } from "@/hooks/useCopilotExplanation";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function AICopilotPanel({ signal }: { signal: RankingRow }) {
  const { accountBalance, riskPct, setAccountBalance, setRiskPct, recommendation } = useCopilotExplanation(signal);
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="AI Copilot" title="Decision Assistant" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-400">
          Account
          <input className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 font-mono text-slate-100 outline-none focus:border-cyan-300/60" value={accountBalance} onChange={(event) => setAccountBalance(Number(event.target.value))} type="number" />
        </label>
        <label className="text-xs text-slate-400">
          Risk %
          <input className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 font-mono text-slate-100 outline-none focus:border-cyan-300/60" value={riskPct} onChange={(event) => setRiskPct(Number(event.target.value))} type="number" />
        </label>
      </div>
      <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-50">{recommendation.recommendationText}</div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-white/[0.04] p-2"><div className="text-slate-500">Qty</div><div className="font-mono text-slate-100">{formatNumber(recommendation.suggestedQty, 0)}</div></div>
        <div className="rounded-xl bg-white/[0.04] p-2"><div className="text-slate-500">Risk</div><div className="font-mono text-rose-200">{formatMoney(recommendation.maxRisk)}</div></div>
        <div className="rounded-xl bg-white/[0.04] p-2"><div className="text-slate-500">Reward</div><div className="font-mono text-emerald-200">{formatMoney(recommendation.potentialReward)}</div></div>
      </div>
      {recommendation.warnings.length ? (
        <div className="mt-4 space-y-2">
          {recommendation.warnings.map((warning) => <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100" key={warning}>{warning}</div>)}
        </div>
      ) : null}
    </GlassPanel>
  );
}
