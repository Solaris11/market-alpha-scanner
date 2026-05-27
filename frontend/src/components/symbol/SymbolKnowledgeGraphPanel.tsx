"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BrainCircuit, Clock3, Database, GitBranch, ShieldCheck } from "lucide-react";
import {
  formatKnowledgeRate,
  formatKnowledgeTimestamp,
  type KnowledgeGraphTone,
  type KnowledgeTimelineCategory,
  type SymbolEventMemory,
  type SymbolHistoricalAnalogMemory,
  type SymbolKnowledgeGraphModel,
  type SymbolKnowledgeRelationship,
  type SymbolKnowledgeTimelineItem,
  type SymbolMemoryTrait,
} from "@/lib/trading/symbol-knowledge-graph";
import { humanizeLabel } from "@/lib/ui/labels";

const TONE: Record<KnowledgeGraphTone, { border: string; bg: string; text: string; soft: string }> = {
  amber: {
    bg: "bg-amber-300/10",
    border: "border-amber-300/25",
    soft: "bg-amber-300/[0.055]",
    text: "text-amber-100",
  },
  cyan: {
    bg: "bg-cyan-300/10",
    border: "border-cyan-300/25",
    soft: "bg-cyan-300/[0.055]",
    text: "text-cyan-100",
  },
  emerald: {
    bg: "bg-emerald-300/10",
    border: "border-emerald-300/25",
    soft: "bg-emerald-300/[0.055]",
    text: "text-emerald-100",
  },
  rose: {
    bg: "bg-rose-300/10",
    border: "border-rose-300/25",
    soft: "bg-rose-300/[0.055]",
    text: "text-rose-100",
  },
  violet: {
    bg: "bg-violet-300/10",
    border: "border-violet-300/25",
    soft: "bg-violet-300/[0.055]",
    text: "text-violet-100",
  },
};

const FILTERS: Array<{ category: KnowledgeTimelineCategory | "all"; label: string }> = [
  { category: "all", label: "All" },
  { category: "scanner", label: "Scanner" },
  { category: "replay", label: "Replay" },
  { category: "event", label: "Events" },
  { category: "macro", label: "Macro" },
  { category: "volatility", label: "Volatility" },
  { category: "alert", label: "Alerts" },
];

