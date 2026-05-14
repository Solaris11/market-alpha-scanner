import Link from "next/link";
import { AlertTriangle, Brain, Clock3, GitBranch, Sparkles, ShieldAlert } from "lucide-react";
import type { AICognitionLayerModel, CognitionTone } from "@/lib/trading/ai-cognition-layer";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function AICognitionLayerPanel({
  compact = false,
  model,
}: {
  compact?: boolean;
  model: AICognitionLayerModel;
}) {
  const topTimeline = compact ? model.timeline.slice(0, 3) : model.timeline;
  const topContradictions = compact ? model.contradictions.slice(0, 3) : model.contradictions;
  const topDecay = compact ? model.confidenceDecay.slice(0, 3) : model.confidenceDecay.slice(0, 5);

  return (
    <GlassPanel className="overflow-hidden p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionTitle eyebrow="AI Cognition Layer" title="Thinking Timeline" meta={postureLabel(model.posture)} />
        <div className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
          grounded packet
        </div>
      </div>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{model.overview}</p>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            <GitBranch className="h-4 w-4" />
            Reasoning Timeline
          </div>
          <div className="mt-4 space-y-3">
            {topTimeline.map((item, index) => (
              <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-[34px_minmax(0,1fr)]" key={item.id}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black ${toneClass(item.tone)}`}>{index + 1}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-black text-slate-50">{item.title}</div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{item.deltaLabel}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                  {item.symbols.length ? <SymbolLinks className="mt-2" symbols={item.symbols} /> : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
              <Clock3 className="h-4 w-4" />
              Confidence Decay
            </div>
            <div className="mt-3 space-y-2">
              {topDecay.map((item) => (
                <Link className="block rounded-xl border border-white/10 bg-slate-950/40 p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.055]" href={`/symbol/${item.symbol}`} key={item.symbol}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm font-black text-slate-50">{item.symbol}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{item.freshnessLabel}</div>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${toneClass(item.tone)}`}>{item.status.replace("_", " ")}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
                </Link>
              ))}
            </div>
          </div>

          <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-slate-100">
              Grounding Packet
              <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">open</span>
            </summary>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
              {model.groundingPacket.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          </details>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-rose-300/15 bg-rose-500/[0.045] p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-rose-200">
            <ShieldAlert className="h-4 w-4" />
            Contradictions
          </div>
          <div className="mt-3 grid gap-2">
            {topContradictions.length ? topContradictions.map((item) => (
              <Link className="rounded-xl border border-white/10 bg-slate-950/35 p-3 transition hover:border-rose-200/35 hover:bg-white/[0.055]" href={`/symbol/${item.symbol}`} key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-sm font-black text-slate-50">{item.symbol}</div>
                  <span className="rounded-full border border-rose-200/20 bg-rose-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-rose-100">{item.severity}</span>
                </div>
                <div className="mt-1 text-sm font-bold text-slate-100">{item.title}</div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
              </Link>
            )) : (
              <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-400">No major contradictions surfaced in the current deterministic packet.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.035] p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
            <Brain className="h-4 w-4" />
            Narrative Evolution
          </div>
          <div className="mt-3 space-y-2">
            {model.narrativeEvolution.map((item) => (
              <details className="rounded-xl border border-white/10 bg-slate-950/35 p-3" key={item.id}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="text-sm font-black text-slate-50">{item.title}</span>
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${toneClass(item.tone)}`}>why</span>
                </summary>
                <p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p>
                {item.symbols.length ? <SymbolLinks className="mt-2" symbols={item.symbols} /> : null}
                <ul className="mt-2 space-y-1 text-[11px] leading-4 text-slate-500">
                  {item.evidence.slice(0, 3).map((evidence) => <li key={evidence}>- {evidence}</li>)}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-violet-200">
          <Sparkles className="h-4 w-4" />
          Copilot Can Explain
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {model.copilotGroundingPrompts.map((prompt) => (
            <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-xs font-semibold text-violet-100" key={prompt}>{prompt}</span>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

function SymbolLinks({ className = "", symbols }: { className?: string; symbols: string[] }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {symbols.map((symbol) => (
        <Link className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 font-mono text-[11px] font-black text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-300/15" href={`/symbol/${symbol}`} key={symbol}>
          {symbol}
        </Link>
      ))}
    </div>
  );
}

function toneClass(tone: CognitionTone): string {
  if (tone === "constructive") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (tone === "risk") return "border-rose-300/25 bg-rose-300/10 text-rose-100";
  if (tone === "caution") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  if (tone === "intelligence") return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function postureLabel(posture: AICognitionLayerModel["posture"]): string {
  if (posture === "becoming_more_cautious") return "more cautious";
  if (posture === "becoming_more_constructive") return "more constructive";
  if (posture === "mixed") return "mixed view";
  return "baseline";
}
