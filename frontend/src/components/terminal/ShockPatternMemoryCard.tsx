import type { ShockMovePattern } from "@/lib/trading/shock-move";
import { formatNumber } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function ShockPatternMemoryCard({ pattern }: { pattern: ShockMovePattern | null }) {
  if (!pattern) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Shock Pattern Memory" title="High-Volatility Context" meta="building" />
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Shock pattern memory is not available for this symbol yet. TradeVeto will show this once the bounded historical refresh has enough price history.
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle eyebrow="Shock Pattern Memory" title={pattern.opportunityState} meta={`${pattern.lookbackWindow} lookback`} />
        <div className="rounded-full border border-amber-300/25 bg-amber-400/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
          Speculative research
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Opportunity" value={formatNumber(pattern.opportunityScore, 0)} />
        <Metric label="Asymmetry" value={formatNumber(pattern.asymmetryScore, 0)} />
        <Metric label="Upside Shock" value={formatNumber(pattern.upsideShockScore, 0)} />
        <Metric label="Downside Risk" value={formatNumber(pattern.downsideRiskScore, 0)} tone={pattern.downsideRiskScore >= 70 ? "risk" : "neutral"} />
        <Metric label="Similarity" value={formatNumber(pattern.currentSimilarityScore, 0)} />
        <Metric label="Reliability" value={formatNumber(pattern.reliabilityScore, 0)} />
        <Metric label="Upside Events" value={pattern.upsideShockCount.toLocaleString()} />
        <Metric label="Downside Events" value={pattern.downsideShockCount.toLocaleString()} tone={pattern.downsideShockCount > pattern.upsideShockCount ? "risk" : "neutral"} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Zone label="Research entry zone" value={pattern.researchEntryZone} />
        <Zone label="Do-not-chase zone" value={pattern.doNotChaseZone} tone="risk" />
        <Zone label="Historical exit zone" value={pattern.historicalExitZone} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <NarrativeList items={pattern.commonPreconditions} title="Common pre-shock conditions" />
        <NarrativeList items={pattern.commonFailureConditions} title="Common failure conditions" />
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Shock memory is probabilistic historical context, not a core buy signal or financial advice. LLM summaries may explain this packet, but these numeric values come from the statistical engine.
      </p>
    </GlassPanel>
  );
}

function Metric({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "risk"; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="min-w-0 truncate text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-1 truncate font-mono text-xl font-black ${tone === "risk" ? "text-rose-200" : "text-slate-50"}`} title={value}>{value}</div>
    </div>
  );
}

function Zone({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "risk"; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
      <div className="min-w-0 truncate text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-1 text-sm font-semibold ${tone === "risk" ? "text-amber-100" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}

function NarrativeList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="min-w-0 truncate text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={title}>{title}</div>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
        {items.slice(0, 4).map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}
