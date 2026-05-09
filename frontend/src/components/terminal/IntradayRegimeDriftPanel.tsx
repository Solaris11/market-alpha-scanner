"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  buildIntradayRegimeDriftSystem,
  intradayDriftLabel,
  type IntradayAlertSeverity,
  type IntradayDriftDirection,
  type IntradayOpportunityDrift,
  type IntradayPressureComponent,
  type IntradayReactionItem,
  type IntradayRegimeDriftSystem,
} from "@/lib/trading/intraday-regime-drift";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { IntradayDriftRow } from "@/lib/types";
import { formatNumber } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function IntradayRegimeDriftPanel({
  compact = false,
  driftRows,
  focusSymbol,
  rows,
}: {
  compact?: boolean;
  driftRows: IntradayDriftRow[];
  focusSymbol?: string;
  rows: OpportunityViewModel[];
}) {
  const system = useMemo(() => buildIntradayRegimeDriftSystem({ driftRows, rows }), [driftRows, rows]);
  const focus = focusSymbol ? system.opportunityDrifts.find((item) => item.symbol === focusSymbol.toUpperCase()) ?? null : null;

  if (!rows.length) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Intraday Regime Drift" title="Market-State Baseline Building" meta="waiting for scanner rows" />
        <p className="mt-3 text-sm leading-6 text-slate-400">Intraday drift appears after scanner rows and bounded scan observations are available.</p>
      </GlassPanel>
    );
  }

  if (focus) return <FocusedIntradayPanel compact={compact} focus={focus} system={system} />;

  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <SectionTitle eyebrow="Intraday Regime Drift" title={system.currentMarketState} meta={intradayDriftLabel(system.driftDirection)} />
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{system.terminalSummary}</p>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">
            {system.observationWindowLabel}. Coverage {system.coverage.coveragePct}% across {system.coverage.driftRows}/{system.coverage.rows} symbols.
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:min-w-[310px] sm:grid-cols-4 xl:grid-cols-2">
          <ScoreTile label="Drift" value={system.driftScore} />
          <ScoreTile inverse label="Volatility" value={system.volatilityPressure} />
          <ScoreTile label="Breadth" value={system.breadthHealthScore} />
          <ScoreTile inverse label="Shock" value={system.shockActivityScore} />
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "xl:grid-cols-3" : "xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_360px]"}`}>
        <PressureMap components={system.components} compact={compact} />
        <OpportunityDriftStack items={system.opportunityDrifts.slice(0, compact ? 5 : 8)} />
        <AlertStack alerts={system.alerts} />
      </div>

      {!compact ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
          <ChangeBriefing system={system} />
          <ReactionFeed eventItems={system.eventReactionFeed} macroItems={system.macroReactionFeed} />
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">LLM Boundary</div>
        <p className="mt-2 text-xs leading-5 text-slate-400">{system.llmBoundary}</p>
      </div>
    </GlassPanel>
  );
}

function FocusedIntradayPanel({ compact, focus, system }: { compact: boolean; focus: IntradayOpportunityDrift; system: IntradayRegimeDriftSystem }) {
  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <SectionTitle eyebrow="Intraday Drift" title={`${focus.symbol} ${focus.state}`} meta={intradayDriftLabel(focus.direction)} />
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{focus.detail}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Market state: {system.currentMarketState}. {system.observationWindowLabel}. This is research context, not a trade instruction.
          </p>
        </div>
        <div className="grid min-w-[240px] grid-cols-2 gap-2">
          <ScoreTile label="Drift" value={focus.score} />
          <ScoreTile inverse label="Volatility" value={system.volatilityPressure} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Reason Codes</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {focus.reasonCodes.map((code) => <CodeChip code={code} key={code} />)}
          </div>
        </div>
        <MonitorStack items={system.whatToMonitor} />
      </div>
    </GlassPanel>
  );
}

function PressureMap({ compact, components }: { compact: boolean; components: IntradayPressureComponent[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Intraday Pressure</div>
      <div className="mt-3 grid gap-3">
        {components.slice(0, compact ? 5 : 7).map((component) => <StateBar component={component} key={component.key} />)}
      </div>
    </div>
  );
}

function StateBar({ component }: { component: IntradayPressureComponent }) {
  const good = component.inverse ? component.score <= 42 : component.score >= 65;
  const risk = component.inverse ? component.score >= 70 : component.score <= 42;
  const color = good ? "bg-emerald-300" : risk ? "bg-rose-300" : "bg-amber-300";
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-semibold text-slate-300">{component.label}</span>
        <span className="whitespace-nowrap font-mono text-slate-400">{component.score}/100 · {component.state}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, Math.min(100, component.score))}%` }} />
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{component.detail}</p>
    </div>
  );
}

