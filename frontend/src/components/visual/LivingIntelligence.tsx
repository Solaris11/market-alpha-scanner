"use client";

import { motion } from "motion/react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Radio,
  Sparkles,
} from "lucide-react";

import { MiniSparkline, VisualMetricRail, type VisualTone } from "@/components/visual/MiniVisuals";
import { humanizeInsightText } from "@/lib/ui/labels";

export type LivingSignal = {
  id: string;
  label: string;
  summary: string;
  score?: number | null;
  tone?: VisualTone;
  updatedAt?: string | null;
  values?: Array<number | null | undefined>;
};

export type LivingStory = {
  id: string;
  title: string;
  summary: string;
  tone?: VisualTone;
  metric?: string;
  updatedAt?: string | null;
};

type EvolutionDirection = "improving" | "weakening" | "steady" | "limited";

type EvolutionState = {
  direction: EvolutionDirection;
  delta: number | null;
  lastValue: number | null;
};

const toneText: Record<VisualTone, string> = {
  amber: "text-amber-200",
  cyan: "text-cyan-100",
  emerald: "text-emerald-200",
  rose: "text-rose-200",
  violet: "text-violet-200",
};

const toneBorder: Record<VisualTone, string> = {
  amber: "border-amber-400/25 bg-amber-400/8",
  cyan: "border-cyan-400/25 bg-cyan-400/8",
  emerald: "border-emerald-400/25 bg-emerald-400/8",
  rose: "border-rose-400/25 bg-rose-400/8",
  violet: "border-violet-400/25 bg-violet-400/8",
};

const toneGlow: Record<VisualTone, string> = {
  amber: "shadow-[0_0_28px_rgba(251,191,36,0.14)]",
  cyan: "shadow-[0_0_28px_rgba(34,211,238,0.12)]",
  emerald: "shadow-[0_0_28px_rgba(52,211,153,0.14)]",
  rose: "shadow-[0_0_32px_rgba(244,63,94,0.15)]",
  violet: "shadow-[0_0_30px_rgba(168,85,247,0.14)]",
};

function finiteValues(values: Array<number | null | undefined> | undefined): number[] {
  if (!values) return [];
  return values.filter((value): value is number => Number.isFinite(value));
}

function getEvolution(values: Array<number | null | undefined> | undefined): EvolutionState {
  const finite = finiteValues(values);
  if (finite.length < 2) {
    return {
      direction: finite.length === 1 ? "steady" : "limited",
      delta: null,
      lastValue: finite.length === 1 ? finite[0] ?? null : null,
    };
  }

  const first = finite[0] ?? 0;
  const last = finite[finite.length - 1] ?? 0;
  const delta = Math.round(last - first);
  const direction: EvolutionDirection =
    Math.abs(delta) < 3 ? "steady" : delta > 0 ? "improving" : "weakening";

  return { direction, delta, lastValue: last };
}

function DirectionIcon({ direction }: { direction: EvolutionDirection }) {
  if (direction === "improving") return <ArrowUpRight className="h-4 w-4" />;
  if (direction === "weakening") return <ArrowDownRight className="h-4 w-4" />;
  if (direction === "steady") return <ArrowRight className="h-4 w-4" />;
  return <Clock3 className="h-4 w-4" />;
}

function directionLabel(direction: EvolutionDirection): string {
  if (direction === "improving") return "Improving";
  if (direction === "weakening") return "Weakening";
  if (direction === "steady") return "Stable";
  return "Limited history";
}

function shouldPulse(signal: LivingSignal, state: EvolutionState): boolean {
  if (state.delta !== null && Math.abs(state.delta) >= 8) return true;
  if (typeof signal.score === "number" && signal.score >= 75) return true;
  return Boolean(signal.updatedAt);
}

