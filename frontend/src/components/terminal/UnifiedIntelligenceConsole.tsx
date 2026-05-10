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
import { humanizeInsightText } from "@/lib/ui/labels";
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
      <GlassPanel className="p-5" data-onboarding-target="what-matters-now">
        <SectionTitle eyebrow="Unified Console" title="What Matters Most Now" meta="waiting for scanner rows" />
        <p className="mt-3 text-sm leading-6 text-slate-400">The unified console appears after scanner rows are available.</p>
      </GlassPanel>
    );
  }

  const focusItems = consoleModel.whatMattersMost.slice(0, compact ? 3 : 5);
  const primaryFocus = focusItems[0] ?? consoleModel.summary;
  const secondaryFocus = focusItems.slice(1);
  const metricsToShow = consoleModel.metrics.slice(0, compact ? 4 : 6);

  if (compact) {
    return <SimpleHomeConsole consoleModel={consoleModel} />;
  }

  return (
    <GlassPanel className="overflow-hidden border-cyan-300/15 bg-cyan-400/[0.025] p-4 sm:p-5" data-onboarding-target="what-matters-now">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(300px,0.82fr)]">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Unified Decision Console</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">What Matters Most Now</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{humanizeInsightText(consoleModel.summary)}</p>
          <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-500">{humanizeInsightText(consoleModel.personalizedSummary)}</p>

          <div className="mt-5 rounded-xl border border-cyan-300/20 bg-slate-950/45 p-4 shadow-[0_0_0_1px_rgba(103,232,249,0.04)]">
            <div className="text-[10px] font-black uppercase leading-4 tracking-[0.22em] text-cyan-200">Primary focus</div>
            <p className="mt-2 text-base leading-7 text-slate-100">{humanizeInsightText(primaryFocus)}</p>
          </div>

          {secondaryFocus.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {secondaryFocus.map((line, index) => (
                <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/30 p-3" key={line}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 font-mono text-[11px] font-black text-cyan-100">{index + 2}</div>
                    <p className="line-clamp-3 text-xs leading-5 text-slate-300">{humanizeInsightText(line)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {metricsToShow.map((metric) => <ConsoleMetricTile key={metric.key} metric={metric} />)}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <PriorityQueue items={consoleModel.attentionQueue} />
        <ContextStack
          bestAsymmetry={consoleModel.bestAsymmetry}
          compact={compact}
          eventPressure={consoleModel.eventPressure}
          fragilityRising={consoleModel.fragilityRising}
          macroLabel={consoleModel.macroRegime.label}
          macroSummary={consoleModel.macroRegime.summary}
          shockConditionsAligning={consoleModel.shockConditionsAligning}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <BriefingList empty="No material changes are available yet." items={consoleModel.biggestChanges} limit={compact ? 3 : 4} title="Biggest Changes" />
        <BriefingList empty="No watchlist-specific change is available yet." items={consoleModel.watchlistChanges} limit={compact ? 3 : 4} title="Watchlist Changes" />
        <BriefingList empty="No new revisit signal is available yet." items={consoleModel.whatChangedSinceLastVisit} limit={compact ? 3 : 4} title="Since Last Visit" />
      </div>

      <details className="mt-4 rounded-lg border border-white/10 bg-white/[0.025] p-3">
        <summary className="cursor-pointer text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">Grounding boundary</summary>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Summary text uses scored TradeVeto data only. AI output must stay grounded in {consoleModel.llmSummaryPacket.topAttentionSymbols.length} attention symbols, verified risks, and recorded changes.
        </p>
      </details>
    </GlassPanel>
  );
}

function SimpleHomeConsole({ consoleModel }: { consoleModel: ReturnType<typeof buildUnifiedIntelligenceConsole> }) {
  const opportunities = consoleModel.topOpportunities.slice(0, 3);
  const risks = consoleModel.topRisks.slice(0, 3);
  const changes = consoleModel.biggestChanges.slice(0, 3);
  const shocks = consoleModel.shockConditionsAligning.slice(0, 3);
  const watchlist = consoleModel.watchlistChanges.slice(0, 3);
  const headline = consoleModel.whatMattersMost[0] ?? consoleModel.summary;
  const watchNext = [
    opportunities[0]?.actionContext,
    risks[0]?.riskLabel,
    shocks[0]?.actionContext,
  ].filter((item): item is string => Boolean(item));

  return (
    <GlassPanel className="overflow-hidden border-cyan-300/20 bg-cyan-400/[0.035] p-4 sm:p-5" data-onboarding-target="what-matters-now">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Unified Simple Console</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">What Matters Now</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{humanizeInsightText(headline)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <SimpleStatusPill label="Market State" value={humanizeInsightText(consoleModel.macroRegime.label)} />
            <SimpleStatusPill label="Mode" value="Research only" />
            <SimpleStatusPill label="Updated" value={new Date(consoleModel.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {consoleModel.metrics.slice(0, 4).map((metric) => (
            <SimpleMetricRow key={metric.key} metric={metric} />
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <SimpleOpportunityList empty="No clear opportunity leader is available yet." items={opportunities} title="Best Opportunities" />
        <SimpleRiskList empty="No dominant danger item is visible yet." items={risks} title="Dangerous Now" />
        <SimpleMarketStateCard label={consoleModel.macroRegime.label} summary={consoleModel.macroRegime.summary} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <SimpleBriefingCard empty="No major change is available yet." items={changes} title="What Changed" />
        <SimpleBriefingCard empty="No large-move setup is standing out yet." items={shocks} title="Large-Move Watch" />
        <SimpleBriefingCard empty="Add watchlist symbols to see personalized changes here." items={watchlist} title="Watchlist Changes" />
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/35 p-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">What should I watch?</div>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {watchNext.length ? watchNext.slice(0, 3).map((item) => (
            <p className="rounded-lg border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-slate-300" key={item}>{humanizeInsightText(item)}</p>
          )) : (
            <p className="rounded-lg border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-slate-400 md:col-span-3">Wait for fresher scanner rows, cleaner opportunity ranking, or watchlist changes before digging into advanced panels.</p>
          )}
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3">
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-slate-200">
          <span>Advanced intelligence details</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">expand</span>
        </summary>
        <div className="mt-4 grid gap-4">
          <PriorityQueue items={consoleModel.attentionQueue} />
          <div className="grid gap-3 lg:grid-cols-2">
            <BriefingList empty="No verified event pressure is standing out." items={consoleModel.eventPressure} limit={3} title="Event Pressure" />
            <BriefingList empty="No dominant fragility escalation is visible." items={consoleModel.fragilityRising} limit={3} title="Fragility Rising" />
            <BriefingList empty="No clear upside/downside leader is confirmed yet." items={consoleModel.bestAsymmetry} limit={3} title="Best Upside / Downside Balance" />
            <BriefingList empty="No new revisit signal is available yet." items={consoleModel.whatChangedSinceLastVisit} limit={3} title="Since Last Visit" />
          </div>
          <details className="rounded-lg border border-white/10 bg-slate-950/35 p-3">
            <summary className="cursor-pointer text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">Grounding boundary</summary>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Summary text uses scored TradeVeto data only. AI output must stay grounded in {consoleModel.llmSummaryPacket.topAttentionSymbols.length} attention symbols, verified risks, and recorded changes.
            </p>
          </details>
        </div>
      </details>
    </GlassPanel>
  );
}

function SimpleStatusPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-300/15 bg-slate-950/35 px-3 py-1.5 text-[11px] text-slate-300">
      <span className="shrink-0 font-black uppercase tracking-[0.12em] text-cyan-300">{label}</span>
      <span className="min-w-0 truncate font-semibold text-slate-100">{value}</span>
    </span>
  );
}

function SimpleMetricRow({ metric }: { metric: UnifiedConsoleMetric }) {
  const tone = metric.inverse
    ? metric.score >= 70 ? "text-rose-200" : metric.score <= 45 ? "text-emerald-200" : "text-amber-200"
    : metric.score >= 70 ? "text-emerald-200" : metric.score >= 50 ? "text-amber-200" : "text-slate-300";
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_56px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="min-w-0">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-500" title={metric.label}>{metric.label}</div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{humanizeInsightText(metric.detail)}</p>
      </div>
      <div className={`text-right font-mono text-2xl font-black ${tone}`}>{formatNumber(metric.score, 0)}</div>
    </div>
  );
}

function SimpleMarketStateCard({ label, summary }: { label: string; summary: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Market State</div>
      <div className="mt-2 text-xl font-semibold text-slate-50">{humanizeInsightText(label)}</div>
      <p className="mt-2 line-clamp-5 text-sm leading-6 text-slate-400">{humanizeInsightText(summary)}</p>
    </div>
  );
}

function SimpleOpportunityList({ empty, items, title }: { empty: string; items: UnifiedConsoleItem[]; title: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item, index) => (
          <Link className="block rounded-lg border border-white/10 bg-slate-950/35 p-3 transition hover:border-emerald-300/35 hover:bg-white/[0.05]" href={item.href} key={item.key}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-base font-black text-slate-50">{index + 1}. {item.symbol}</div>
              <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-100">{item.attentionPriorityScore}</div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{humanizeInsightText(item.reasonForAttention)}</p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{humanizeInsightText(item.actionContext)}</p>
          </Link>
        )) : <p className="text-sm leading-6 text-slate-500">{empty}</p>}
      </div>
    </div>
  );
}

