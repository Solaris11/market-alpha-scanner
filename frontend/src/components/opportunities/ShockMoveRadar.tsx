"use client";

import Link from "next/link";
import { useMemo } from "react";
import { actionabilityCardFor, type TerminalActionabilityMap } from "@/lib/trading/terminal-actionability";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { formatNumber } from "@/lib/ui/formatters";
import { humanizeInsightText } from "@/lib/ui/labels";
import { DecisionBadge } from "@/components/terminal/DecisionBadge";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";

export function ShockMoveRadar({ actionability, compact = false, rows }: { actionability?: TerminalActionabilityMap; compact?: boolean; rows: OpportunityViewModel[] }) {
  const candidates = useMemo(() => {
    return rows
      .filter((row) => row.shockPattern !== null)
      .sort((left, right) => (right.shockPattern?.opportunityScore ?? 0) - (left.shockPattern?.opportunityScore ?? 0) || (right.shockPattern?.asymmetryScore ?? 0) - (left.shockPattern?.asymmetryScore ?? 0) || left.symbol.localeCompare(right.symbol))
      .slice(0, compact ? 5 : 10);
  }, [compact, rows]);

  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <SectionTitle eyebrow="Large-Move Watch" title="Best High-Volatility Setups" meta={`${candidates.length} ranked`} />
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            This speculative research view looks for symbols that made big moves in similar past conditions. It lowers the rank for thin volume, noisy data, and late chase risk before anything appears here.
          </p>
        </div>
        <div className="rounded-full border border-amber-300/25 bg-amber-400/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
          Speculative · Research only
        </div>
      </div>

      {candidates.length ? (
        <div className={`mt-4 grid gap-3 ${compact ? "lg:grid-cols-1" : "lg:grid-cols-2 2xl:grid-cols-5"}`}>
          {candidates.map((row, index) => {
            const pattern = row.shockPattern;
            if (!pattern) return null;
            const falsePositiveRiskScore = pattern.falsePositiveRiskScore ?? 50;
            const liquidityQualityScore = pattern.liquidityQualityScore ?? 58;
            const card = actionabilityCardFor(row, actionability);
            const primaryMetrics = [
              { label: "Opportunity", value: formatNumber(pattern.opportunityScore, 0) },
              { label: "Upside / Downside", value: formatNumber(pattern.asymmetryScore, 0) },
              { label: "Upside History", value: formatNumber(pattern.upsideShockScore, 0) },
              { label: "Downside Risk", tone: pattern.downsideRiskScore >= 70 ? "risk" as const : "neutral" as const, value: formatNumber(pattern.downsideRiskScore, 0) },
              { label: "Timing", value: pattern.timingValidation ? formatNumber(pattern.timingValidation.timingQualityScore, 0) : "building" },
              { label: "Entry", value: pattern.timingValidation ? formatNumber(pattern.timingValidation.entryQualityScore, 0) : "building" },
            ];
            const secondaryMetrics = [
              { label: "Similarity", value: formatNumber(pattern.currentSimilarityScore, 0) },
              { label: "Reliability", value: formatNumber(pattern.reliabilityScore, 0) },
              { label: "False Alarm Risk", tone: falsePositiveRiskScore >= 62 ? "risk" as const : "neutral" as const, value: formatNumber(falsePositiveRiskScore, 0) },
              { label: "Volume Quality", tone: liquidityQualityScore < 45 ? "risk" as const : "neutral" as const, value: formatNumber(liquidityQualityScore, 0) },
              { label: "Evidence", value: row.evidence ? `${row.evidence.label} (${row.evidence.score})` : "Evidence building" },
            ];
            return (
              <Link className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/35 hover:bg-white/[0.065]" href={`/symbol/${row.symbol}`} key={row.symbol}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Shock Rank #{index + 1}</div>
                    <div className="mt-1 font-mono text-2xl font-black text-slate-50">{row.symbol}</div>
                  </div>
                  <DecisionBadge className="px-2 py-1 text-[10px]" value={row.final_decision} />
                </div>
                <div className="mt-2 text-xs font-semibold text-cyan-200">{pattern.opportunityState}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  {primaryMetrics.map((metric) => <Metric key={metric.label} label={metric.label} tone={metric.tone} value={metric.value} />)}
                </div>
                <details className="mt-2 rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2 text-[11px] text-slate-400 sm:hidden">
                  <summary className="min-h-8 cursor-pointer font-semibold text-slate-200">More shock proof</summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {secondaryMetrics.map((metric) => <Metric key={metric.label} label={metric.label} tone={metric.tone} value={metric.value} />)}
                  </div>
                </details>
                <div className="mt-2 hidden grid-cols-2 gap-2 text-[11px] sm:grid">
                  {secondaryMetrics.map((metric) => <Metric key={metric.label} label={metric.label} tone={metric.tone} value={metric.value} />)}
                </div>
                <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/35 p-2 text-[11px] leading-4 text-slate-400">
                  <span className="font-semibold text-amber-100">{humanizeInsightText(pattern.chaseRiskLabel)}.</span> Research entry area: {humanizeInsightText(pattern.researchEntryZone)}. Historical exit area: {humanizeInsightText(pattern.historicalExitZone)}.
                </div>
                <div className="mt-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.055] p-2 text-[11px] leading-4 text-slate-300">
                  <span className="font-semibold text-emerald-100">{card.primaryActionLabel}:</span> {card.whatToWaitFor}
                </div>
                {pattern.timingValidation ? (
                  <div className="mt-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.045] p-2 text-[11px] leading-4 text-slate-300">
                    <span className="font-semibold text-emerald-100">Timing proof:</span> {humanizeInsightText(pattern.timingValidation.summary)}
                  </div>
                ) : null}
                {row.narrative ? (
                  <div className="mt-2 rounded-xl border border-cyan-300/15 bg-cyan-400/[0.055] p-2 text-[11px] leading-4 text-slate-300">
                    <span className="font-semibold text-cyan-100">Narrative:</span> {humanizeInsightText(row.narrative.pressureStory)}
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-400">
          Large-move history is not ready yet. Run the limited shock refresh after migrations to populate this watchlist.
        </div>
      )}
    </GlassPanel>
  );
}

function Metric({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "risk"; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-950/45 px-2 py-1.5">
      <div className="min-w-0 break-words text-[9px] font-semibold uppercase leading-3 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-1 break-words font-mono text-[11px] font-semibold ${tone === "risk" ? "text-rose-200" : "text-slate-100"}`} title={value}>{value}</div>
    </div>
  );
}
