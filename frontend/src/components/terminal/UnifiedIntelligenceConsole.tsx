"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  buildUnifiedIntelligenceConsole,
  type UnifiedConsoleBriefing,
  type UnifiedConsoleItem,
  type UnifiedConsoleMetric,
} from "@/lib/trading/unified-intelligence-console";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { UserPersonalizationProfile } from "@/lib/trading/personalized-intelligence";
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { formatNumber } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function UnifiedIntelligenceConsole({
  marketCondition,
  personalizationProfile,
  rows,
  surface = "terminal",
  workflowEvolution,
}: {
  marketCondition?: string | null;
  personalizationProfile?: UserPersonalizationProfile | null;
  rows: OpportunityViewModel[];
  surface?: "dashboard" | "terminal";
  workflowEvolution?: WorkflowEvolutionSummary | null;
}) {
  const consoleModel = useMemo(
    () => buildUnifiedIntelligenceConsole({ marketCondition, personalizationProfile, rows, workflowEvolution }),
    [marketCondition, personalizationProfile, rows, workflowEvolution],
  );
  const compact = surface === "terminal";

  if (!rows.length) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Unified Console" title="What Matters Most Now" meta="waiting for scanner rows" />
        <p className="mt-3 text-sm leading-6 text-slate-400">The unified console appears after scanner rows are available.</p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="overflow-hidden p-4 sm:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Unified Decision Console</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">What Matters Most Now</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{consoleModel.summary}</p>
          <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-500">{consoleModel.personalizedSummary}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {consoleModel.whatMattersMost.slice(0, compact ? 3 : 5).map((line, index) => (
              <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/35 p-3" key={line}>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 font-mono text-[11px] font-black text-cyan-100">{index + 1}</div>
                  <p className="line-clamp-3 text-xs leading-5 text-slate-300">{line}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2">
          {consoleModel.metrics.slice(0, 6).map((metric) => <ConsoleMetricTile key={metric.key} metric={metric} />)}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <PriorityQueue items={consoleModel.attentionQueue} />
        <ContextStack
          bestAsymmetry={consoleModel.bestAsymmetry}
          eventPressure={consoleModel.eventPressure}
          fragilityRising={consoleModel.fragilityRising}
          macroLabel={consoleModel.macroRegime.label}
          macroSummary={consoleModel.macroRegime.summary}
          shockConditionsAligning={consoleModel.shockConditionsAligning}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <BriefingList empty="No material changes are available yet." items={consoleModel.biggestChanges} title="Biggest Changes" />
        <BriefingList empty="No watchlist-specific change is available yet." items={consoleModel.watchlistChanges} title="Watchlist Changes" />
        <BriefingList empty="No new revisit signal is available yet." items={consoleModel.whatChangedSinceLastVisit} title="Since Last Visit" />
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <div className="text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">LLM Summary Boundary</div>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Summary text is generated from deterministic TradeVeto packets only. LLM output must stay grounded in {consoleModel.llmSummaryPacket.topAttentionSymbols.length} attention symbols, verified risks, and change records.
        </p>
      </div>
    </GlassPanel>
  );
}

