"use client";

import Link from "next/link";
import { Activity, Brain, Clock3, Eye, GitBranch, History, Radio, Sparkles, Waves } from "lucide-react";
import { motion } from "motion/react";
import {
  PosterGauge,
  ScoreFactorStrip,
  VisualMetricRail,
  MiniSparkline,
  type ScoreFactor,
  type VisualTone,
} from "@/components/visual/MiniVisuals";
import type {
  ConsciousnessAdaptiveSignal,
  ConsciousnessCrossSystemLink,
  ConsciousnessMemorySignal,
  ConsciousnessStory,
  ConsciousnessTimelineItem,
  IntelligenceConsciousnessSystem,
} from "@/lib/trading/intelligence-consciousness";
import { humanizeInsightText } from "@/lib/ui/labels";

const toneClass: Record<VisualTone, { border: string; glow: string; icon: string; soft: string; text: string }> = {
  amber: {
    border: "border-amber-300/25",
    glow: "shadow-[0_0_32px_rgba(251,191,36,0.12)]",
    icon: "bg-amber-300/12 text-amber-100 ring-amber-200/20",
    soft: "bg-amber-300/10",
    text: "text-amber-100",
  },
  cyan: {
    border: "border-cyan-300/25",
    glow: "shadow-[0_0_34px_rgba(34,211,238,0.13)]",
    icon: "bg-cyan-300/12 text-cyan-100 ring-cyan-200/20",
    soft: "bg-cyan-300/10",
    text: "text-cyan-100",
  },
  emerald: {
    border: "border-emerald-300/25",
    glow: "shadow-[0_0_32px_rgba(52,211,153,0.12)]",
    icon: "bg-emerald-300/12 text-emerald-100 ring-emerald-200/20",
    soft: "bg-emerald-300/10",
    text: "text-emerald-100",
  },
  rose: {
    border: "border-rose-300/25",
    glow: "shadow-[0_0_34px_rgba(251,113,133,0.12)]",
    icon: "bg-rose-300/12 text-rose-100 ring-rose-200/20",
    soft: "bg-rose-300/10",
    text: "text-rose-100",
  },
  violet: {
    border: "border-violet-300/25",
    glow: "shadow-[0_0_34px_rgba(167,139,250,0.13)]",
    icon: "bg-violet-300/12 text-violet-100 ring-violet-200/20",
    soft: "bg-violet-300/10",
    text: "text-violet-100",
  },
};

