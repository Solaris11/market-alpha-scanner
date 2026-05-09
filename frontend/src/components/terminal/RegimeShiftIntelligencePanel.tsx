"use client";

import { useMemo } from "react";
import {
  buildRegimeShiftSystem,
  type RegimeAlertSeverity,
  type RegimeDriftDirection,
  type RegimeShiftComponent,
} from "@/lib/trading/regime-shift-intelligence";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { formatNumber } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function RegimeShiftIntelligencePanel({
  compact = false,
  rows,
  workflowEvolution,
}: {
  compact?: boolean;
  rows: OpportunityViewModel[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
}) {
  const system = useMemo(() => buildRegimeShiftSystem({ rows, workflowEvolution }), [rows, workflowEvolution]);

  if (!rows.length) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Regime Shift Intelligence" title="Market State Building" meta="waiting for scanner rows" />
        <p className="mt-3 text-sm leading-6 text-slate-400">Real-time regime context appears after scanner rows are available.</p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <SectionTitle eyebrow="Real-Time Regime Shift" title={system.currentMarketState} meta={driftLabel(system.driftDirection)} />
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{system.terminalSummary}</p>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">{system.stateExplanation}</p>
        </div>
        <div className="grid min-w-[290px] grid-cols-3 gap-2">
          <ScoreTile label="Risk Appetite" value={system.riskAppetiteScore} />
          <ScoreTile inverse label="Transition" value={system.transitionRiskScore} />
          <ScoreTile label="Breadth" value={system.breadthHealthScore} />
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "xl:grid-cols-3" : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]"}`}>
        <StateMap components={system.components} />
        <AlertStack alerts={system.alerts} />
        <MonitorStack items={system.whatToMonitor} />
      </div>

      {!compact ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DriftTimeline items={system.driftTimeline} />
          <SectorLeadership
            aiScore={system.sectorLeadership.aiMomentumScore}
            defensiveScore={system.sectorLeadership.defensiveLeadershipScore}
            detail={system.sectorLeadership.detail}
            growthScore={system.sectorLeadership.growthLeadershipScore}
            leading={system.sectorLeadership.leadingSectors}
            rotation={system.sectorLeadership.rotationScore}
            weakening={system.sectorLeadership.weakeningSectors}
          />
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">LLM Boundary</div>
        <p className="mt-2 text-xs leading-5 text-slate-400">{system.llmBoundary}</p>
      </div>
    </GlassPanel>
  );
}

function StateMap({ components }: { components: RegimeShiftComponent[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Market State Dashboard</div>
      <div className="mt-3 grid gap-3">
        {components.slice(0, 6).map((component) => <StateBar component={component} key={component.key} />)}
      </div>
    </div>
  );
}

function StateBar({ component }: { component: RegimeShiftComponent }) {
  const good = component.inverse ? component.score <= 42 : component.score >= 65;
  const risk = component.inverse ? component.score >= 70 : component.score <= 42;
  const color = good ? "bg-emerald-300" : risk ? "bg-rose-300" : "bg-amber-300";
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-semibold text-slate-300">{component.label}</span>
        <span className="font-mono text-slate-400">{component.score}/100 · {component.state}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, Math.min(100, component.score))}%` }} />
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{component.detail}</p>
    </div>
  );
}

function AlertStack({ alerts }: { alerts: Array<{ detail: string; reasonCodes: string[]; score: number; severity: RegimeAlertSeverity; title: string }> }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Transition Alerts</div>
      <div className="mt-3 space-y-2">
        {alerts.slice(0, 5).map((alert) => (
          <div className={`rounded-xl border p-3 ${alertClass(alert.severity)}`} key={`${alert.title}-${alert.reasonCodes.join("-")}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-bold text-slate-100">{alert.title}</div>
              <div className="font-mono text-xs font-black text-slate-300">{alert.score}</div>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">{alert.detail}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {alert.reasonCodes.map((code) => <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold text-slate-400" key={code}>{code}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonitorStack({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">What To Monitor Next</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3 text-xs leading-5 text-slate-300" key={item}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function DriftTimeline({ items }: { items: Array<{ detail: string; direction: RegimeDriftDirection; label: string; metricLabel: string; score: number }> }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Regime Drift Timeline</div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3" key={`${item.label}-${item.metricLabel}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-100">{item.label}</div>
              <div className={directionClass(item.direction)}>{driftLabel(item.direction)}</div>
            </div>
            <div className="mt-1 font-mono text-xs text-slate-400">{item.metricLabel}</div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectorLeadership({
  aiScore,
  defensiveScore,
  detail,
  growthScore,
  leading,
  rotation,
  weakening,
}: {
  aiScore: number;
  defensiveScore: number;
  detail: string;
  growthScore: number;
  leading: string[];
  rotation: number;
  weakening: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Sector Leadership</div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ScoreTile label="Growth" value={growthScore} />
        <ScoreTile label="AI" value={aiScore} />
        <ScoreTile label="Defensive" value={defensiveScore} />
        <ScoreTile inverse label="Rotation" value={rotation} />
      </div>
      <div className="mt-3 space-y-2">
        <ChipLine empty="No clear leader" items={leading} title="Leading" />
        <ChipLine empty="No clear weakness" items={weakening} title="Weakening" />
      </div>
    </div>
  );
}

function ChipLine({ empty, items, title }: { empty: string; items: string[]; title: string }) {
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.length ? items.map((item) => (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-slate-300" key={item}>{item}</span>
        )) : <span className="text-xs text-slate-500">{empty}</span>}
      </div>
    </div>
  );
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

function alertClass(severity: RegimeAlertSeverity): string {
  if (severity === "critical") return "border-rose-300/25 bg-rose-400/[0.08]";
  if (severity === "warning") return "border-amber-300/20 bg-amber-400/[0.07]";
  return "border-cyan-300/15 bg-cyan-400/[0.055]";
}

function directionClass(direction: RegimeDriftDirection): string {
  const base = "rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]";
  if (direction === "improving") return `${base} border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100`;
  if (direction === "deteriorating") return `${base} border-amber-300/25 bg-amber-400/[0.08] text-amber-100`;
  if (direction === "unstable_transition") return `${base} border-rose-300/25 bg-rose-400/[0.08] text-rose-100`;
  return `${base} border-white/10 bg-white/[0.04] text-slate-400`;
}

function driftLabel(direction: RegimeDriftDirection): string {
  if (direction === "unstable_transition") return "Unstable Transition";
  if (direction === "improving") return "Improving";
  if (direction === "deteriorating") return "Deteriorating";
  return "Stable";
}
