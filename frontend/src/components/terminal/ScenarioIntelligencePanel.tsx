import {
  scenarioStateLabel,
  type ScenarioImpact,
  type ScenarioInsight,
  type ScenarioIntelligenceSystem,
  type SymbolScenarioProfile,
} from "@/lib/trading/scenario-intelligence";
import { humanizeInsightText } from "@/lib/ui/labels";
import { GlassPanel } from "./ui/GlassPanel";

export function ScenarioIntelligencePanel({
  compact = false,
  focusSymbol,
  system,
}: {
  compact?: boolean;
  focusSymbol?: string;
  system: ScenarioIntelligenceSystem | null;
}) {
  if (!system) return null;
  const focusedProfile = focusSymbol ? system.symbolProfiles.find((profile) => profile.symbol === focusSymbol.toUpperCase()) ?? null : null;
  const profiles = focusedProfile ? [focusedProfile] : system.mostVulnerable.slice(0, compact ? 3 : 5);
  const insights = system.terminalInsights.slice(0, compact ? 3 : 4);

  return (
    <GlassPanel className="min-w-0 overflow-hidden border-violet-300/15 bg-violet-400/[0.04] p-4 sm:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-300">Scenario Intelligence</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{focusSymbol ? `${focusSymbol.toUpperCase()} stress test` : "What-if market stress"}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            TradeVeto tests how setups may hold up if market pressure changes. It estimates resilience, not future prices.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 text-left text-xs sm:max-w-sm md:min-w-[250px] md:text-right">
          <ScenarioMetric label="Stress" value={`${system.portfolioStressScore}/100`} />
          <ScenarioMetric label="Scenarios" value={system.scenarios.length.toString()} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {insights.map((insight) => <InsightCard insight={insight} key={`${insight.title}-${insight.scenarioKey}`} />)}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {profiles.length ? profiles.map((profile) => <ScenarioProfileCard key={profile.symbol} profile={profile} />) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400 lg:col-span-3">
            Scenario intelligence needs current opportunity rows before stress profiles can be shown.
          </div>
        )}
      </div>

      {!compact ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
          This does not predict exact future prices. It asks which setups may become more fragile if conditions shift.
        </div>
      ) : null}
    </GlassPanel>
  );
}

function ScenarioProfileCard({ profile }: { profile: SymbolScenarioProfile }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-50">{profile.symbol}</div>
          <div className="mt-1 break-words text-xs text-violet-200">{humanizeInsightText(profile.setupResilienceLabel)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-lg text-slate-50">{profile.worstCaseVulnerabilityScore}</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">vulnerability</div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{humanizeInsightText(profile.impactSummary)}</p>
      <div className="mt-3 space-y-2">
        {profile.impacts.slice(0, 2).map((impact) => <ImpactRow impact={impact} key={impact.scenario.key} />)}
      </div>
    </div>
  );
}

function ImpactRow({ impact }: { impact: ScenarioImpact }) {
  const tone = impact.state === "resilient"
    ? "border-emerald-300/20 bg-emerald-400/[0.07] text-emerald-100"
    : impact.state === "high_vulnerability" || impact.state === "fragile"
      ? "border-amber-300/25 bg-amber-400/[0.08] text-amber-100"
      : "border-white/10 bg-white/[0.03] text-slate-200";
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 break-words text-sm font-semibold">{impact.scenario.label}</div>
        <div className="shrink-0 text-right text-xs font-black uppercase leading-4 tracking-normal">{scenarioStateLabel(impact.state)}</div>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] min-[360px]:grid-cols-3">
        <MiniMetric label="Resilience" value={`${impact.resilienceScore}/100`} />
        <MiniMetric label="Fragility" value={`${impact.stressedFragilityScore}/100`} />
        <MiniMetric label="Pressure" value={`${impact.continuationPressureScore}/100`} />
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: ScenarioInsight }) {
  const toneClass = insight.tone === "positive"
    ? "border-emerald-300/25 bg-emerald-400/[0.08]"
    : insight.tone === "warning"
      ? "border-amber-300/25 bg-amber-400/[0.08]"
      : "border-white/10 bg-white/[0.03]";
  return (
    <div className={`min-w-0 rounded-xl border p-4 ${toneClass}`}>
      <div className="break-words text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">{insight.scenarioKey.replaceAll("_", " ")}</div>
      <div className="mt-2 font-semibold text-slate-100">{humanizeInsightText(insight.title)}</div>
      <div className="mt-2 break-words text-xs font-semibold uppercase leading-5 tracking-normal text-violet-200">{humanizeInsightText(insight.evidenceLabel)}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{humanizeInsightText(insight.detail)}</p>
    </div>
  );
}

function ScenarioMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="break-words text-[9px] font-black uppercase leading-3 tracking-normal text-slate-500">{label}</div>
      <div className="mt-1 break-words font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="break-words text-slate-500">{label}</div>
      <div className="mt-1 break-words font-mono text-slate-100">{value}</div>
    </div>
  );
}
