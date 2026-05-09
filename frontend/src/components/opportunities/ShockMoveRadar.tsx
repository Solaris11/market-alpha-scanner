"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { formatNumber } from "@/lib/ui/formatters";
import { DecisionBadge } from "@/components/terminal/DecisionBadge";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";

export function ShockMoveRadar({ compact = false, rows }: { compact?: boolean; rows: OpportunityViewModel[] }) {
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
          <SectionTitle eyebrow="Shock Move Radar" title="Asymmetric Opportunity Intelligence" meta={`${candidates.length} ranked`} />
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            This is a speculative high-volatility research layer. It ranks statistically detected shock-pattern memory without overriding the conservative core decision.
          </p>
        </div>
        <div className="rounded-full border border-amber-300/25 bg-amber-400/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
          Research only · Not advice
        </div>
      </div>

      {candidates.length ? (
        <div className={`mt-4 grid gap-3 ${compact ? "lg:grid-cols-1" : "lg:grid-cols-2 2xl:grid-cols-5"}`}>
          {candidates.map((row, index) => {
            const pattern = row.shockPattern;
            if (!pattern) return null;
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
                  <Metric label="Opportunity" value={formatNumber(pattern.opportunityScore, 0)} />
                  <Metric label="Asymmetry" value={formatNumber(pattern.asymmetryScore, 0)} />
                  <Metric label="Upside Shock" value={formatNumber(pattern.upsideShockScore, 0)} />
                  <Metric label="Downside Risk" value={formatNumber(pattern.downsideRiskScore, 0)} tone={pattern.downsideRiskScore >= 70 ? "risk" : "neutral"} />
                  <Metric label="Similarity" value={formatNumber(pattern.currentSimilarityScore, 0)} />
                  <Metric label="Reliability" value={formatNumber(pattern.reliabilityScore, 0)} />
                  <Metric label="Evidence" value={row.evidence ? `${row.evidence.label} (${row.evidence.score})` : "Evidence building"} />
                </div>
                <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/35 p-2 text-[11px] leading-4 text-slate-400">
                  <span className="font-semibold text-amber-100">{pattern.chaseRiskLabel}.</span> Entry context: {pattern.researchEntryZone}. Exit context: {pattern.historicalExitZone}.
                </div>
                {row.narrative ? (
                  <div className="mt-2 rounded-xl border border-cyan-300/15 bg-cyan-400/[0.055] p-2 text-[11px] leading-4 text-slate-300">
                    <span className="font-semibold text-cyan-100">Narrative:</span> {row.narrative.pressureStory}
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-400">
          Shock pattern memory is not available yet. Run the bounded shock refresh after migrations to populate this radar.
        </div>
      )}
    </GlassPanel>
  );
}

function Metric({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "risk"; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-950/45 px-2 py-1.5">
      <div className="min-w-0 truncate text-[9px] font-semibold uppercase leading-3 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-1 truncate font-mono text-[11px] font-semibold ${tone === "risk" ? "text-rose-200" : "text-slate-100"}`} title={value}>{value}</div>
    </div>
  );
}