export function SymbolKnowledgeGraphPanel({
  className = "",
  model,
}: {
  className?: string;
  model: SymbolKnowledgeGraphModel;
}) {
  const [activeCategory, setActiveCategory] = useState<KnowledgeTimelineCategory | "all">("all");
  const timeline = useMemo(
    () => activeCategory === "all" ? model.timeline : model.timeline.filter((item) => item.category === activeCategory),
    [activeCategory, model.timeline],
  );
  const availableTraits = model.traits.filter((trait) => trait.status === "available").length;

  return (
    <section className={`overflow-hidden rounded-3xl border border-violet-300/18 bg-slate-950/48 p-4 shadow-2xl shadow-black/20 sm:p-5 ${className}`} data-symbol-knowledge-graph={model.symbol}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-violet-100">
            <BrainCircuit className="h-4 w-4" />
            Living memory graph
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-50">{model.symbol} Symbol Knowledge Graph</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{model.summary}</p>
        </div>
        <div className="grid min-w-60 grid-cols-3 gap-2 text-center">
          <GraphStat label="Confidence" tone={model.confidenceScore >= 70 ? "emerald" : model.confidenceScore >= 45 ? "cyan" : "amber"} value={`${model.confidenceScore}`} />
          <GraphStat label="Traits" tone={availableTraits ? "cyan" : "amber"} value={`${availableTraits}/${model.traits.length}`} />
          <GraphStat label="Links" tone={model.relationships.length ? "violet" : "amber"} value={`${model.relationships.length}`} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <MemoryTraitGrid traits={model.traits} />
        <RelationshipEngine relationships={model.relationships} symbol={model.symbol} unavailable={model.unavailable} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <HistoricalAnalogPanel analogs={model.historicalAnalogs} />
        <EventMemoryPanel events={model.eventMemory} />
      </div>

      <TimelinePanel activeCategory={activeCategory} items={timeline} onCategoryChange={setActiveCategory} totalItems={model.timeline.length} />

      <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Evidence boundaries</summary>
        <ul className="mt-3 grid gap-2 text-xs leading-5 text-slate-500">
          {model.evidenceBoundaries.map((item) => (
            <li className="flex gap-2" key={item}>
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/70" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function GraphStat({ label, tone, value }: { label: string; tone: KnowledgeGraphTone; value: string }) {
  const classes = TONE[tone];
  return (
    <div className={`rounded-2xl border ${classes.border} ${classes.soft} px-3 py-2`}>
      <div className={`font-mono text-lg font-black ${classes.text}`}>{value}</div>
      <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
    </div>
  );
}

function MemoryTraitGrid({ traits }: { traits: SymbolMemoryTrait[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
        <Database className="h-4 w-4" />
        Symbol memory
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {traits.map((trait) => {
          const classes = TONE[trait.tone];
          return (
            <div className={`rounded-2xl border ${classes.border} ${classes.soft} p-3`} key={trait.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${classes.text}`}>{trait.label}</div>
                  <div className="mt-1 font-mono text-lg font-black text-slate-50">{trait.metric}</div>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">{trait.status}</span>
              </div>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{trait.detail}</p>
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">{trait.evidenceSource}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RelationshipEngine({
  relationships,
  symbol,
  unavailable,
}: {
  relationships: SymbolKnowledgeRelationship[];
  symbol: string;
  unavailable: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
          <GitBranch className="h-4 w-4" />
          Relationship engine
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-bold text-slate-400">{relationships.length} links</span>
      </div>
      <div className="mt-4 grid gap-3">
        {relationships.length ? relationships.slice(0, 8).map((relationship) => <RelationshipRow key={relationship.id} relationship={relationship} />) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-500">
            {symbol} does not have enough source-backed relationship evidence yet.
          </div>
        )}
      </div>
      {unavailable.length ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Limited or hidden</div>
          <ul className="mt-2 grid gap-1.5 text-xs leading-5 text-slate-500">
            {unavailable.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function RelationshipRow({ relationship }: { relationship: SymbolKnowledgeRelationship }) {
  const classes = TONE[relationship.tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${classes.text}`}>{humanizeLabel(relationship.type)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-black text-slate-50">{relationship.target}</span>
            <span className="text-xs text-slate-500">{relationship.label}</span>
          </div>
        </div>
        {relationship.strength !== null ? <span className={`font-mono text-lg font-black ${classes.text}`}>{Math.round(relationship.strength)}</span> : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{relationship.evidence}</p>
      <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">{relationship.dataSource}</div>
    </>
  );

  if (relationship.href) {
    return <Link className={`block rounded-2xl border ${classes.border} ${classes.soft} p-3 transition hover:bg-white/[0.055]`} href={relationship.href}>{body}</Link>;
  }

  return <div className={`rounded-2xl border ${classes.border} ${classes.soft} p-3`}>{body}</div>;
}

function HistoricalAnalogPanel({ analogs }: { analogs: SymbolHistoricalAnalogMemory[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Historical analogs</div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-bold text-slate-400">{analogs.length} replay links</span>
      </div>
      <div className="mt-4 grid gap-3">
        {analogs.length ? analogs.slice(0, 5).map((analog) => <AnalogRow analog={analog} key={`${analog.symbol}:${analog.signalTimestamp}`} />) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-500">
            Historical analogs are limited until Market Memory returns comparable source-backed setups.
          </div>
        )}
      </div>
    </div>
  );
}

function AnalogRow({ analog }: { analog: SymbolHistoricalAnalogMemory }) {
  return (
    <Link className="block rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] p-3 transition hover:bg-emerald-300/[0.08]" href={analog.href}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm font-black text-slate-50">{analog.symbol}</div>
          <div className="mt-1 text-xs text-slate-500">{formatKnowledgeTimestamp(analog.signalTimestamp)} · {analog.setupType}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-black text-emerald-100">{Math.round(analog.similarityScore)}%</div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">similarity</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Success" value={formatKnowledgeRate(analog.successRate)} />
        <MiniStat label="Failure" value={formatKnowledgeRate(analog.failureRate)} />
        <MiniStat label="Samples" value={`${analog.sampleSize}`} />
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{analog.reasonLabels.join(", ") || analog.macroSimilarity}</p>
    </Link>
  );
}

function EventMemoryPanel({ events }: { events: SymbolEventMemory[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Event memory</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {events.length ? events.map((event) => {
          const classes = TONE[event.tone];
          return (
            <div className={`rounded-2xl border ${classes.border} ${classes.soft} p-3`} key={event.domain}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${classes.text}`}>{event.label}</div>
                  <div className="mt-1 font-mono text-lg font-black text-slate-50">{event.eventCount}</div>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">{event.status}</span>
              </div>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{event.detail}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {event.symbols.slice(0, 5).map((symbol) => <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 font-mono text-[10px] text-slate-300" key={symbol}>{symbol}</span>)}
              </div>
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">{event.source}</div>
            </div>
          );
        }) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-500 sm:col-span-2">
            No FOMC, CPI, earnings, geopolitical, crypto, or macro event memory is source-backed for this symbol yet.
          </div>
        )}
      </div>
    </div>
  );
}

function TimelinePanel({
  activeCategory,
  items,
  onCategoryChange,
  totalItems,
}: {
  activeCategory: KnowledgeTimelineCategory | "all";
  items: SymbolKnowledgeTimelineItem[];
  onCategoryChange: (category: KnowledgeTimelineCategory | "all") => void;
  totalItems: number;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
            <Clock3 className="h-4 w-4" />
            Market memory timeline
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">Interactive timeline for scanner signals, event markers, macro changes, volatility context, alerts, and replay memories when source data exists.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-bold text-slate-400">{items.length}/{totalItems} visible</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] transition ${
              activeCategory === filter.category
                ? "border-cyan-300/45 bg-cyan-300/12 text-cyan-100"
                : "border-white/10 bg-white/[0.025] text-slate-500 hover:border-cyan-300/30 hover:text-cyan-100"
            }`}
            key={filter.category}
            onClick={() => onCategoryChange(filter.category)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {items.length ? items.map((item) => <TimelineItem item={item} key={item.id} />) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-500 lg:col-span-2">
            No source-backed timeline entries exist for this filter.
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineItem({ item }: { item: SymbolKnowledgeTimelineItem }) {
  const classes = TONE[item.tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${classes.text}`}>{humanizeLabel(item.category)}</div>
          <div className="mt-1 text-sm font-black text-slate-50">{item.label}</div>
        </div>
        {item.metric ? <span className={`font-mono text-lg font-black ${classes.text}`}>{item.metric}</span> : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
        <span>{formatKnowledgeTimestamp(item.timestamp)}</span>
        <span>{item.source}</span>
      </div>
    </>
  );

  if (item.href) {
    return <Link className={`block rounded-2xl border ${classes.border} ${classes.soft} p-3 transition hover:bg-white/[0.055]`} href={item.href}>{body}</Link>;
  }
  return <div className={`rounded-2xl border ${classes.border} ${classes.soft} p-3`}>{body}</div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-1.5">
      <div className="font-mono text-sm font-black text-slate-100">{value}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
    </div>
  );
}
