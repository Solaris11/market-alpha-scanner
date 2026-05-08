import type { ReactNode } from "react";
import {
  decayStageLabel,
  pressureTone,
  type ConvictionFragilityModel,
  type DecayStage,
  type DriftDirection,
  type FragilityTier,
  type PressureDirection,
  type ScoreLabel,
} from "@/lib/trading/conviction-fragility";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function ConvictionFragilityCard({ model }: { model: ConvictionFragilityModel }) {
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Structural Quality" title="Conviction vs Fragility" meta={model.structuralLabel} />
      <p className="mt-3 text-sm leading-6 text-slate-400">{model.summary}</p>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ScoreMetric metric={model.conviction} title="Conviction" />
        <ScoreMetric metric={model.fragility} title="Fragility" />
        <MetricCard label="Net Pressure" tone={scoreTone(model.netPressureScore)} value={`${model.netPressureScore}/100`} />
        <MetricCard label="Setup Decay" tone={decayTone(model.decay.stage)} value={decayStageLabel(model.decay.stage)} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <InsightPanel title="Confidence Drift">
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${driftPill(model.drift.direction)}`}>{model.drift.label}</div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{model.drift.explanation}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <MiniMetric label="Observations" value={String(model.drift.observationCount)} />
                <MiniMetric label="Delta" value={model.drift.delta === null ? "N/A" : `${model.drift.delta > 0 ? "+" : ""}${model.drift.delta.toFixed(1)}`} />
              </div>
            </InsightPanel>

            <InsightPanel title="Setup Decay">
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${decayPill(model.decay.stage)}`}>{model.decay.label}</div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{model.decay.explanation}</p>
            </InsightPanel>
          </div>

          <InsightPanel title="Invalidation Conditions">
            <div className="flex flex-wrap items-center gap-2">
              <div className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${fragilityPill(model.fragility.tier as FragilityTier)}`}>{model.invalidation.label}</div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-xs text-slate-300">
                Integrity {model.invalidation.structuralIntegrity}/100
              </div>
              {model.invalidation.proximityPct !== null ? (
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-xs text-slate-300">
                  {model.invalidation.proximityPct.toFixed(1)}% from invalidation context
                </div>
              ) : null}
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              {model.invalidation.conditions.map((condition) => <li key={condition}>- {condition}</li>)}
            </ul>
          </InsightPanel>

          <InsightPanel title="Historical Fragility Context">
            <ul className="space-y-2 text-sm leading-6 text-slate-300">
              {model.historicalFragility.lines.map((line) => <li key={line}>- {line}</li>)}
            </ul>
          </InsightPanel>
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Market Pressure Contributors</div>
            <div className="mt-3 space-y-3">
              {model.pressure.map((item) => (
                <div key={item.key}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-slate-100">{item.label}</span>
                    <span className={pressureText(item.direction)}>{pressureTone(item.direction)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className={`h-full rounded-full ${pressureBar(item.direction)}`} style={{ width: `${Math.max(4, Math.min(100, item.score))}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] leading-4 text-slate-500">{item.score}/100</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.08] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Decision Quality Read</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              This layer evaluates structure, durability, and vulnerability. It is historical and probabilistic context, not a trade instruction.
            </p>
          </div>
        </aside>
      </div>
    </GlassPanel>
  );
}

function ScoreMetric({ metric, title }: { metric: ScoreLabel; title: string }) {
  const tone = scoreMetricTone(metric.label.includes("Fragility") ? 100 - metric.score : metric.score);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <div className={`mt-2 font-mono text-3xl font-black ${tone.text}`}>{metric.score}</div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(4, Math.min(100, metric.score))}%` }} />
      </div>
      <div className="mt-2 text-xs font-semibold text-slate-300">{metric.label}</div>
    </div>
  );
}

function MetricCard({ label, tone, value }: { label: string; tone: "good" | "mixed" | "risk"; value: string }) {
  const color = tone === "good" ? "text-emerald-200" : tone === "risk" ? "text-rose-200" : "text-amber-100";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
}

function InsightPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 font-mono font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function scoreMetricTone(score: number): { bar: string; text: string } {
  if (score >= 70) return { bar: "bg-emerald-300", text: "text-emerald-100" };
  if (score >= 45) return { bar: "bg-amber-300", text: "text-amber-100" };
  return { bar: "bg-rose-300", text: "text-rose-100" };
}

function scoreTone(score: number): "good" | "mixed" | "risk" {
  if (score >= 65) return "good";
  if (score >= 45) return "mixed";
  return "risk";
}

function decayTone(stage: DecayStage): "good" | "mixed" | "risk" {
  if (stage === "fresh") return "good";
  if (stage === "maturing" || stage === "unknown") return "mixed";
  return "risk";
}

function driftPill(direction: DriftDirection): string {
  if (direction === "rising") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (direction === "weakening") return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  if (direction === "stable") return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function decayPill(stage: DecayStage): string {
  if (stage === "fresh") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (stage === "maturing") return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  if (stage === "extended") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  if (stage === "decaying") return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function fragilityPill(tier: FragilityTier): string {
  if (tier === "low") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (tier === "moderate") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  return "border-rose-300/25 bg-rose-400/10 text-rose-100";
}

function pressureText(direction: PressureDirection): string {
  if (direction === "tailwind") return "text-emerald-200";
  if (direction === "pressure") return "text-rose-200";
  return "text-amber-100";
}

function pressureBar(direction: PressureDirection): string {
  if (direction === "tailwind") return "bg-emerald-300";
  if (direction === "pressure") return "bg-rose-300";
  return "bg-amber-300";
}
