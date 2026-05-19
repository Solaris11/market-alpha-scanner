"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  BellRing,
  BrainCircuit,
  CalendarClock,
  GitBranch,
  Network,
  Orbit,
  RadioTower,
  Route,
  ShieldAlert,
  Sparkles,
  Waves,
} from "lucide-react";
import { motion } from "motion/react";
import {
  HeatDots,
  MiniCandleStrip,
  MiniSparkline,
  PosterGauge,
  ScoreFactorStrip,
  SignalFlowVisual,
  VisualMetricRail,
  type ScoreFactor,
  type VisualTone,
} from "@/components/visual/MiniVisuals";
import type {
  CrossSymbolCognition,
  EcosystemBriefItem,
  EcosystemMonitor,
  IntelligenceEcosystemSystem,
  MarketWorldSignal,
  NotificationIntelligenceSignal,
  PortfolioEcosystemSignal,
} from "@/lib/trading/intelligence-ecosystem";
import { humanizeInsightText } from "@/lib/ui/labels";

const toneClass: Record<VisualTone, { border: string; glow: string; icon: string; soft: string; text: string }> = {
  amber: {
    border: "border-amber-300/25",
    glow: "shadow-[0_0_34px_rgba(251,191,36,0.13)]",
    icon: "bg-amber-300/12 text-amber-100 ring-amber-200/20",
    soft: "bg-amber-300/10",
    text: "text-amber-100",
  },
  cyan: {
    border: "border-cyan-300/25",
    glow: "shadow-[0_0_36px_rgba(34,211,238,0.14)]",
    icon: "bg-cyan-300/12 text-cyan-100 ring-cyan-200/20",
    soft: "bg-cyan-300/10",
    text: "text-cyan-100",
  },
  emerald: {
    border: "border-emerald-300/25",
    glow: "shadow-[0_0_34px_rgba(52,211,153,0.13)]",
    icon: "bg-emerald-300/12 text-emerald-100 ring-emerald-200/20",
    soft: "bg-emerald-300/10",
    text: "text-emerald-100",
  },
  rose: {
    border: "border-rose-300/25",
    glow: "shadow-[0_0_38px_rgba(251,113,133,0.14)]",
    icon: "bg-rose-300/12 text-rose-100 ring-rose-200/20",
    soft: "bg-rose-300/10",
    text: "text-rose-100",
  },
  violet: {
    border: "border-violet-300/25",
    glow: "shadow-[0_0_36px_rgba(167,139,250,0.14)]",
    icon: "bg-violet-300/12 text-violet-100 ring-violet-200/20",
    soft: "bg-violet-300/10",
    text: "text-violet-100",
  },
};