function OpportunityDriftStack({ items }: { items: IntradayOpportunityDrift[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Opportunity Drift</div>
      <div className="mt-3 grid gap-2">
        {items.length ? items.map((item) => (
          <Link className="rounded-xl border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35" href={`/symbol/${item.symbol}`} key={`${item.symbol}-${item.state}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-black text-slate-50">{item.symbol}</span>
                  <span className={directionClass(item.direction)}>{intradayDriftLabel(item.direction)}</span>
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-300">{item.state}</div>
              </div>
              <div className="font-mono text-sm font-black text-cyan-100">{item.score}</div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
            <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.metricLabel}</div>
          </Link>
        )) : <p className="text-sm leading-6 text-slate-400">No dominant symbol-level intraday drift is confirmed yet.</p>}
      </div>
    </div>
  );
}

function AlertStack({ alerts }: { alerts: Array<{ detail: string; reasonCodes: string[]; score: number; severity: IntradayAlertSeverity; title: string }> }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Intraday Alerts</div>
      <div className="mt-3 space-y-2">
        {alerts.slice(0, 6).map((alert) => (
          <div className={`rounded-xl border p-3 ${alertClass(alert.severity)}`} key={`${alert.title}-${alert.reasonCodes.join("-")}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-bold text-slate-100">{alert.title}</div>
              <div className="font-mono text-xs font-black text-slate-300">{alert.score}</div>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">{alert.detail}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {alert.reasonCodes.map((code) => <CodeChip code={code} key={code} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangeBriefing({ system }: { system: IntradayRegimeDriftSystem }) {
  return (
    <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.055] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">What Changed Intraday</div>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
        {system.whatChangedIntraday.map((line) => <li key={line}>- {line}</li>)}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ScoreTile inverse label="Liquidity" value={system.liquidityPressure} />
        <ScoreTile inverse label="Exchange" value={system.exchangePressure} />
        <ScoreTile inverse label="Sector" value={system.sectorRotationPressure} />
        <ScoreTile inverse label="Event" value={system.eventReactionScore} />
      </div>
    </div>
  );
}

function ReactionFeed({ eventItems, macroItems }: { eventItems: IntradayReactionItem[]; macroItems: IntradayReactionItem[] }) {
  const items = [...eventItems, ...macroItems].slice(0, 6);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Macro Reaction Feed</div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <div className={`rounded-xl border p-3 ${alertClass(item.severity)}`} key={`${item.symbol}-${item.title}-${item.metricLabel}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-sm font-black text-slate-50">{item.symbol}</div>
                <div className="mt-1 text-xs font-semibold text-slate-300">{item.title}</div>
              </div>
              <div className="text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{item.metricLabel}</div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p>
          </div>
        )) : <p className="text-sm leading-6 text-slate-400">No verified macro/event reaction dominates the latest bounded observations.</p>}
      </div>
    </div>
  );
}

function MonitorStack({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">What To Monitor</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3 text-xs leading-5 text-slate-300" key={item}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function CodeChip({ code }: { code: string }) {
  return <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold text-slate-400">{code}</span>;
}

function ScoreTile({ inverse = false, label, value }: { inverse?: boolean; label: string; value: number }) {
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

function alertClass(severity: IntradayAlertSeverity): string {
  if (severity === "critical") return "border-rose-300/25 bg-rose-400/[0.08]";
  if (severity === "warning") return "border-amber-300/20 bg-amber-400/[0.07]";
  return "border-cyan-300/15 bg-cyan-400/[0.055]";
}

function directionClass(direction: IntradayDriftDirection): string {
  const base = "rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em]";
  if (direction === "improving") return `${base} border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100`;
  if (direction === "deteriorating") return `${base} border-amber-300/25 bg-amber-400/[0.08] text-amber-100`;
  if (direction === "unstable_transition") return `${base} border-rose-300/25 bg-rose-400/[0.08] text-rose-100`;
  return `${base} border-white/10 bg-white/[0.04] text-slate-400`;
}
