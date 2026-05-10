"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  buildTradeVetoOperatingSystem,
  metaOpportunityLabel,
  type MetaOpportunityGroup,
  type MetaOpportunityPriority,
  type TradeVetoOperatingSystem,
} from "@/lib/trading/meta-intelligence";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { UserPersonalizationProfile } from "@/lib/trading/personalized-intelligence";
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { formatNumber } from "@/lib/ui/formatters";
import { humanizeInsightText } from "@/lib/ui/labels";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function MetaIntelligenceOperatingSystemPanel({
  compact = false,
  focusSymbol,
  personalizationProfile,
  rows,
  workflowEvolution,
}: {
  compact?: boolean;
  focusSymbol?: string;
  personalizationProfile?: UserPersonalizationProfile | null;
  rows: OpportunityViewModel[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
}) {
  const system = useMemo(() => buildTradeVetoOperatingSystem({ personalizationProfile, rows, workflowEvolution }), [personalizationProfile, rows, workflowEvolution]);
  const focus = focusSymbol ? system.priorityQueue.find((item) => item.symbol === focusSymbol.toUpperCase()) ?? null : null;

  if (!rows.length) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="TradeVeto OS" title="Meta Intelligence Building" meta="orchestrator" />
        <p className="mt-3 text-sm leading-6 text-slate-400">Meta intelligence appears after scanner rows are available.</p>
      </GlassPanel>
    );
  }

  if (focus) {
    return <FocusedMetaPanel compact={compact} item={focus} system={system} />;
  }

  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <SectionTitle eyebrow="TradeVeto Intelligence OS" title="What Matters Most" meta={system.marketState} />
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{humanizeInsightText(system.summary)}</p>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">{humanizeInsightText(system.marketStateReason)}</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:max-w-md sm:grid-cols-3 xl:w-[380px]">
          <ScoreTile label="Opportunity" value={system.metaOpportunityAverage} />
          <ScoreTile label="Decision" value={system.decisionQualityAverage} />
          <ScoreTile inverse label="Risk" value={system.metaRiskAverage} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
        <BriefingBlock title="Executive Market Briefing" lines={system.executiveBriefing} />
        <BriefingBlock title="Personalized Briefing" lines={system.personalizedBriefing} />
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_360px]"}`}>
        <PriorityQueue items={system.priorityQueue.slice(0, compact ? 5 : 8)} title="Unified Priority Queue" />
        <AttentionStack system={system} />
      </div>

      {!compact ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <OpportunityHierarchy groups={system.opportunityHierarchy} />
          <MetaTimeline system={system} />
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Orchestration Boundary</div>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          The OS layer combines scored evidence from TradeVeto engines. It decides what deserves attention; it does not predict markets, invent events, or override TradeVeto's main risk decision.
        </p>
      </div>
    </GlassPanel>
  );
}

function FocusedMetaPanel({ compact, item, system }: { compact: boolean; item: MetaOpportunityPriority; system: TradeVetoOperatingSystem }) {
  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <SectionTitle eyebrow="TradeVeto Intelligence OS" title={`${item.symbol} Meta Decision Quality`} meta={metaOpportunityLabel(item)} />
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            {item.symbol} is categorized as {item.category.toLowerCase()} with {item.decisionQualityScore}/100 decision quality, {item.timingQualityScore}/100 timing quality, and {item.metaRiskScore}/100 meta risk.
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{humanizeInsightText(system.marketStateReason)}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:max-w-xs xl:w-[300px]">
          <ScoreTile label="Meta Opp." value={item.metaOpportunityScore} />
          <ScoreTile label="Decision" value={item.decisionQualityScore} />
          <ScoreTile label="Timing" value={item.timingQualityScore} />
          <ScoreTile inverse label="Risk" value={item.metaRiskScore} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ReasonList title="Why It Matters" items={item.keyReasons} />
        <ReasonList title="Risk Tradeoffs" items={item.keyRisks} tone="risk" />
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Attention State</div>
          <div className="mt-2 font-mono text-lg font-black text-slate-50">{item.state}</div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Urgency {item.urgencyScore}/100. Priority is {item.attentionPriority}. This is a research attention label, not a trade instruction.
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}

