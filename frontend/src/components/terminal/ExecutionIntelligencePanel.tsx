"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  buildExecutionIntelligence,
  buildExecutionTimingSystem,
  type ExecutionIntelligence,
  type ExecutionOutcomeMetric,
  type ExecutionTimingSystem,
} from "@/lib/trading/execution-intelligence";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { formatNumber } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function ExecutionIntelligencePanel({
  compact = false,
  focusSymbol,
  rows,
}: {
  compact?: boolean;
  focusSymbol?: string;
  rows: OpportunityViewModel[];
}) {
  const system = useMemo(() => buildExecutionTimingSystem(rows), [rows]);
  const focusModel = useMemo(() => {
    if (!focusSymbol) return null;
    const target = rows.find((row) => row.symbol.toUpperCase() === focusSymbol.toUpperCase());
    return target ? buildExecutionIntelligence(target) : null;
  }, [focusSymbol, rows]);

  if (!rows.length) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Execution Intelligence" title="Timing Context Unavailable" meta="waiting for scanner rows" />
        <p className="mt-3 text-sm leading-6 text-slate-400">Execution and timing quality will appear after scanner rows are available.</p>
      </GlassPanel>
    );
  }

  if (focusModel) return <FocusedExecutionPanel compact={compact} model={focusModel} />;

  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <SectionTitle eyebrow="Execution Intelligence" title="Timing Quality Engine" meta="good idea vs good execution" />
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{system.systemSummary}</p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{system.calibrationSummary}</p>
        </div>
        <div className="grid min-w-[260px] grid-cols-3 gap-2">
          <ScorePill label="Timing" value={system.averageTimingQuality} />
          <ScorePill label="Entry" value={system.averageEntryQuality} />
          <ScorePill inverse label="Chase" value={system.averageChaseRisk} />
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "xl:grid-cols-3" : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"}`}>
        <ExecutionList
          empty="No clean timing candidates are confirmed in the current universe."
          items={system.topTimingQuality}
          metric={(model) => `${model.timingQualityScore}/100`}
          title="Best Timing Quality"
        />
        <ExecutionList
          empty="No pullback-dependent timing setup is prominent right now."
          items={system.pullbackCandidates}
          metric={(model) => `${model.pullbackQuality.score}/100`}
          title="Wait / Pullback Context"
        />
        <ExecutionList
          empty="No major chase-risk cluster is active."
          items={system.avoidChase.length ? system.avoidChase : system.confirmationNeeded}
          metric={(model) => `${model.chaseRisk.score}/100`}
          title="Chase / Confirmation Risk"
          tone="risk"
        />
      </div>

      <TrustBoundary system={system} />
    </GlassPanel>
  );
}

function FocusedExecutionPanel({ compact, model }: { compact: boolean; model: ExecutionIntelligence }) {
  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <SectionTitle eyebrow="Execution Intelligence" title={`${model.symbol} Timing Engine`} meta={model.executionStateLabel} />
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{model.summary}</p>
        </div>
        <div className="grid min-w-[280px] grid-cols-2 gap-2">
          <ScorePill label="Timing" value={model.timingQualityScore} />
          <ScorePill label="Entry" value={model.entryQuality.score} />
          <ScorePill label="Confirm" value={model.confirmationQuality.score} />
          <ScorePill inverse label="Chase" value={model.chaseRisk.score} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {model.compactLabels.map((label) => <StatusChip key={label} label={label} />)}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Execution Quality Map</div>
          <div className="mt-3 grid gap-3">
            <ExecutionBar score={model.entryQuality} />
            <ExecutionBar score={model.pullbackQuality} />
            <ExecutionBar score={model.breakoutQuality} />
            <ExecutionBar score={model.confirmationQuality} />
            <ExecutionBar inverse score={model.chaseRisk} />
            <ExecutionBar inverse score={model.volatilityExecutionRisk} />
          </div>
        </div>
        <div className="grid gap-3">
          <ZoneBox label="Research entry zone" value={model.zones.researchEntryZone} />
          <ZoneBox label="Historical entry zone" value={model.zones.historicalEntryZone} />
          <ZoneBox label="Do-not-chase zone" tone="risk" value={model.zones.doNotChaseZone} />
          <ZoneBox label="Invalidation area" tone="risk" value={model.zones.invalidationZone} />
          <ZoneBox label="Historical exit context" value={model.zones.historicalExitZone} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ReasonList title="Why Timing May Work" items={model.keyReasons} empty="No dominant positive timing evidence is confirmed." />
        <ReasonList title="What Can Break Execution" items={model.keyRisks} empty="No dominant timing risk is flagged." tone="risk" />
        <ReasonList title="What To Confirm" items={model.whatToConfirm} empty="Confirmation context is limited." />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Historical Execution Context</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {model.historicalExecutionContext.map((line) => (
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-slate-300" key={line}>{line}</div>
          ))}
        </div>
      </div>

      <ExecutionCalibrationBlock model={model} />
    </GlassPanel>
  );
}

