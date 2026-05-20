"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, BellRing, BrainCircuit, GitBranch, RadioTower, Route, ShieldAlert, Sparkles, Waves } from "lucide-react";
import { motion } from "motion/react";
import {
  HeatDots,
  MiniCandleStrip,
  MiniSparkline,
  PosterGauge,
  ScoreFactorStrip,
  SignalFlowVisual,
  type ScoreFactor,
  type VisualTone,
} from "@/components/visual/MiniVisuals";
import type { LivingIntelligenceProofSystem, LivingProofSignal, LivingProofTone, LivingTelemetryContract } from "@/lib/trading/living-intelligence-proof";
import { humanizeInsightText } from "@/lib/ui/labels";

const toneClass: Record<LivingProofTone, { border: string; bg: string; glow: string; icon: string; text: string }> = {
  amber: { bg: "bg-amber-300/[0.065]", border: "border-amber-300/24", glow: "shadow-[0_0_34px_rgba(251,191,36,0.12)]", icon: "bg-amber-300/12 text-amber-100 ring-amber-200/20", text: "text-amber-100" },
  cyan: { bg: "bg-cyan-300/[0.065]", border: "border-cyan-300/24", glow: "shadow-[0_0_34px_rgba(34,211,238,0.13)]", icon: "bg-cyan-300/12 text-cyan-100 ring-cyan-200/20", text: "text-cyan-100" },
  emerald: { bg: "bg-emerald-300/[0.065]", border: "border-emerald-300/24", glow: "shadow-[0_0_34px_rgba(52,211,153,0.12)]", icon: "bg-emerald-300/12 text-emerald-100 ring-emerald-200/20", text: "text-emerald-100" },
  rose: { bg: "bg-rose-300/[0.065]", border: "border-rose-300/24", glow: "shadow-[0_0_38px_rgba(251,113,133,0.14)]", icon: "bg-rose-300/12 text-rose-100 ring-rose-200/20", text: "text-rose-100" },
  violet: { bg: "bg-violet-300/[0.065]", border: "border-violet-300/24", glow: "shadow-[0_0_34px_rgba(167,139,250,0.14)]", icon: "bg-violet-300/12 text-violet-100 ring-violet-200/20", text: "text-violet-100" },
};

const categoryLabels: Record<LivingProofSignal["category"], string> = {
  adaptive_prioritization: "Adaptive priority",
  confidence_evolution: "Confidence evolution",
  cross_system_cognition: "Cross-system cognition",
  dynamic_attention: "Dynamic attention",
  evolving_feed: "Evolving feed",
  memory_awareness: "Memory aware",
  narrative_evolution: "Narrative evolution",
  portfolio_warning: "Portfolio warnings",
  risk_evolution: "Risk evolution",
};

export function LivingIntelligenceProofPanel({ system }: { system: LivingIntelligenceProofSystem }) {
  const style = toneClass[system.stateTone];
  const factors: ScoreFactor[] = [
    factorFor("Feed", system.proofSignals.find((signal) => signal.category === "evolving_feed")),
    factorFor("Confidence", system.proofSignals.find((signal) => signal.category === "confidence_evolution")),
    factorFor("Risk", system.proofSignals.find((signal) => signal.category === "risk_evolution")),
    factorFor("Memory", system.proofSignals.find((signal) => signal.category === "memory_awareness")),
    factorFor("Portfolio", system.proofSignals.find((signal) => signal.category === "portfolio_warning")),
  ];

  return (
    <section className={`relative overflow-hidden rounded-[2.15rem] border ${style.border} bg-[radial-gradient(circle_at_8%_0%,rgba(34,211,238,0.19),transparent_31rem),radial-gradient(circle_at_96%_12%,rgba(251,113,133,0.12),transparent_30rem),radial-gradient(circle_at_64%_92%,rgba(167,139,250,0.13),transparent_27rem),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.88))] p-4 ${style.glow} sm:p-5`}>
      <div className="pointer-events-none absolute inset-0 tv-ecosystem-atmosphere" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />
      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.68fr)]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.28 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start gap-3">
            <span className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-[1.1rem] ring-1 ${style.icon}`}>
              <span className="absolute inset-0 rounded-[1.1rem] tv-ecosystem-pulse" />
              <BrainCircuit className="relative h-6 w-6" />
            </span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-200">Living intelligence proof</div>
              <h2 className="mt-1 max-w-4xl text-2xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">{system.headline}</h2>
            </div>
          </div>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">{humanizeInsightText(system.summary)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full border ${style.border} ${style.bg} px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] ${style.text}`}>{system.stateLabel}</span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100">{formatTimestamp(system.generatedAt)}</span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/48 p-4">
              <PosterGauge label="living proof" score={system.proofScore} tone={system.stateTone} />
            </div>
            <div className="grid gap-3">
              <ScoreFactorStrip factors={factors} label="Proof categories" />
              <SignalFlowVisual
                items={[
                  { icon: <RadioTower className="h-5 w-5" />, label: "Feed evolves", tone: "violet" },
                  { icon: <Activity className="h-5 w-5" />, label: "Risk changes", tone: "rose" },
                  { icon: <GitBranch className="h-5 w-5" />, label: "Systems connect", tone: "cyan" },
                ]}
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          className="rounded-[1.7rem] border border-cyan-300/18 bg-cyan-400/[0.045] p-4"
          initial={{ opacity: 0, y: 18 }}
          transition={{ delay: 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.28 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <Header icon={<Waves className="h-4 w-4" />} label="Attention shifts" tone="cyan" />
          <div className="mt-3 grid gap-2">
            {system.attentionShifts.slice(0, 4).map((signal) => <ProofCard key={signal.id} signal={signal} />)}
          </div>
        </motion.div>
      </div>

      <div className="relative mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="rounded-[1.7rem] border border-violet-300/16 bg-violet-400/[0.035] p-4">
          <Header icon={<Sparkles className="h-4 w-4" />} label="Proof signals" tone="violet" />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {system.proofSignals.slice(0, 8).map((signal) => <ProofCard key={signal.id} signal={signal} />)}
          </div>
        </section>

        <section className="rounded-[1.7rem] border border-emerald-300/16 bg-emerald-400/[0.035] p-4">
          <Header icon={<Route className="h-4 w-4" />} label="Evolution timeline" tone="emerald" />
          <div className="mt-3 grid gap-2">
            {system.timeline.length ? system.timeline.map((signal) => <TimelineRow key={signal.id} signal={signal} />) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-xs leading-5 text-slate-500">Timeline proof is waiting for validated feed, memory, workflow, or risk changes.</div>
            )}
          </div>
        </section>
      </div>

      <div className="relative mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.48fr)]">
        <TelemetryContractPanel items={system.telemetryContract} />
        <section className="rounded-[1.7rem] border border-amber-300/16 bg-amber-400/[0.035] p-4">
          <Header icon={<ShieldAlert className="h-4 w-4" />} label="Trust boundary" tone="amber" />
          <p className="mt-3 text-xs leading-5 text-slate-400">{system.guardrail}</p>
        </section>
      </div>
    </section>
  );
}