function SimpleRiskList({ empty, items, title }: { empty: string; items: UnifiedConsoleItem[]; title: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item, index) => (
          <Link className="block rounded-lg border border-white/10 bg-slate-950/35 p-3 transition hover:border-amber-300/35 hover:bg-white/[0.05]" href={item.href} key={item.key}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-base font-black text-slate-50">{index + 1}. {item.symbol}</div>
              <div className={priorityClass(item.attentionPriority)}>{item.urgencyLabel}</div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{humanizeInsightText(item.riskLabel)}</p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{humanizeInsightText(item.actionContext)}</p>
          </Link>
        )) : <p className="text-sm leading-6 text-slate-500">{empty}</p>}
      </div>
    </div>
  );
}

function SimpleBriefingCard({ empty, items, title }: { empty: string; items: UnifiedConsoleBriefing[]; title: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">{title}</div>
        <div className="font-mono text-[11px] text-slate-500">{items.length}</div>
      </div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <BriefingRow item={item} key={`${title}:${item.symbol ?? item.label}`} />
        )) : <p className="text-sm leading-6 text-slate-500">{empty}</p>}
      </div>
    </div>
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
      <div className="min-h-8 break-words text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={metric.label}>{metric.label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div className={`min-w-0 text-sm font-bold ${tone}`}>{status}</div>
        <div className="shrink-0 font-mono text-2xl font-black text-slate-50">{formatNumber(metric.score, 0)}</div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${metric.inverse ? "bg-amber-300" : "bg-cyan-300"}`} style={{ width: `${Math.max(6, Math.min(100, metric.score))}%` }} />
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">{humanizeInsightText(metric.detail)}</p>
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
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{humanizeInsightText(item.reasonForAttention)}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{humanizeInsightText(item.actionContext)}</p>
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
  compact,
  eventPressure,
  fragilityRising,
  macroLabel,
  macroSummary,
  shockConditionsAligning,
}: {
  bestAsymmetry: UnifiedConsoleBriefing[];
  compact: boolean;
  eventPressure: UnifiedConsoleBriefing[];
  fragilityRising: UnifiedConsoleBriefing[];
  macroLabel: string;
  macroSummary: string;
  shockConditionsAligning: UnifiedConsoleBriefing[];
}) {
  return (
    <div className="grid gap-3">
      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <div className="text-[10px] font-black uppercase leading-4 tracking-normal text-cyan-300">Market State</div>
        <div className="mt-2 text-lg font-semibold text-slate-50">{humanizeInsightText(macroLabel)}</div>
        <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-400">{humanizeInsightText(macroSummary)}</p>
      </div>
      <BriefingList empty="No large-move setup is standing out yet." items={shockConditionsAligning} limit={compact ? 2 : 4} title="Large-Move Setups" />
      <BriefingList empty="No verified event pressure is standing out." items={eventPressure} limit={compact ? 2 : 4} title="Event Pressure" />
      {!compact ? <BriefingList empty="No dominant fragility escalation is visible." items={fragilityRising} limit={3} title="Fragility Rising" /> : null}
      {!compact ? <BriefingList empty="No clear upside/downside leader is confirmed yet." items={bestAsymmetry} limit={3} title="Best Upside / Downside Balance" /> : null}
    </div>
  );
}

function BriefingList({ empty, items, limit = 4, title }: { empty: string; items: UnifiedConsoleBriefing[]; limit?: number; title: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="truncate text-[10px] font-black uppercase leading-4 tracking-normal text-cyan-300" title={title}>{title}</div>
        <div className="font-mono text-[11px] text-slate-500">{items.length}</div>
      </div>
      <div className="mt-3 space-y-2">
        {items.length ? items.slice(0, limit).map((item) => (
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
        <p className="line-clamp-2 text-xs leading-5 text-slate-300">{humanizeInsightText(item.label)}</p>
        <span className={briefingPriorityClass(item.priority)}>{item.priority}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{humanizeInsightText(item.actionContext)}</p>
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