export function IntelligenceEcosystemPanel({
  compact = false,
  system,
}: {
  compact?: boolean;
  system: IntelligenceEcosystemSystem;
}) {
  const stateStyle = toneClass[system.ecosystemTone];
  const factors: ScoreFactor[] = [
    { detail: system.summary, label: "Attention", tone: system.ecosystemTone, value: system.attentionScore },
    { detail: system.activeMonitors[0]?.detail ?? "Monitor evidence is limited.", label: "Monitoring", tone: system.activeMonitors[0]?.tone ?? "cyan", value: system.activeMonitors[0]?.intensity ?? null },
    { detail: system.crossSymbolCognition[0]?.detail ?? "Cross-symbol context is limited.", label: "Relationships", tone: system.crossSymbolCognition[0]?.tone ?? "violet", value: system.crossSymbolCognition[0]?.score ?? null },
    { detail: system.portfolioAwareness[0]?.detail ?? "Portfolio awareness is limited.", label: "Exposure", tone: system.portfolioAwareness[0]?.tone ?? "amber", value: system.portfolioAwareness[0]?.score ?? null },
  ];

  return (
    <section
      className={`tv-ecosystem-panel relative overflow-hidden rounded-[2.15rem] border ${stateStyle.border} bg-[radial-gradient(circle_at_7%_4%,rgba(34,211,238,0.18),transparent_29rem),radial-gradient(circle_at_82%_0%,rgba(16,185,129,0.13),transparent_27rem),radial-gradient(circle_at_70%_86%,rgba(167,139,250,0.12),transparent_24rem),linear-gradient(135deg,rgba(2,8,23,0.98),rgba(15,23,42,0.84))] p-4 ${stateStyle.glow} sm:p-5`}
    >
      <div className="pointer-events-none absolute inset-0 tv-ecosystem-atmosphere" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(310px,0.52fr)_minmax(350px,0.72fr)]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.32 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start gap-3">
            <span className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-[1.1rem] ring-1 ${stateStyle.icon}`}>
              <span className="absolute inset-0 rounded-[1.1rem] tv-ecosystem-pulse" />
              <Orbit className="relative h-6 w-6" />
            </span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-200">Daily intelligence ecosystem</div>
              <h2 className="mt-1 max-w-4xl text-2xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">{system.headline}</h2>
            </div>
          </div>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">{humanizeInsightText(system.summary)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full border ${stateStyle.border} ${stateStyle.soft} px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] ${stateStyle.text}`}>
              {humanizeInsightText(system.ecosystemLabel)}
            </span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100">
              {formatTimestamp(system.generatedAt)}
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/48 p-4">
              <PosterGauge label="ecosystem attention" score={system.attentionScore} tone={system.ecosystemTone} />
            </div>
            <div className="grid gap-3">
              <ScoreFactorStrip factors={factors} label="Ecosystem drivers" />
              <VisualMetricRail metrics={factors.map((factor) => ({ label: factor.label, tone: factor.tone, value: factor.value ?? null }))} />
            </div>
          </div>

          <div className="mt-4">
            <SignalFlowVisual
              items={[
                { icon: <CalendarClock className="h-5 w-5" />, label: "Morning brief", tone: system.ecosystemTone },
                { icon: <RadioTower className="h-5 w-5" />, label: "Active monitoring", tone: "cyan" },
                { icon: <GitBranch className="h-5 w-5" />, label: "Cross-symbol cognition", tone: "violet" },
              ]}
            />
          </div>
        </motion.div>

        <motion.div
          className="rounded-[1.7rem] border border-cyan-300/18 bg-cyan-400/[0.045] p-4"
          initial={{ opacity: 0, y: 18 }}
          transition={{ delay: 0.04, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.32 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <Header icon={<CalendarClock className="h-4 w-4" />} label="Morning command center" tone="cyan" />
          <div className="mt-3 grid gap-2">
            {system.morningBrief.slice(0, compact ? 3 : 5).map((item) => (
              <BriefCard item={item} key={item.id} />
            ))}
          </div>
        </motion.div>

        <motion.div
          className="rounded-[1.7rem] border border-violet-300/18 bg-violet-400/[0.045] p-4"
          initial={{ opacity: 0, y: 18 }}
          transition={{ delay: 0.08, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.32 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <Header icon={<Waves className="h-4 w-4" />} label="Since last visit" tone="violet" />
          <div className="mt-3 grid gap-2">
            {system.sinceLastVisit.slice(0, compact ? 3 : 5).map((item) => (
              <BriefCard item={item} key={item.id} />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="relative mt-4 grid gap-4 2xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <section className="rounded-[1.7rem] border border-rose-300/16 bg-rose-400/[0.035] p-4">
          <Header icon={<RadioTower className="h-4 w-4" />} label="Active monitoring engine" tone="rose" />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {system.activeMonitors.slice(0, compact ? 4 : 5).map((monitor) => (
              <MonitorCard key={monitor.id} monitor={monitor} />
            ))}
          </div>
        </section>

        <section className="rounded-[1.7rem] border border-emerald-300/16 bg-emerald-400/[0.035] p-4">
          <Header icon={<Network className="h-4 w-4" />} label="Market world model" tone="emerald" />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {system.marketWorld.map((signal) => (
              <WorldSignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        </section>
      </div>

      <div className="relative mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(300px,0.72fr)]">
        <CognitionPanel items={system.crossSymbolCognition} />
        <FeedEvolutionPanel items={system.feedEvolution} />
        <div className="grid gap-4">
          <PortfolioPanel items={system.portfolioAwareness} />
          <NotificationPanel items={system.notificationIntelligence} />
        </div>
      </div>

      <details className="relative mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Ecosystem grounding boundary</summary>
        <p className="mt-2 text-xs leading-5 text-slate-400">{system.guardrail}</p>
      </details>
    </section>
  );
}

function BriefCard({ item }: { item: EcosystemBriefItem }) {
  const content = (
    <motion.article
      className={`group rounded-2xl border ${toneClass[item.tone].border} bg-slate-950/42 p-3 transition hover:-translate-y-0.5 hover:bg-white/[0.04]`}
      data-stable-overlay-trigger="true"
      whileTap={{ scale: 0.992 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${toneClass[item.tone].text}`}>{item.evidenceLabel}</div>
          <h3 className="mt-1 text-sm font-black text-slate-50">{item.title}</h3>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ring-1 ${toneClass[item.tone].icon}`}>
          <Sparkles className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-slate-400">{humanizeInsightText(item.detail)}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem]">
        <MiniSparkline label={item.title} tone={item.tone} values={item.values} />
        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-2 text-center">
          <div className={`font-mono text-base font-black ${toneClass[item.tone].text}`}>{item.score === null ? "Limited" : Math.round(item.score)}</div>
          <div className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">signal</div>
        </div>
      </div>
    </motion.article>
  );
  return item.href ? <Link href={item.href}>{content}</Link> : content;
}

function MonitorCard({ monitor }: { monitor: EcosystemMonitor }) {
  return (
    <article className={`rounded-3xl border ${toneClass[monitor.tone].border} bg-slate-950/42 p-3 ${toneClass[monitor.tone].glow}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${toneClass[monitor.tone].text}`}>{monitor.sourceLabel}</div>
          <h3 className="mt-1 text-sm font-black text-slate-50">{monitor.title}</h3>
        </div>
        <div className="w-20">
          <HeatDots active={monitor.intensity === null ? 2 : Math.max(1, Math.round(monitor.intensity / 10))} tone={monitor.tone} />
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-slate-400">{humanizeInsightText(monitor.detail)}</p>
      <MiniCandleStrip className="mt-3" tone={monitor.tone} values={monitor.values} />
    </article>
  );
}

function WorldSignalCard({ signal }: { signal: MarketWorldSignal }) {
  return (
    <article className={`rounded-3xl border ${toneClass[signal.tone].border} bg-slate-950/42 p-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${toneClass[signal.tone].text}`}>{signal.metric}</div>
          <h3 className="mt-1 text-sm font-black text-slate-50">{signal.title}</h3>
        </div>
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ring-1 ${toneClass[signal.tone].icon}`}>
          <BrainCircuit className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-slate-400">{humanizeInsightText(signal.detail)}</p>
      <MiniSparkline className="mt-3" label={signal.title} tone={signal.tone} values={signal.values} />
    </article>
  );
}

function CognitionPanel({ items }: { items: CrossSymbolCognition[] }) {
  return (
    <section className="rounded-[1.7rem] border border-cyan-300/16 bg-cyan-400/[0.035] p-4">
      <Header icon={<GitBranch className="h-4 w-4" />} label="Cross-symbol cognition" tone="cyan" />
      <div className="mt-3 grid gap-2">
        {items.map((item) => {
          const content = (
            <article className={`rounded-2xl border ${toneClass[item.tone].border} bg-slate-950/42 p-3 transition hover:bg-white/[0.04]`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-50">{item.title}</h3>
                  <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-slate-400">{humanizeInsightText(item.detail)}</p>
                </div>
                <div className={`font-mono text-sm font-black ${toneClass[item.tone].text}`}>{item.score === null ? "Limited" : item.score}</div>
              </div>
              {item.symbols.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.symbols.map((symbol) => (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[10px] font-black text-slate-200" key={symbol}>{symbol}</span>
                  ))}
                </div>
              ) : null}
            </article>
          );
          return item.href ? <Link href={item.href} key={item.id}>{content}</Link> : <div key={item.id}>{content}</div>;
        })}
      </div>
    </section>
  );
}

function FeedEvolutionPanel({ items }: { items: EcosystemBriefItem[] }) {
  return (
    <section className="rounded-[1.7rem] border border-violet-300/16 bg-violet-400/[0.035] p-4">
      <Header icon={<Route className="h-4 w-4" />} label="Living feed evolution" tone="violet" />
      <div className="mt-3 grid gap-2">
        {items.slice(0, 5).map((item) => (
          <BriefCard item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}

function PortfolioPanel({ items }: { items: PortfolioEcosystemSignal[] }) {
  return (
    <section className="rounded-[1.7rem] border border-amber-300/16 bg-amber-400/[0.035] p-4">
      <Header icon={<ShieldAlert className="h-4 w-4" />} label="Portfolio-aware intelligence" tone="amber" />
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <article className={`rounded-2xl border ${toneClass[item.tone].border} bg-slate-950/42 p-3`} key={item.id}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-50">{item.title}</h3>
              <span className={`font-mono text-sm font-black ${toneClass[item.tone].text}`}>{item.score === null ? "Limited" : Math.round(item.score)}</span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">{humanizeInsightText(item.detail)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function NotificationPanel({ items }: { items: NotificationIntelligenceSignal[] }) {
  return (
    <section className="rounded-[1.7rem] border border-emerald-300/16 bg-emerald-400/[0.035] p-4">
      <Header icon={<BellRing className="h-4 w-4" />} label="Contextual notifications" tone="emerald" />
      <div className="mt-3 grid gap-2">
        {items.slice(0, 4).map((item) => {
          const content = (
            <article className={`rounded-2xl border ${toneClass[item.tone].border} bg-slate-950/42 p-3 transition hover:bg-white/[0.04]`}>
              <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${toneClass[item.tone].text}`}>{item.sourceLabel}</div>
              <h3 className="mt-1 text-sm font-black text-slate-50">{item.title}</h3>
              <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-slate-400">{humanizeInsightText(item.detail)}</p>
            </article>
          );
          return item.href ? <Link href={item.href} key={item.id}>{content}</Link> : <div key={item.id}>{content}</div>;
        })}
      </div>
    </section>
  );
}

function Header({ icon, label, tone }: { icon: ReactNode; label: string; tone: VisualTone }) {
  return (
    <div className={`flex items-center gap-2 ${toneClass[tone].text}`}>
      {icon}
      <div className="text-[10px] font-black uppercase tracking-[0.24em]">{label}</div>
    </div>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "latest scan";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
}
