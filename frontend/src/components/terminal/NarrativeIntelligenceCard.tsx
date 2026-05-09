"use client";

import type { NarrativeIntelligence } from "@/lib/trading/narrative-intelligence";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function NarrativeIntelligenceCard({ narrative }: { narrative: NarrativeIntelligence | null }) {
  if (!narrative) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Narrative Intelligence" title="Market Narrative Building" meta="cached reasoning" />
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Narrative reasoning will appear after the bounded narrative refresh runs for this symbol. Deterministic scores remain available.
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle eyebrow="Narrative Intelligence" title="Market Narrative" meta={narrative.source === "llm" ? "LLM validated cache" : "deterministic cache"} />
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
          {narrative.narrativeDrift.label.replace("_", " ")}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{narrative.narrativeSummary}</p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <NarrativeBlock title="Bull Thesis" tone="support" text={narrative.bullishNarrative} />
        <NarrativeBlock title="Bear Thesis" tone="risk" text={narrative.bearishNarrative} />
        <NarrativeBlock title="Moderator" text={narrative.moderatorSummary} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.055] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Decision Reasoning</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{narrative.decisionReasoning}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{narrative.conditionalOpportunity}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">What To Watch</div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
            {narrative.whatToWatch.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CompactReason title="Macro Story" text={narrative.macroNarrative} />
        <CompactReason title="Sector Story" text={narrative.sectorNarrative} />
        <CompactReason title="Risk Story" text={narrative.riskNarrative} />
        <CompactReason title="Break Condition" text={narrative.whatCouldBreak} />
      </div>
      <div className="mt-3 text-[11px] leading-5 text-slate-500">{narrative.riskLanguage}</div>
    </GlassPanel>
  );
}

function NarrativeBlock({ text, title, tone = "neutral" }: { text: string; title: string; tone?: "neutral" | "risk" | "support" }) {
  const titleClass = tone === "support" ? "text-emerald-200" : tone === "risk" ? "text-rose-200" : "text-cyan-200";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${titleClass}`}>{title}</div>
      <p className="mt-2 text-xs leading-5 text-slate-300">{text}</p>
    </div>
  );
}

function CompactReason({ text, title }: { text: string; title: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-300">{text}</p>
    </div>
  );
}