function ConsoleMetricTile({ metric }: { metric: UnifiedConsoleMetric }) {
  const status = metric.inverse
    ? metric.score >= 70 ? "Elevated" : metric.score <= 45 ? "Contained" : "Mixed"
    : metric.score >= 70 ? "Strong" : metric.score >= 50 ? "Mixed" : "Limited";
  const tone = metric.inverse
    ? metric.score >= 70 ? "text-rose-200" : metric.score <= 45 ? "text-emerald-200" : "text-amber-200"
    : metric.score >= 70 ? "text-emerald-200" : metric.score >= 50 ? "text-amber-200" : "text-slate-300";
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="truncate text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={metric.label}>{metric.label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div className={`truncate text-sm font-bold ${tone}`}>{status}</div>
        <div className="font-mono text-2xl font-black text-slate-50">{formatNumber(metric.score, 0)}</div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${metric.inverse ? "bg-amber-300" : "bg-cyan-300"}`} style={{ width: `${Math.max(6, Math.min(100, metric.score))}%` }} />
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">{metric.detail}</p>
    </div>
  );
}

function PriorityQueue({ items }: { items: UnifiedConsoleItem[] }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <SectionTitle eyebrow="Attention Priority" title="Unified Priority Queue" meta="opportunity + risk" />
      <div className="mt-3 grid gap-2">
        {items.slice(0, 6).map((item, index) => (
          <Link className="block min-w-0 rounded-lg border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.05]" href={item.href} key={item.key}>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px] sm:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-black text-slate-50">{index + 1}. {item.symbol}</span>
                  <span className={priorityClass(item.attentionPriority)}>{item.urgencyLabel}</span>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-400">{item.decision}</span>
                </div>
                <div className="mt-1 truncate text-xs text-cyan-100" title={item.category}>{item.category}</div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{item.reasonForAttention}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{item.actionContext}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-right">
                <div className="font-mono text-2xl font-black text-cyan-100">{item.attentionPriorityScore}</div>
                <div className="text-[10px] uppercase leading-4 tracking-normal text-slate-500">attention</div>
                <div className="mt-1 truncate text-[11px] text-slate-400" title={item.metricLabel}>{item.metricLabel}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ContextStack({
  bestAsymmetry,
  eventPressure,
  fragilityRising,
  macroLabel,
  macroSummary,
  shockConditionsAligning,
}: {
  bestAsymmetry: UnifiedConsoleBriefing[];
  eventPressure: UnifiedConsoleBriefing[];
  fragilityRising: UnifiedConsoleBriefing[];
  macroLabel: string;
  macroSummary: string;
  shockConditionsAligning: UnifiedConsoleBriefing[];
}) {
  return (
    <div className="grid gap-3">
      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <div className="text-[10px] font-black uppercase leading-4 tracking-normal text-cyan-300">Macro Regime</div>
        <div className="mt-2 text-lg font-semibold text-slate-50">{macroLabel}</div>
        <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-400">{macroSummary}</p>
      </div>
      <BriefingList empty="No elevated shock alignment is visible." items={shockConditionsAligning} title="Shock Conditions Aligning" />
      <BriefingList empty="No elevated source-backed event pressure is visible." items={eventPressure} title="Event Pressure" />
      <BriefingList empty="No dominant fragility escalation is visible." items={fragilityRising} title="Fragility Rising" />
      <BriefingList empty="No high-asymmetry leader is confirmed yet." items={bestAsymmetry} title="Best Asymmetry" />
    </div>
  );
}

function BriefingList({ empty, items, title }: { empty: string; items: UnifiedConsoleBriefing[]; title: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="truncate text-[10px] font-black uppercase leading-4 tracking-normal text-cyan-300" title={title}>{title}</div>
        <div className="font-mono text-[11px] text-slate-500">{items.length}</div>
      </div>
      <div className="mt-3 space-y-2">
        {items.length ? items.slice(0, 4).map((item) => (
          <BriefingRow item={item} key={`${title}:${item.symbol ?? item.label}`} />
        )) : <p className="text-xs leading-5 text-slate-500">{empty}</p>}
      </div>
    </div>
  );
}

function BriefingRow({ item }: { item: UnifiedConsoleBriefing }) {
  const content = (
    <div className="rounded-lg border border-white/10 bg-slate-950/35 p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="line-clamp-2 text-xs leading-5 text-slate-300">{item.label}</p>
        <span className={briefingPriorityClass(item.priority)}>{item.priority}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{item.actionContext}</p>
    </div>
  );
  return item.symbol ? <Link href={`/symbol/${item.symbol}`}>{content}</Link> : content;
}

function priorityClass(priority: UnifiedConsoleItem["attentionPriority"]): string {
  const base = "rounded-full border px-2 py-1 text-[10px] font-black uppercase leading-4 tracking-normal";
  if (priority === "critical") return `${base} border-rose-300/30 bg-rose-400/10 text-rose-100`;
  if (priority === "high") return `${base} border-amber-300/30 bg-amber-400/10 text-amber-100`;
  if (priority === "medium") return `${base} border-cyan-300/25 bg-cyan-400/10 text-cyan-100`;
  return `${base} border-white/10 bg-white/[0.04] text-slate-300`;
}

function briefingPriorityClass(priority: UnifiedConsoleBriefing["priority"]): string {
  const base = "shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase leading-4 tracking-normal";
  if (priority === "high") return `${base} border-rose-300/30 bg-rose-400/10 text-rose-100`;
  if (priority === "medium") return `${base} border-amber-300/30 bg-amber-400/10 text-amber-100`;
  return `${base} border-white/10 bg-white/[0.04] text-slate-400`;
}
