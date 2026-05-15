"use client";

import { AlertTriangle, Brain, Clock3, HelpCircle, ShieldCheck } from "lucide-react";
import type { AIExplainabilityModel, ExplainabilityTone } from "@/lib/trading/ai-explainability";

export function AIExplainabilityCard({
  compact = false,
  model,
}: {
  compact?: boolean;
  model: AIExplainabilityModel;
}) {
  const contradictions = compact ? model.contradictions.slice(0, 2) : model.contradictions;
  const monitors = compact ? model.whatToMonitor.slice(0, 2) : model.whatToMonitor.slice(0, 4);
  return (
    <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.045] p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
            <Brain className="h-4 w-4" />
            Explainability
          </div>
          <h3 className="mt-1 text-sm font-black text-slate-50">Why this intelligence exists</h3>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">
          not prediction
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-300">{model.beginnerSummary}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {model.pillars.map((pillar) => (
          <div className={`rounded-xl border p-3 ${toneClass(pillar.tone)}`} key={pillar.label}>
            <div className="text-[10px] font-black uppercase tracking-[0.12em] opacity-80">{pillar.label}</div>
            <div className="mt-1 text-base font-black text-slate-50">{pillar.value}</div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-300/90">{pillar.detail}</div>
          </div>
        ))}
      </div>

      <div className={`mt-3 grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
            <ShieldCheck className="h-4 w-4" />
            What supports it
          </div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
            {model.score.increasedBy.slice(0, compact ? 2 : 4).map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">
            <HelpCircle className="h-4 w-4" />
            What weakens it
          </div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
            {model.score.weakenedBy.slice(0, compact ? 2 : 4).map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      </div>

      {contradictions.length ? (
        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.055] p-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            Contradictions to review
          </div>
          <div className="mt-2 grid gap-2">
            {contradictions.map((item) => (
              <div className="rounded-lg border border-white/10 bg-slate-950/35 p-2" key={item.title}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-black text-slate-100">{item.title}</div>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${severityClass(item.severity)}`}>{item.severity}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.045] p-3 text-xs leading-5 text-emerald-100">
          No major contradiction surfaced in the available scored packet.
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
            <Clock3 className="h-4 w-4" />
            Trust layer
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {model.trustBadges.map((badge) => (
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${toneClass(badge.tone)}`} key={badge.label} title={badge.detail}>
                {badge.label}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Monitor next</div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
            {monitors.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function toneClass(tone: ExplainabilityTone): string {
  if (tone === "constructive") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (tone === "risk") return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  if (tone === "caution") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  if (tone === "intelligence") return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function severityClass(severity: "high" | "medium" | "low"): string {
  if (severity === "high") return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  if (severity === "medium") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
}