function PriorityQueue({ items, title }: { items: MetaOpportunityPriority[]; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{title}</div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">attention-ranked</div>
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((item, index) => (
          <Link className="rounded-xl border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35" href={`/symbol/${item.symbol}`} key={`${item.symbol}-${item.category}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-black text-slate-50">{index + 1}. {item.symbol}</span>
                  <span className={priorityClass(item.attentionPriority)}>{item.attentionPriority}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">{item.category} · {item.state}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-black text-cyan-100">{item.metaOpportunityScore}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">meta</div>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{humanizeInsightText(item.keyReasons[0])}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AttentionStack({ system }: { system: TradeVetoOperatingSystem }) {
  return (
    <div className="grid gap-3">
      <MiniQueue title="Attention" items={system.attentionQueue} metric={(item) => `${item.urgencyScore} urgent`} />
      <MiniQueue title="Danger" items={system.dangerQueue} metric={(item) => `${item.metaRiskScore} risk`} tone="risk" />
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Conflicts</div>
        <div className="mt-2 space-y-2">
          {system.conflicts.length ? system.conflicts.slice(0, 3).map((conflict) => (
            <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3" key={`${conflict.symbol}-${conflict.title}`}>
              <div className="font-mono text-sm font-black text-slate-50">{conflict.symbol}</div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{humanizeInsightText(conflict.detail)}</p>
            </div>
          )) : <p className="text-sm leading-6 text-slate-400">No major opportunity/risk conflict is dominant.</p>}
        </div>
      </div>
    </div>
  );
}

function OpportunityHierarchy({ groups }: { groups: MetaOpportunityGroup[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Opportunity Hierarchy</div>
      <div className="mt-3 grid gap-3">
        {groups.map((group) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3" key={group.category}>
            <div className="text-sm font-bold text-slate-100">{group.category}</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{humanizeInsightText(group.description)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {group.opportunities.slice(0, 4).map((item) => (
                <Link className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100" href={`/symbol/${item.symbol}`} key={item.symbol}>
                  {item.symbol} {item.metaOpportunityScore}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetaTimeline({ system }: { system: TradeVetoOperatingSystem }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Evolution Timeline</div>
      <div className="mt-3 space-y-2">
        {system.timelineSignals.length ? system.timelineSignals.map((signal) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3" key={`${signal.symbol}-${signal.signalType}-${signal.detail}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-sm font-black text-slate-50">{signal.symbol}</div>
              <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{signal.signalType}</div>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">{humanizeInsightText(signal.detail)}</p>
          </div>
        )) : <p className="text-sm leading-6 text-slate-400">Timeline signals will become richer after workflow snapshots accumulate.</p>}
      </div>
    </div>
  );
}

function BriefingBlock({ lines, title }: { lines: string[]; title: string }) {
  return (
    <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.055] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{title}</div>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
        {lines.map((line) => <li key={line}>- {humanizeInsightText(line)}</li>)}
      </ul>
    </div>
  );
}

function MiniQueue({ items, metric, title, tone = "neutral" }: { items: MetaOpportunityPriority[]; metric: (item: MetaOpportunityPriority) => string; title: string; tone?: "neutral" | "risk" }) {
  const titleClass = tone === "risk" ? "text-rose-200" : "text-cyan-200";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${titleClass}`}>{title}</div>
      <div className="mt-2 space-y-2">
        {items.length ? items.slice(0, 4).map((item) => (
          <Link className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35" href={`/symbol/${item.symbol}`} key={`${title}-${item.symbol}`}>
            <span className="font-mono text-sm font-black text-slate-50">{item.symbol}</span>
            <span className="text-xs text-slate-400">{metric(item)}</span>
          </Link>
        )) : <p className="text-sm leading-6 text-slate-400">No symbols in this queue.</p>}
      </div>
    </div>
  );
}

function ReasonList({ items, title, tone = "neutral" }: { items: string[]; title: string; tone?: "neutral" | "risk" }) {
  const titleClass = tone === "risk" ? "text-rose-200" : "text-emerald-200";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${titleClass}`}>{title}</div>
      <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-300">
        {items.map((item) => <li key={item}>- {humanizeInsightText(item)}</li>)}
      </ul>
    </div>
  );
}

function ScoreTile({ inverse = false, label, value }: { inverse?: boolean; label: string; value: number }) {
  const good = inverse ? value <= 45 : value >= 65;
  const risk = inverse ? value >= 70 : value < 45;
  const color = good ? "text-emerald-200" : risk ? "text-rose-200" : "text-amber-200";
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
      <div className="min-h-7 min-w-0 break-words text-[8px] font-black uppercase leading-4 tracking-normal text-slate-500 sm:text-[9px]" title={label}>{label}</div>
      <div className={`mt-1 font-mono text-lg font-black ${color}`}>{formatNumber(value, 0)}</div>
    </div>
  );
}

function priorityClass(priority: MetaOpportunityPriority["attentionPriority"]): string {
  const base = "rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]";
  if (priority === "critical") return `${base} border-rose-300/25 bg-rose-400/[0.1] text-rose-100`;
  if (priority === "high") return `${base} border-amber-300/25 bg-amber-400/[0.1] text-amber-100`;
  if (priority === "medium") return `${base} border-cyan-300/20 bg-cyan-400/[0.08] text-cyan-100`;
  return `${base} border-white/10 bg-white/[0.04] text-slate-400`;
}
