import {
  strategyFamilyLabel,
  type AlphaCluster,
  type StrategyCurrentOpportunity,
  type StrategyIntelligenceSystem,
} from "@/lib/trading/strategy-intelligence";
import { GlassPanel } from "./ui/GlassPanel";

export function StrategyIntelligencePanel({
  compact = false,
  focusSymbol,
  system,
}: {
  compact?: boolean;
  focusSymbol?: string;
  system: StrategyIntelligenceSystem | null;
}) {
  if (!system) return null;
  const insights = system.terminalInsights.slice(0, compact ? 3 : 4);
  const opportunities = focusSymbol
    ? system.currentOpportunities.filter((item) => item.symbol === focusSymbol.toUpperCase()).slice(0, 1)
    : system.currentOpportunities.slice(0, compact ? 3 : 5);
  const best = system.bestStrategies[0];

  return (
    <GlassPanel className="border-cyan-300/15 bg-cyan-400/[0.04] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Alpha Lab</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{focusSymbol ? `${focusSymbol.toUpperCase()} strategy fit` : "Strategy intelligence"}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Completed outcomes are grouped into strategy families to identify historically repeatable edge, decay, and capital efficiency. Research only; core risk decisions remain authoritative.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs md:min-w-[310px]">
          <AlphaMetric label="Horizon" value={system.primaryHorizon} />
          <AlphaMetric label="Baseline" value={formatPct(system.baselineReturnPct)} />
          <AlphaMetric label="Samples" value={system.observationCount.toLocaleString()} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {insights.length ? insights.map((insight) => <InsightCard insight={insight} key={`${insight.title}-${insight.strategyFamily}`} />) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400 lg:col-span-3">
            Strategy intelligence will sharpen after more completed forward-return windows mature.
          </div>
        )}
      </div>

      {opportunities.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {opportunities.map((item) => <OpportunityFit item={item} key={item.symbol} />)}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
          {focusSymbol ? "This symbol does not yet have a strong current strategy-fit row." : "No current strategy-fit candidate meets the minimum quality threshold yet."}
        </div>
      )}

      {!compact ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
          {best ? `${best.label} is currently the strongest strategy family at ${best.strategyQualityScore}/100 quality. ` : ""}
          Alpha Lab does not produce direct trade instructions, guaranteed edges, or capital allocation advice.
        </div>
      ) : null}
    </GlassPanel>
  );
}

function InsightCard({ insight }: { insight: AlphaCluster }) {
  const toneClass = insight.tone === "positive"
    ? "border-emerald-300/25 bg-emerald-400/[0.08]"
    : insight.tone === "warning"
      ? "border-amber-300/25 bg-amber-400/[0.08]"
      : "border-white/10 bg-white/[0.03]";
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{strategyFamilyLabel(insight.strategyFamily)}</div>
      <div className="mt-2 font-semibold text-slate-100">{insight.title}</div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{insight.evidenceLabel}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{insight.detail}</p>
    </div>
  );
}

function OpportunityFit({ item }: { item: StrategyCurrentOpportunity }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-50">{item.symbol}</div>
          <div className="mt-1 text-xs text-cyan-200">{strategyFamilyLabel(item.family)}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg text-slate-50">{item.strategyQualityScore}</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">quality</div>
        </div>
      </div>
      <div className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.profileFitLabel}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{item.keyReason}</p>
      <p className="mt-2 text-sm leading-6 text-amber-100">{item.keyRisk}</p>
    </div>
  );
}

function AlphaMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function formatPct(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
