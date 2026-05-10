"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  buildInstitutionalIntelligence,
  buildInstitutionalPressureSystem,
  institutionalOpportunityState,
  type InstitutionalIntelligence,
  type MarketPressureComponent,
} from "@/lib/trading/institutional-intelligence";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { formatNumber } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function InstitutionalIntelligencePanel({
  compact = false,
  focusSymbol,
  rows,
}: {
  compact?: boolean;
  focusSymbol?: string;
  rows: OpportunityViewModel[];
}) {
  const system = useMemo(() => buildInstitutionalPressureSystem(rows), [rows]);
  const focusModel = useMemo(() => {
    if (!focusSymbol) return null;
    const target = rows.find((row) => row.symbol.toUpperCase() === focusSymbol.toUpperCase());
    return target ? buildInstitutionalIntelligence(target) : null;
  }, [focusSymbol, rows]);

  if (!rows.length) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Institutional Intelligence" title="Market Pressure Building" meta="bounded derived model" />
        <p className="mt-3 text-sm leading-6 text-slate-400">Institutional pressure context will appear after scanner rows are available.</p>
      </GlassPanel>
    );
  }

  if (focusModel) {
    return <FocusedInstitutionalPanel compact={compact} model={focusModel} />;
  }

  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <SectionTitle eyebrow="Institutional Intelligence" title="Market Pressure System" meta="latest universe" />
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {system.pressureSummary}
          </p>
        </div>
        <div className="grid min-w-[280px] grid-cols-3 gap-2">
          <ScorePill label="Pressure" value={system.netMarketPressureScore} />
          <ScorePill label="Quality" value={system.averageInstitutionalQuality} />
          <ScorePill label="Crowding" value={system.averageCrowdingRisk} inverse />
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "xl:grid-cols-3" : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"}`}>
        <InstitutionalList
          empty="No high institutional-quality setup is confirmed in the current universe."
          models={system.institutionalLeaders}
          metric={(model) => `${model.institutionalQualityScore}/100`}
          title="Institutional Quality"
        />
        <InstitutionalList
          empty="No strong asymmetric setup is confirmed in the current universe."
          models={system.highAsymmetry}
          metric={(model) => `${model.asymmetryScore}/100`}
          title="Asymmetry Leaders"
        />
        <InstitutionalList
          empty="No major crowding cluster is flagged."
          models={system.highCrowding.length ? system.highCrowding : system.dangerSymbols}
          metric={(model) => `${model.crowdingRiskScore}/100`}
          title="Crowding / Danger"
          tone="risk"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Trust Boundary</div>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Institutional pressure is derived from scanner, macro, event, shock, and narrative fields. It does not claim actual fund flows or hidden positioning.
        </p>
      </div>
    </GlassPanel>
  );
}

function FocusedInstitutionalPanel({ compact, model }: { compact: boolean; model: InstitutionalIntelligence }) {
  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <SectionTitle eyebrow="Institutional Intelligence" title={`${model.symbol} Market Pressure`} meta={institutionalOpportunityState(model)} />
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{model.summary}</p>
        </div>
        <div className="grid min-w-[280px] grid-cols-2 gap-2">
          <ScorePill label="Pressure" value={model.netMarketPressureScore} />
          <ScorePill label="Inst. Quality" value={model.institutionalQualityScore} />
          <ScorePill label="Asymmetry" value={model.asymmetryScore} />
          <ScorePill label="Crowding" value={model.crowdingRiskScore} inverse />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {model.compactLabels.length ? model.compactLabels.map((label) => <StatusChip key={label} label={label} />) : <StatusChip label={model.marketPressureLabel} />}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Market Pressure Map</div>
          <div className="mt-3 grid gap-2">
            {model.pressureComponents.map((component) => <PressureBar component={component} key={component.key} />)}
          </div>
        </div>
        <div className="grid gap-3">
          <ReasonBox title="Position Quality" value={`${model.positionQualityScore}/100`} text={`${model.positionQualityLabel}. ${model.positioningQualityLabel}.`} />
          <ReasonBox title="Institutional Quality" value={`${model.institutionalQualityScore}/100`} text={`${model.institutionalQualityLabel}. ${model.accumulationLikelihood}.`} />
          <ReasonBox title="Liquidity / Regime" value={model.regimeTransitionLabel} text={`${model.liquidityContext} Timeframe view: ${model.timeframeConflictLabel}.`} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ForceList title="Positive Forces" components={model.positiveForces} empty="No dominant positive pressure is confirmed." />
        <ForceList title="Negative Forces" components={model.negativeForces} empty="No dominant negative pressure is confirmed." tone="risk" />
        <DangerList model={model} />
      </div>
    </GlassPanel>
  );
}

