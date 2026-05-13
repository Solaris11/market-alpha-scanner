"use client";

import Link from "next/link";
import { ArrowRight, BrainCircuit, GitBranch, Info, Link2 } from "lucide-react";
import { VisualMetricRail, type VisualTone } from "@/components/visual/MiniVisuals";
import type { IntelligenceGraphModel, IntelligenceGraphRelationship, IntelligenceGraphTone } from "@/lib/trading/intelligence-graph";
import { humanizeInsightText } from "@/lib/ui/labels";

const TONE_CLASS: Record<IntelligenceGraphTone, { border: string; glow: string; icon: string; line: string; text: string }> = {
  amber: {
    border: "border-amber-300/25",
    glow: "shadow-[0_0_28px_rgba(251,191,36,0.08)]",
    icon: "bg-amber-300/10 text-amber-100",
    line: "from-amber-300/75 to-yellow-200/20",
    text: "text-amber-100",
  },
  cyan: {
    border: "border-cyan-300/25",
    glow: "shadow-[0_0_28px_rgba(34,211,238,0.08)]",
    icon: "bg-cyan-300/10 text-cyan-100",
    line: "from-cyan-300/75 to-sky-300/20",
    text: "text-cyan-100",
  },
  emerald: {
    border: "border-emerald-300/25",
    glow: "shadow-[0_0_28px_rgba(52,211,153,0.08)]",
    icon: "bg-emerald-300/10 text-emerald-100",
    line: "from-emerald-300/75 to-teal-200/20",
    text: "text-emerald-100",
  },
  rose: {
    border: "border-rose-300/25",
    glow: "shadow-[0_0_28px_rgba(251,113,133,0.08)]",
    icon: "bg-rose-300/10 text-rose-100",
    line: "from-rose-300/75 to-pink-300/20",
    text: "text-rose-100",
  },
  violet: {
    border: "border-violet-300/25",
    glow: "shadow-[0_0_28px_rgba(167,139,250,0.08)]",
    icon: "bg-violet-300/10 text-violet-100",
    line: "from-violet-300/75 to-fuchsia-300/20",
    text: "text-violet-100",
  },
};

export function IntelligenceGraphPanel({
  className = "",
  compact = false,
  graph,
}: {
  className?: string;
  compact?: boolean;
  graph: IntelligenceGraphModel;
}) {
  const relationships = graph.relationships.filter((relationship) => relationship.available);
  const metrics = relationships
    .filter((relationship) => typeof relationship.strength === "number" && Number.isFinite(relationship.strength))
    .slice(0, compact ? 3 : 5)
    .map((relationship) => ({
      label: relationship.label,
      tone: relationship.tone as VisualTone,
      value: relationship.strength,
    }));

  return (
    <section className={`overflow-hidden rounded-3xl border border-cyan-300/16 bg-slate-950/45 p-4 sm:p-5 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            <GitBranch className="h-4 w-4" />
            Context relationships
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{graph.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{humanizeInsightText(graph.summary)}</p>
        </div>
        {graph.lastUpdated ? (
          <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-400">
            Updated {graph.lastUpdated}
          </div>
        ) : null}
      </div>

      {relationships.length ? (
        <div className={`mt-5 grid gap-4 ${compact ? "" : "xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"}`}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="relative min-h-56 overflow-hidden rounded-2xl border border-cyan-300/12 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.13),transparent_45%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.86))] p-4">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.055)_1px,transparent_1px)] bg-[size:34px_34px]" aria-hidden="true" />
              <div className="relative grid min-h-48 place-items-center">
                <div className="grid h-28 w-28 place-items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-center shadow-[0_0_48px_rgba(34,211,238,0.15)]">
                  <BrainCircuit className="h-8 w-8 text-cyan-100" />
                  <div className="mt-1 max-w-20 truncate font-mono text-sm font-black text-slate-50">{graph.focus}</div>
                </div>
                <div className="absolute inset-0">
                  {relationships.slice(0, 7).map((relationship, index) => (
                    <GraphNode index={index} key={relationship.id} relationship={relationship} total={Math.min(7, relationships.length)} />
                  ))}
                </div>
              </div>
            </div>
            {metrics.length ? (
              <div className="mt-4">
                <VisualMetricRail metrics={metrics} />
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-3 text-xs leading-5 text-slate-500">Relationship strength is not scored yet. The map still shows validated links, but avoids fake precision.</p>
            )}
          </div>

          <div className="grid gap-3">
            {relationships.slice(0, compact ? 4 : 8).map((relationship) => (
              <RelationshipCard key={relationship.id} relationship={relationship} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            <div>
              <div className="text-sm font-semibold text-slate-200">Relationship data is still limited.</div>
              <p className="mt-1 text-sm leading-6 text-slate-500">TradeVeto will show this graph after sector, macro, proxy, event, shock, or replay data is validated for the current context.</p>
            </div>
          </div>
        </div>
      )}

      {graph.unavailable.length ? (
        <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Unavailable or limited relationships</summary>
          <ul className="mt-3 grid gap-2 text-xs leading-5 text-slate-500">
            {graph.unavailable.map((item) => (
              <li className="flex gap-2" key={item}>
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
                <span>{humanizeInsightText(item)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-4 text-xs leading-5 text-slate-500">Every visible relationship is derived from current scanner, macro, event, shock, or replay data. Research only. Not financial advice.</div>
    </section>
  );
}

function RelationshipCard({ relationship }: { relationship: IntelligenceGraphRelationship }) {
  const tone = TONE_CLASS[relationship.tone];
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${tone.text}`}>{relationship.label}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-black text-slate-50">{relationship.target}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{relationship.status}</span>
          </div>
        </div>
        {typeof relationship.strength === "number" ? <div className={`font-mono text-xl font-black ${tone.text}`}>{Math.round(relationship.strength)}</div> : null}
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{humanizeInsightText(relationship.summary)}</p>
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">{humanizeInsightText(relationship.evidence)}</p>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">{relationship.dataSource}</div>
    </>
  );

  if (relationship.targetHref) {
    return (
      <Link className={`group block rounded-2xl border bg-white/[0.03] p-4 transition hover:bg-white/[0.05] ${tone.border} ${tone.glow}`} href={relationship.targetHref}>
        {content}
        <div className={`mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] ${tone.text}`}>
          Open symbol
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </div>
      </Link>
    );
  }

  return <div className={`rounded-2xl border bg-white/[0.03] p-4 ${tone.border} ${tone.glow}`}>{content}</div>;
}

function GraphNode({
  index,
  relationship,
  total,
}: {
  index: number;
  relationship: IntelligenceGraphRelationship;
  total: number;
}) {
  const tone = TONE_CLASS[relationship.tone];
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const radius = 41;
  const left = 50 + Math.cos(angle) * radius;
  const top = 50 + Math.sin(angle) * radius;
  const node = (
    <span
      className={`absolute flex max-w-[7.75rem] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border bg-slate-950/90 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.09em] backdrop-blur ${tone.border} ${tone.text}`}
      style={{ left: `${left}%`, top: `${top}%` }}
      title={`${relationship.label}: ${relationship.summary}`}
    >
      <Link2 className="h-3 w-3 shrink-0" />
      <span className="truncate">{relationship.target}</span>
    </span>
  );

  return (
    <>
      <span
        aria-hidden="true"
        className={`absolute left-1/2 top-1/2 h-px origin-left bg-gradient-to-r ${tone.line}`}
        style={{
          transform: `rotate(${angle}rad)`,
          width: `${radius}%`,
        }}
      />
      {relationship.targetHref ? <Link href={relationship.targetHref}>{node}</Link> : node}
    </>
  );
}