function ProofCard({ signal }: { signal: LivingProofSignal }) {
  const style = toneClass[signal.tone];
  const body = (
    <article className={`rounded-3xl border ${style.border} ${style.bg} p-3 transition hover:-translate-y-0.5 hover:bg-white/[0.045]`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${style.text}`}>{categoryLabels[signal.category]}</div>
          <h3 className="mt-1 text-sm font-black text-slate-50">{signal.title}</h3>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ring-1 ${style.icon}`}>
          <Sparkles className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-slate-400">{humanizeInsightText(signal.detail)}</p>
      {signal.symbols.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {signal.symbols.slice(0, 5).map((symbol) => <span className="rounded-full border border-white/10 bg-slate-950/50 px-2 py-1 font-mono text-[10px] font-black text-slate-200" key={symbol}>{symbol}</span>)}
        </div>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_4.25rem]">
        <MiniSparkline label={signal.title} tone={signal.tone} values={signal.values} />
        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-2 text-center">
          <div className={`font-mono text-base font-black ${style.text}`}>{signal.score === null ? "Limited" : Math.round(signal.score)}</div>
          <div className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">proof</div>
        </div>
      </div>
    </article>
  );
  return signal.href ? <Link href={signal.href}>{body}</Link> : body;
}

function TimelineRow({ signal }: { signal: LivingProofSignal }) {
  const style = toneClass[signal.tone];
  return (
    <LinkOrDiv href={signal.href}>
      <div className={`rounded-2xl border ${style.border} bg-slate-950/42 p-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${style.text}`}>{signal.evidenceLabel}</div>
            <div className="mt-1 text-sm font-black text-slate-50">{signal.title}</div>
          </div>
          <HeatDots active={signal.score === null ? 2 : Math.max(1, Math.round(signal.score / 10))} tone={signal.tone} />
        </div>
        <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-400">{humanizeInsightText(signal.detail)}</p>
        <MiniCandleStrip className="mt-3" tone={signal.tone} values={signal.values} />
      </div>
    </LinkOrDiv>
  );
}

function TelemetryContractPanel({ items }: { items: LivingTelemetryContract[] }) {
  return (
    <section className="rounded-[1.7rem] border border-cyan-300/16 bg-cyan-400/[0.035] p-4">
      <Header icon={<BellRing className="h-4 w-4" />} label="Behavior telemetry contract" tone="cyan" />
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div className="rounded-2xl border border-white/10 bg-slate-950/42 p-3" key={item.eventName}>
            <div className="font-mono text-[10px] font-black uppercase tracking-[0.13em] text-cyan-200">{item.eventName}</div>
            <div className="mt-1 text-sm font-black text-slate-50">{item.label}</div>
            <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-slate-500">{item.purpose}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Header({ icon, label, tone }: { icon: ReactNode; label: string; tone: VisualTone }) {
  return (
    <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${toneClass[tone].text}`}>
      {icon}
      {label}
    </div>
  );
}

function LinkOrDiv({ children, href }: { children: ReactNode; href?: string }) {
  return href ? <Link href={href}>{children}</Link> : <div>{children}</div>;
}

function factorFor(label: string, signal: LivingProofSignal | undefined): ScoreFactor {
  return {
    detail: signal?.detail,
    label,
    tone: signal?.tone ?? "cyan",
    value: signal?.score,
  };
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", month: "short", day: "2-digit" }).format(date);
}
