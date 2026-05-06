"use client";

import type { TradePlanEngine } from "@/hooks/useTradePlanEngine";
import { useTradePlanEngine } from "@/hooks/useTradePlanEngine";
import type { RankingRow } from "@/lib/types";
import { buildDecisionIntelligence } from "@/lib/trading/decision-intelligence";
import { confidenceTone } from "@/lib/trading/confidence";
import { formatMoney, formatNumber } from "@/lib/ui/formatters";
import { ConfidenceDonut } from "./ConfidenceDonut";
import { DecisionBadge } from "./DecisionBadge";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function AICopilotPanel({
  contextLocked = false,
  engine,
  lockedReason,
  signal,
}: {
  contextLocked?: boolean;
  engine?: TradePlanEngine;
  lockedReason?: string;
  signal: RankingRow;
}) {
  const fallbackEngine = useTradePlanEngine(signal);
  const activeEngine = engine ?? fallbackEngine;
  const { metrics, riskEvaluation, state, validity } = activeEngine;
  const intelligence = buildDecisionIntelligence(signal);
  const displayRiskStatus = validity.isBlocked ? "OK" : riskEvaluation.status;
  const readinessTone = confidenceTone(intelligence.readiness_score);
  const copilotClass = displayRiskStatus === "VETO"
    ? "border-rose-300/30 bg-rose-500/10 text-rose-50 shadow-[0_0_28px_rgba(244,63,94,0.18)]"
    : displayRiskStatus === "WARNING"
      ? "border-amber-300/30 bg-amber-400/10 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.14)]"
      : "border-cyan-300/20 bg-cyan-400/10 text-cyan-50";
  return (
    <div data-onboarding-target="ai-decision">
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Decision Intelligence" title="Decision Assistant" meta="research only" />
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(160px,0.45fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Decision</div>
            <div className="mt-3">
              <DecisionBadge className="px-4 py-2 text-sm" value={intelligence.decision} />
            </div>
            <div className="mt-3 flex justify-center">
              <ConfidenceDonut compact score={intelligence.confidence} />
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">Research only. Not financial advice.</p>
          </div>
          <div className="space-y-3">
            <ReadinessBar toneClass={readinessTone.barClass} value={intelligence.readiness_score} />
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Regime Impact</div>
              <p className="mt-2 text-xs leading-5 text-slate-300">{intelligence.regime_impact}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Setup</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{setupLabel(intelligence.setup_type)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Strength</div>
                  <div className={`font-mono text-lg font-black ${readinessTone.textClass}`}>{intelligence.setup_strength}</div>
                </div>
              </div>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-400">
                {intelligence.setup_reasons.slice(0, 2).map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
            <div className="grid gap-3">
              <InsightList title="Why" items={intelligence.why.positives} />
              <InsightList title="Constraints" items={intelligence.why.negatives} />
              <InsightList title="Watch" items={intelligence.what_to_watch} />
            </div>
          </div>
        </div>
        {contextLocked ? (
          <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
            Daily action is blocking execution context. {lockedReason ?? "Review the research context only until the scanner clears a stronger setup."}
          </div>
        ) : (
          <>
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
          </>
        )}
      </GlassPanel>
    </div>
  );
}

function setupLabel(value: string): string {
  if (value === "PULLBACK") return "Pullback";
  if (value === "BREAKOUT") return "Breakout";
  if (value === "CONTINUATION") return "Continuation";
  return "Avoid";
}

function ReadinessBar({ toneClass, value }: { toneClass: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Readiness</div>
        <div className="font-mono text-lg font-black text-slate-50">{value}</div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
      <div className="mt-2 text-[11px] leading-5 text-slate-500">Readiness reflects vetoes, confidence, and data quality.</div>
    </div>
  );
}

function InsightList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
        {items.slice(0, 3).map((item) => <li key={item}>- {item}</li>)}
      </ul>
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