export function IntelligenceConsciousnessPanel({
  compact = false,
  system,
}: {
  compact?: boolean;
  system: IntelligenceConsciousnessSystem;
}) {
  const stateTone = system.stateTone;
  const stateStyle = toneClass[stateTone];
  const metricFactors: ScoreFactor[] = [
    { detail: system.summary, label: "Awareness", tone: stateTone, value: system.attentionScore },
    { detail: system.memorySignals[0]?.detail ?? "Memory context is still building.", label: "Memory", tone: "violet", value: system.memorySignals[0]?.similarityScore ?? null },
    { detail: system.predictiveAttention[0]?.detail ?? "Predictive attention is limited.", label: "Monitor", tone: system.predictiveAttention[0]?.tone ?? "cyan", value: system.predictiveAttention[0]?.score ?? null },
  ];

  return (
    <section className={`tv-consciousness-panel relative overflow-hidden rounded-[2rem] border ${stateStyle.border} bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,0.15),transparent_26rem),radial-gradient(circle_at_92%_12%,rgba(167,139,250,0.12),transparent_22rem),linear-gradient(135deg,rgba(2,8,23,0.96),rgba(15,23,42,0.78))] p-4 ${stateStyle.glow} sm:p-5`}>
      <div className="pointer-events-none absolute inset-0 tv-consciousness-field" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className={`relative grid items-start gap-4 ${compact ? "" : "xl:grid-cols-[minmax(0,1.15fr)_minmax(290px,0.45fr)_minmax(320px,0.72fr)]"}`}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.35 }}
        >
          <div className="flex items-center gap-3">
            <span className={`relative grid h-11 w-11 place-items-center rounded-2xl ring-1 ${stateStyle.icon}`}>
              <span className="absolute inset-0 rounded-2xl tv-consciousness-pulse" />
              <Brain className="relative h-6 w-6" />
            </span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-200">Intelligence consciousness</div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-4xl">{system.headline}</h2>
            </div>
          </div>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">{humanizeInsightText(system.summary)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full border ${stateStyle.border} ${stateStyle.soft} px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] ${stateStyle.text}`}>
              {humanizeInsightText(system.stateLabel)}
            </span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100">
              {formatTimestamp(system.generatedAt)}
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
              <PosterGauge label="awareness" score={system.attentionScore} tone={stateTone} />
            </div>
            <div className="grid gap-3">
              <ScoreFactorStrip factors={metricFactors} label="Consciousness drivers" />
              <VisualMetricRail metrics={metricFactors.map((factor) => ({ label: factor.label, tone: factor.tone, value: factor.value ?? null }))} />
            </div>
          </div>
        </motion.div>

        <motion.div
          className="rounded-[1.6rem] border border-violet-300/20 bg-violet-400/[0.055] p-4"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.35 }}
        >
          <div className="flex items-center gap-2 text-violet-100">
            <History className="h-4 w-4" />
            <div className="text-[10px] font-black uppercase tracking-[0.24em]">Memory-aware</div>
          </div>
          <div className="mt-3 grid gap-2">
            {system.memorySignals.length ? system.memorySignals.slice(0, compact ? 2 : 4).map((signal) => (
              <MemorySignalCard key={signal.id} signal={signal} />
            )) : (
              <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 p-3 text-xs leading-5 text-slate-500">
                Limited memory evidence. Analog and replay references appear only after validated history exists.
              </p>
            )}
          </div>
        </motion.div>

        <motion.div
          className="rounded-[1.6rem] border border-cyan-300/18 bg-cyan-400/[0.045] p-4"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.35 }}
        >
          <div className="flex items-center gap-2 text-cyan-100">
            <Radio className="h-4 w-4" />
            <div className="text-[10px] font-black uppercase tracking-[0.24em]">Narrative evolution</div>
          </div>
          <div className="mt-3 grid gap-2">
            {system.narrativeTimeline.slice(0, compact ? 3 : 5).map((item) => (
              <TimelineItem item={item} key={item.id} />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="relative mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(330px,0.76fr)]">
        <div className="grid gap-3 lg:grid-cols-2">
          {system.stories.slice(0, compact ? 2 : 4).map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
        <div className="grid gap-3">
          <AdaptivePanel signals={system.adaptiveSignals} />
          <CrossSystemLinks links={system.crossSystemLinks} />
        </div>
      </div>

      <div className="relative mt-4 grid gap-3 lg:grid-cols-2">
        {system.predictiveAttention.slice(0, 2).map((story) => (
          <StoryCard compact key={story.id} story={story} />
        ))}
      </div>

      <details className="relative mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Grounding boundary</summary>
        <p className="mt-2 text-xs leading-5 text-slate-400">{system.guardrail}</p>
      </details>
    </section>
  );
}

function StoryCard({ compact = false, story }: { compact?: boolean; story: ConsciousnessStory }) {
  const style = toneClass[story.tone];
  const content = (
    <motion.article
      className={`group h-full rounded-3xl border ${style.border} bg-slate-950/45 p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.04] ${style.glow}`}
      data-stable-overlay-trigger="true"
      whileTap={{ scale: 0.992 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${style.text}`}>{story.evidenceLabel}</div>
          <h3 className="mt-1 text-base font-black text-slate-50">{story.title}</h3>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ring-1 ${style.icon}`}>
          <Sparkles className="h-5 w-5" />
        </span>
      </div>
      <p className={`mt-3 ${compact ? "line-clamp-2" : "line-clamp-3"} text-xs leading-5 text-slate-400`}>{humanizeInsightText(story.detail)}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem]">
        <MiniSparkline label={story.title} tone={story.tone} values={story.values} />
        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-center">
          <div className={`font-mono text-lg font-black ${style.text}`}>{story.score === null ? "Limited" : Math.round(story.score)}</div>
          <div className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">signal</div>
        </div>
      </div>
    </motion.article>
  );

  if (!story.href) return content;
  return <Link href={story.href}>{content}</Link>;
}

function MemorySignalCard({ signal }: { signal: ConsciousnessMemorySignal }) {
  const style = toneClass[signal.tone];
  const content = (
    <article className={`rounded-2xl border ${style.border} bg-slate-950/40 p-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className={`truncate text-xs font-black ${style.text}`}>{signal.title}</div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{humanizeInsightText(signal.detail)}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-black text-slate-50">{signal.similarityScore ?? "Limited"}</div>
          <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">similar</div>
        </div>
      </div>
      <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{signal.evidenceLabel}</div>
    </article>
  );
  return signal.symbol ? <Link href={`/symbol/${signal.symbol}`}>{content}</Link> : content;
}

function TimelineItem({ item }: { item: ConsciousnessTimelineItem }) {
  const style = toneClass[item.tone];
  const content = (
    <article className={`rounded-2xl border ${style.border} bg-slate-950/38 p-3`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 ${style.icon}`}>
          <Clock3 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-black text-slate-100">{item.title}</div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{humanizeInsightText(item.detail)}</p>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.evidenceLabel}</div>
        </div>
      </div>
    </article>
  );
  return item.symbol ? <Link href={`/symbol/${item.symbol}`}>{content}</Link> : content;
}

function AdaptivePanel({ signals }: { signals: ConsciousnessAdaptiveSignal[] }) {
  return (
    <section className="rounded-3xl border border-emerald-300/18 bg-emerald-400/[0.045] p-4">
      <div className="flex items-center gap-2 text-emerald-100">
        <Eye className="h-4 w-4" />
        <div className="text-[10px] font-black uppercase tracking-[0.24em]">Adaptive attention</div>
      </div>
      <div className="mt-3 grid gap-2">
        {signals.slice(0, 4).map((signal) => {
          const style = toneClass[signal.tone];
          return (
            <div className={`rounded-2xl border ${style.border} bg-slate-950/38 p-3`} key={signal.id}>
              <div className={`text-xs font-black ${style.text}`}>{signal.title}</div>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">{humanizeInsightText(signal.detail)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CrossSystemLinks({ links }: { links: ConsciousnessCrossSystemLink[] }) {
  return (
    <section className="rounded-3xl border border-cyan-300/18 bg-cyan-400/[0.04] p-4">
      <div className="flex items-center gap-2 text-cyan-100">
        <GitBranch className="h-4 w-4" />
        <div className="text-[10px] font-black uppercase tracking-[0.24em]">Cross-system cognition</div>
      </div>
      <div className="mt-3 grid gap-2">
        {links.length ? links.map((link) => {
          const style = toneClass[link.tone];
          const content = (
            <article className={`rounded-2xl border ${style.border} bg-slate-950/38 p-3`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-100">
                  <span>{link.from}</span>
                  <Waves className={`h-3.5 w-3.5 ${style.text}`} />
                  <span>{link.to}</span>
                </div>
                <span className="font-mono text-xs font-black text-slate-300">{link.strength ?? "Linked"}</span>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">{humanizeInsightText(link.reason)}</p>
            </article>
          );
          return link.href ? <Link href={link.href} key={link.id}>{content}</Link> : <div key={link.id}>{content}</div>;
        }) : (
          <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 p-3 text-xs leading-5 text-slate-500">Cross-system links will appear when scanner, memory, workflow, and alert context overlap.</p>
        )}
      </div>
    </section>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "latest scan";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
}
