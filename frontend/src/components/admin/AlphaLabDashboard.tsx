import { AdminEmpty, AdminSection, AdminStatCard, StatusBadge } from "@/components/admin/AdminChrome";
import {
  strategyEvidenceLabel,
  strategyFamilyLabel,
  type AlphaCluster,
  type StrategyCurrentOpportunity,
  type StrategyIntelligenceSystem,
  type StrategyMatrixRow,
  type StrategyPerformanceRow,
} from "@/lib/trading/strategy-intelligence";

export function AlphaLabDashboard({ system }: { system: StrategyIntelligenceSystem }) {
  const best = system.bestStrategies[0];
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Primary horizon" value={system.primaryHorizon} meta={`${system.observationCount.toLocaleString()} completed observations`} />
        <AdminStatCard label="Baseline return" value={formatPct(system.baselineReturnPct)} />
        <AdminStatCard label="Best strategy" tone={best && best.strategyQualityScore >= 62 ? "good" : "default"} value={best?.label ?? "No leader yet"} meta={best ? `${best.strategyQualityScore}/100 quality` : "Waiting for evidence"} />
        <AdminStatCard label="Current candidates" tone={system.currentOpportunities.length ? "good" : "default"} value={system.currentOpportunities.length.toLocaleString()} meta="strategy-fit ranked" />
      </section>

      <AdminSection title="Alpha Lab briefing" subtitle="Research-only strategy intelligence. This compares completed outcomes and does not override core scanner decisions.">
        <ul className="space-y-2 text-sm leading-6 text-slate-300">
          {system.operatorBriefing.map((line) => <li key={line}>- {line}</li>)}
        </ul>
      </AdminSection>

      <AdminSection title="Strategy families" subtitle="Strategy quality combines excess return, durability, capital efficiency, downside risk, and evidence maturity.">
        {system.bestStrategies.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {system.bestStrategies.map((row) => <StrategyCard key={row.family} row={row} />)}
          </div>
        ) : (
          <AdminEmpty>No strategy family has enough completed evidence yet.</AdminEmpty>
        )}
      </AdminSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminSection title="Alpha clusters" subtitle="Potential repeatable edges found in completed evidence windows.">
          <InsightGrid insights={system.alphaClusters} />
        </AdminSection>
        <AdminSection title="Deteriorating strategy categories" subtitle="Categories with edge decay, below-baseline behavior, or high downside risk.">
          {system.deterioratingStrategies.length ? (
            <div className="space-y-3">
              {system.deterioratingStrategies.map((row) => <DecayCard key={row.family} row={row} />)}
            </div>
          ) : (
            <AdminEmpty>No high-signal deterioration cohort is visible in the current window.</AdminEmpty>
          )}
        </AdminSection>
      </div>

      <AdminSection title="Current strategy-fit opportunities" subtitle="Current symbols ranked by strategy fit, opportunity efficiency, and bounded alpha evidence. Core risk guardrails still apply.">
        {system.currentOpportunities.length ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {system.currentOpportunities.slice(0, 9).map((item) => <CurrentOpportunityCard item={item} key={item.symbol} />)}
          </div>
        ) : (
          <AdminEmpty>No current scanner rows meet the minimum strategy-fit threshold.</AdminEmpty>
        )}
      </AdminSection>

      <AdminSection title="Strategy performance matrix" subtitle="Setup, regime, sector, and event cohorts. Small samples are marked early and should not be used for tuning.">
        <MatrixGrid rows={system.strategyMatrix} />
      </AdminSection>

      <AdminSection title="Limitations" subtitle="Alpha Lab is intentionally bounded to avoid overfit and hype.">
        <ul className="space-y-2 text-sm leading-6 text-slate-400">
          {system.limitations.map((line) => <li key={line}>- {line}</li>)}
        </ul>
      </AdminSection>
    </div>
  );
}

function StrategyCard({ row }: { row: StrategyPerformanceRow }) {
  const tone = row.strategyQualityScore >= 68 ? "good" : row.edgeDecayScore >= 62 ? "warn" : "default";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-slate-100">{row.label}</div>
        <StatusBadge tone={tone}>{strategyEvidenceLabel(row.evidenceMaturity)}</StatusBadge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <Metric label="Quality" value={`${row.strategyQualityScore}/100`} />
        <Metric label="Alpha" value={`${row.alphaScore}/100`} />
        <Metric label="Efficiency" value={`${row.opportunityEfficiencyScore}/100`} />
        <Metric label="Samples" value={row.sampleCount.toLocaleString()} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <Metric label="Avg return" value={formatPct(row.averageReturnPct)} />
        <Metric label="Win rate" value={formatPct(row.winRatePct)} />
        <Metric label="Drawdown" value={formatPct(row.averageDrawdownPct)} />
        <Metric label="Decay" value={`${row.edgeDecayScore}/100`} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{row.summary}</p>
    </div>
  );
}

function DecayCard({ row }: { row: StrategyPerformanceRow }) {
  return (
    <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.07] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-amber-100">{row.label}</div>
        <span className="font-mono text-sm text-amber-100">{row.edgeDecayScore}/100</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{row.summary}</p>
    </div>
  );
}

function CurrentOpportunityCard({ item }: { item: StrategyCurrentOpportunity }) {
  return (
    <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/[0.06] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-50">{item.symbol}</div>
          <div className="mt-1 text-xs text-cyan-200">{strategyFamilyLabel(item.family)}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl text-slate-50">{item.strategyQualityScore}</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">quality</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Alpha" value={`${item.alphaScore}/100`} />
        <Metric label="Efficiency" value={`${item.opportunityEfficiencyScore}/100`} />
      </div>
      <div className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">{item.evidenceLabel}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{item.keyReason}</p>
      <p className="mt-2 text-sm leading-6 text-amber-100">{item.keyRisk}</p>
    </div>
  );
}

function InsightGrid({ insights }: { insights: AlphaCluster[] }) {
  if (!insights.length) return <AdminEmpty>No alpha cluster insight is available yet.</AdminEmpty>;
  return (
    <div className="space-y-3">
      {insights.map((insight) => (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4" key={`${insight.title}-${insight.strategyFamily}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-slate-100">{insight.title}</div>
            <StatusBadge tone={insight.tone === "positive" ? "good" : insight.tone === "warning" ? "warn" : "default"}>{insight.score}/100</StatusBadge>
          </div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{insight.evidenceLabel}</div>
          <p className="mt-2 text-sm leading-6 text-slate-400">{insight.detail}</p>
        </div>
      ))}
    </div>
  );
}

function MatrixGrid({ rows }: { rows: StrategyMatrixRow[] }) {
  if (!rows.length) return <AdminEmpty>No strategy matrix rows have enough completed evidence yet.</AdminEmpty>;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.slice(0, 18).map((row) => (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4" key={`${row.axis}-${row.family}-${row.value}`}>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{row.axis.replace("_", " ")}</div>
          <div className="mt-2 font-semibold text-slate-100">{row.label}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <Metric label="Quality" value={`${row.strategyQualityScore}/100`} />
            <Metric label="Alpha" value={`${row.alphaScore}/100`} />
            <Metric label="Samples" value={row.sampleCount.toLocaleString()} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="truncate text-[10px] uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className="mt-1 font-mono text-slate-200">{value}</div>
    </div>
  );
}

function formatPct(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