function compactTimestamp(value: string | null | undefined): string {
  if (!value) return "latest scan";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LivingIntelligenceStatusStrip({
  title = "Living Intelligence",
  summary = "Realtime-aware surfaces highlight only data-backed shifts in risk, confidence, freshness, and attention.",
  signals,
  stories = [],
  generatedAt,
}: {
  title?: string;
  summary?: string;
  signals: LivingSignal[];
  stories?: LivingStory[];
  generatedAt?: string | null;
}) {
  const visibleSignals = signals.slice(0, 6);

  if (!visibleSignals.length && !stories.length) {
    return (
      <div className="rounded-3xl border border-cyan-400/18 bg-slate-950/70 p-5 text-slate-300">
        <div className="flex items-center gap-3 text-cyan-200">
          <Radio className="h-5 w-5" />
          <p className="text-sm font-black uppercase tracking-[0.26em]">Living Intelligence</p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Limited evidence. The system is waiting for more validated scans before showing evolution signals.
        </p>
      </div>
    );
  }

  return (
    <section className="tv-living-intelligence rounded-[2rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.16),transparent_30%),linear-gradient(135deg,rgba(2,8,23,0.95),rgba(15,23,42,0.84))] p-4 shadow-[0_0_52px_rgba(14,165,233,0.12)] sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
              <span className="absolute inset-0 rounded-2xl tv-living-pulse" />
              <Activity className="relative h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.34em] text-cyan-200/90">
                Active Monitoring
              </p>
              <h3 className="text-xl font-black text-white">{title}</h3>
            </div>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">{summary}</p>
        </div>
        <div className="rounded-2xl border border-cyan-300/15 bg-slate-950/60 px-4 py-3 text-right">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-slate-500">
            Last intelligence pass
          </p>
          <p className="mt-1 text-sm font-bold text-cyan-100">{compactTimestamp(generatedAt)}</p>
        </div>
      </div>

      {visibleSignals.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleSignals.map((signal, index) => {
            const state = getEvolution(signal.values);
            const tone = signal.tone ?? "cyan";
            const score = typeof signal.score === "number" ? signal.score : state.lastValue;
            const pulse = shouldPulse(signal, state);

            return (
              <motion.article
                key={signal.id}
                className={`relative overflow-hidden rounded-3xl border p-4 ${toneBorder[tone]} ${toneGlow[tone]}`}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ delay: index * 0.035, duration: 0.35, ease: "easeOut" }}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-[0.72rem] font-black uppercase tracking-[0.24em] ${toneText[tone]}`}>
                      {signal.label}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-300">
                      {humanizeInsightText(signal.summary)}
                    </p>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[0.7rem] font-black uppercase tracking-[0.12em] ${toneBorder[tone]} ${pulse ? "tv-attention-pulse" : ""}`}
                  >
                    <DirectionIcon direction={state.direction} />
                    {directionLabel(state.direction)}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                  <div>
                    <MiniSparkline label={`${signal.label} evolution`} values={finiteValues(signal.values)} tone={tone} />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-slate-500">
                      Current
                    </p>
                    <p className="mt-1 text-2xl font-black text-white">
                      {typeof score === "number" ? Math.round(score) : "--"}
                    </p>
                    {state.delta !== null ? (
                      <p className={state.delta >= 0 ? "text-xs font-bold text-emerald-200" : "text-xs font-bold text-rose-200"}>
                        {state.delta >= 0 ? "+" : ""}
                        {state.delta} since first point
                      </p>
                    ) : (
                      <p className="text-xs font-bold text-slate-500">insufficient trend</p>
                    )}
                  </div>
                </div>
                {typeof score === "number" ? (
                  <div className="mt-3">
                    <VisualMetricRail metrics={[{ label: "Current", tone, value: score }]} />
                  </div>
                ) : null}
              </motion.article>
            );
          })}
        </div>
      ) : null}

      {stories.length ? (
        <NarrativeEvolutionPanel stories={stories} compact />
      ) : null}
    </section>
  );
}

export function NarrativeEvolutionPanel({
  stories,
  compact = false,
}: {
  stories: LivingStory[];
  compact?: boolean;
}) {
  if (!stories.length) return null;

  return (
    <div className={compact ? "mt-5" : "rounded-[2rem] border border-white/10 bg-slate-950/70 p-5"}>
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-300/10 text-violet-100">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-violet-200">
            Narrative Evolution
          </p>
          <p className="text-sm text-slate-400">What changed, what weakened, and what deserves attention.</p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {stories.slice(0, 6).map((story, index) => {
          const tone = story.tone ?? "violet";
          return (
            <motion.article
              key={story.id}
              className={`relative overflow-hidden rounded-3xl border p-4 ${toneBorder[tone]}`}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: index * 0.03, duration: 0.3, ease: "easeOut" }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-[0.72rem] font-black uppercase tracking-[0.2em] ${toneText[tone]}`}>
                    {story.title}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-300">
                    {humanizeInsightText(story.summary)}
                  </p>
                </div>
                {story.metric ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-black text-white">
                    {story.metric}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500">
                Updated {compactTimestamp(story.updatedAt)}
              </p>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