function InstitutionalList({
  empty,
  metric,
  models,
  title,
  tone = "neutral",
}: {
  empty: string;
  metric: (model: InstitutionalIntelligence) => string;
  models: InstitutionalIntelligence[];
  title: string;
  tone?: "neutral" | "risk";
}) {
  const titleClass = tone === "risk" ? "text-amber-200" : "text-cyan-200";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${titleClass}`}>{title}</div>
      <div className="mt-3 space-y-2">
        {models.length ? models.map((model) => (
          <Link className="block rounded-xl border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35" href={`/symbol/${model.symbol}`} key={model.symbol}>
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-base font-black text-slate-50">{model.symbol}</div>
              <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-200">{metric(model)}</div>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{model.summary}</p>
          </Link>
        )) : <p className="text-sm leading-6 text-slate-400">{empty}</p>}
      </div>
    </div>
  );
}

function ForceList({ components, empty, title, tone = "neutral" }: { components: MarketPressureComponent[]; empty: string; title: string; tone?: "neutral" | "risk" }) {
  const titleClass = tone === "risk" ? "text-rose-200" : "text-emerald-200";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${titleClass}`}>{title}</div>
      <div className="mt-3 space-y-2">
        {components.length ? components.map((component) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3" key={component.key}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-slate-200">{component.label}</span>
              <span className="font-mono text-slate-400">{component.contribution > 0 ? "+" : ""}{component.contribution}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{component.explanation}</p>
          </div>
        )) : <p className="text-sm leading-6 text-slate-400">{empty}</p>}
      </div>
    </div>
  );
}

function DangerList({ model }: { model: InstitutionalIntelligence }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Danger Alerts</div>
      <div className="mt-3 space-y-2">
        {model.dangerAlerts.length ? model.dangerAlerts.map((alert) => (
          <div className={`rounded-xl border p-3 ${alert.severity === "critical" ? "border-rose-300/25 bg-rose-400/[0.08]" : "border-amber-300/20 bg-amber-400/[0.07]"}`} key={alert.label}>
            <div className="text-xs font-bold text-slate-100">{alert.label}</div>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">{alert.explanation}</p>
          </div>
        )) : <p className="text-sm leading-6 text-slate-400">No advanced danger alert is active for this symbol.</p>}
      </div>
    </div>
  );
}

function PressureBar({ component }: { component: MarketPressureComponent }) {
  const color = component.score >= 65 ? "bg-emerald-300" : component.score < 45 ? "bg-rose-300" : "bg-amber-300";
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-semibold text-slate-300">{component.label}</span>
        <span className="font-mono text-slate-400">{component.score}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, Math.min(100, component.score))}%` }} />
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{component.explanation}</p>
    </div>
  );
}

function ScorePill({ inverse = false, label, value }: { inverse?: boolean; label: string; value: number }) {
  const good = inverse ? value <= 45 : value >= 65;
  const risk = inverse ? value >= 70 : value < 45;
  const color = good ? "text-emerald-200" : risk ? "text-rose-200" : "text-amber-200";
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="min-h-7 min-w-0 break-words text-[9px] font-black uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-1 font-mono text-lg font-black ${color}`}>{formatNumber(value, 0)}</div>
    </div>
  );
}

function StatusChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.075] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">
      {label}
    </span>
  );
}

function ReasonBox({ text, title, value }: { text: string; title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 truncate text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={title}>{title}</div>
        <div className="font-mono text-sm font-black text-slate-100">{value}</div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{text}</p>
    </div>
  );
}