function ExecutionList({
  empty,
  items,
  metric,
  title,
  tone = "neutral",
}: {
  empty: string;
  items: ExecutionIntelligence[];
  metric: (model: ExecutionIntelligence) => string;
  title: string;
  tone?: "neutral" | "risk";
}) {
  const titleClass = tone === "risk" ? "text-amber-200" : "text-cyan-200";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${titleClass}`}>{title}</div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((model) => (
          <Link className="block rounded-xl border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35" href={`/symbol/${model.symbol}`} key={model.symbol}>
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-base font-black text-slate-50">{model.symbol}</div>
              <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-200">{metric(model)}</div>
            </div>
            <div className="mt-1 text-xs font-semibold text-cyan-100">{model.executionStateLabel}</div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{model.summary}</p>
          </Link>
        )) : <p className="text-sm leading-6 text-slate-400">{empty}</p>}
      </div>
    </div>
  );
}

function ExecutionBar({ inverse = false, score }: { inverse?: boolean; score: { label: string; score: number } }) {
  const good = inverse ? score.score <= 42 : score.score >= 68;
  const risk = inverse ? score.score >= 70 : score.score < 45;
  const color = good ? "bg-emerald-300" : risk ? "bg-rose-300" : "bg-amber-300";
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-semibold text-slate-300">{score.label}</span>
        <span className="font-mono text-slate-400">{score.score}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, Math.min(100, score.score))}%` }} />
      </div>
    </div>
  );
}

function ReasonList({ empty, items, title, tone = "neutral" }: { empty: string; items: string[]; title: string; tone?: "neutral" | "risk" }) {
  const titleClass = tone === "risk" ? "text-rose-200" : "text-emerald-200";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${titleClass}`}>{title}</div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3 text-xs leading-5 text-slate-300" key={item}>{item}</div>
        )) : <p className="text-sm leading-6 text-slate-400">{empty}</p>}
      </div>
    </div>
  );
}

function ScorePill({ inverse = false, label, value }: { inverse?: boolean; label: string; value: number }) {
  const good = inverse ? value <= 45 : value >= 65;
  const risk = inverse ? value >= 70 : value < 45;
  const color = good ? "text-emerald-200" : risk ? "text-rose-200" : "text-amber-200";
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="min-w-0 truncate text-[9px] font-black uppercase leading-3 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-1 font-mono text-lg font-black ${color}`}>{formatNumber(value, 0)}</div>
    </div>
  );
}

function ExecutionCalibrationBlock({ model }: { model: ExecutionIntelligence }) {
  const current = model.calibration.currentEntryTypeMetrics;
  const selected = [
    current,
    model.calibration.bestValidatedEntryType,
    model.calibration.weakestEntryType,
  ].filter((metric): metric is ExecutionOutcomeMetric => Boolean(metric));
  const uniqueMetrics = Array.from(new Map(selected.map((metric) => [metric.entryType, metric])).values());
  const visibleMetrics = uniqueMetrics.length ? uniqueMetrics : model.calibration.outcomeMetrics.filter((metric) => metric.sampleSize > 0).slice(0, 3);
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Execution Outcome Calibration</div>
          <h3 className="mt-1 text-base font-semibold text-slate-50">{model.calibration.currentEntryTypeLabel}</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{model.calibration.calibrationSummary}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:min-w-[260px]">
          <MiniProofMetric label="Evidence" value={model.calibration.evidenceMaturity} />
          <MiniProofMetric label="Samples" value={formatNumber(model.calibration.validationSampleSize, 0)} />
          <MiniProofMetric label="Score Adj." value={`${model.calibration.scoreAdjustment >= 0 ? "+" : ""}${model.calibration.scoreAdjustment}`} />
          <MiniProofMetric label="Current" value={current ? `${current.score}/100` : "building"} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {visibleMetrics.length ? visibleMetrics.map((metric) => <ExecutionOutcomeCard key={metric.entryType} metric={metric} />) : (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3 text-xs leading-5 text-slate-400">Execution outcome proof is still building for this symbol.</div>
        )}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {model.calibration.timingProofReport.map((line) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3 text-xs leading-5 text-slate-300" key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function ExecutionOutcomeCard({ metric }: { metric: ExecutionOutcomeMetric }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-100">{metric.label}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.reliabilityLabel}</div>
        </div>
        <div className="font-mono text-sm font-black text-cyan-100">{metric.score}/100</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniProofMetric label="Avg MFE" value={percentValue(metric.averageMfePct)} />
        <MiniProofMetric label="Avg MAE" value={percentValue(metric.averageMaePct)} />
        <MiniProofMetric label="Continue" value={rateValue(metric.continuationRate)} />
        <MiniProofMetric label="Reversal" value={rateValue(metric.reversalRate)} />
        <MiniProofMetric label="Failed" value={rateValue(metric.failedBreakoutRate)} />
        <MiniProofMetric label="Invalid." value={rateValue(metric.invalidationHitRate)} />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">{metric.summary}</p>
    </div>
  );
}

function MiniProofMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-2">
      <div className="truncate text-[9px] font-black uppercase leading-3 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className="mt-1 break-words font-mono text-xs font-bold leading-4 text-slate-100">{value}</div>
    </div>
  );
}

function percentValue(value: number | null): string {
  if (value === null) return "building";
  return `${value >= 0 ? "+" : ""}${formatNumber(value, 1)}%`;
}

function rateValue(value: number | null): string {
  if (value === null) return "building";
  return `${formatNumber(value * 100, 0)}%`;
}

function StatusChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.075] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">
      {label}
    </span>
  );
}

function ZoneBox({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "risk"; value: string }) {
  const labelClass = tone === "risk" ? "text-amber-200" : "text-slate-400";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className={`min-w-0 truncate text-[10px] font-black uppercase leading-4 tracking-normal ${labelClass}`} title={label}>{label}</div>
      <div className="mt-2 break-words font-mono text-sm font-bold leading-5 text-slate-50">{value}</div>
    </div>
  );
}

function TrustBoundary({ system }: { system: ExecutionTimingSystem }) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Trust Boundary</div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{system.limitations[0]}</p>
    </div>
  );
}
