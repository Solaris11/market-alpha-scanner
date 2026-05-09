import { AdminEmpty, AdminSection, AdminStatCard, StatusBadge } from "@/components/admin/AdminChrome";
import {
  adaptiveLearningStatusTone,
  adaptiveTrendLabel,
  type AdaptiveLearningCohort,
  type AdaptiveLearningInsight,
  type AdaptiveLearningSystem,
  type AdaptiveWeightAdjustment,
} from "@/lib/trading/adaptive-learning";

export function AdaptiveLearningDashboard({ system }: { system: AdaptiveLearningSystem }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Learning trend" tone={adaptiveLearningStatusTone(system.learningTrend)} value={adaptiveTrendLabel(system.learningTrend)} />
        <AdminStatCard label="Confidence reliability" tone={system.confidenceReliabilityScore >= 70 ? "good" : system.confidenceReliabilityScore < 45 ? "warn" : "default"} value={`${system.confidenceReliabilityScore}/100`} />
        <AdminStatCard label="Calibration drift" tone={system.calibrationDriftScore >= 55 ? "warn" : "good"} value={`${system.calibrationDriftScore}/100`} />
        <AdminStatCard label="Evidence tier" value={system.evidenceTier} meta={`${system.observationCount.toLocaleString()} completed observations`} />
      </section>

      <AdminSection title="Adaptive learning briefing" subtitle="Learning is observational. It does not self-modify scanner scoring or replace deterministic validation.">
        <ul className="space-y-2 text-sm leading-6 text-slate-300">
          {system.operatorBriefing.map((line) => <li key={line}>- {line}</li>)}
        </ul>
      </AdminSection>

      <AdminSection title="Model drift warnings" subtitle="Operator-review signals for deteriorating calibration, weak follow-through, or stale assumptions.">
        {system.modelDriftWarnings.length ? (
          <InsightGrid insights={system.modelDriftWarnings} />
        ) : (
          <AdminEmpty>No material drift warning is visible in the current completed evidence window.</AdminEmpty>
        )}
      </AdminSection>

      <AdminSection title="Bounded adaptive weighting proposals" subtitle="Proposals are capped, explainable, reversible, and review-only. Production weights are not changed automatically.">
        <div className="grid gap-3 lg:grid-cols-3">
          {system.adaptiveWeighting.map((item) => <WeightCard item={item} key={item.factor} />)}
        </div>
      </AdminSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminSection title="Setup performance learning" subtitle="Which setup types are currently strongest or weakest under completed forward windows.">
          <CohortList rows={system.setupLearning} />
        </AdminSection>
        <AdminSection title="Regime-specific learning" subtitle="Regime cohorts show whether setup evidence is surviving the current market structure.">
          <CohortList rows={system.regimeLearning} />
        </AdminSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminSection title="Shock and event learning" subtitle="High-volatility and verified-event cohorts are summarized only when completed outcomes exist.">
          <InsightGrid insights={[...system.shockLearning, ...system.eventImpactLearning]} />
        </AdminSection>
        <AdminSection title="Recommendation quality learning" subtitle="WAIT, AVOID, and ENTER quality are measured separately so risk-first behavior can be audited.">
          <div className="grid gap-3 md:grid-cols-3">
            <MiniScore label="ENTER" value={system.recommendationQuality.enterQualityScore} />
            <MiniScore label="WAIT" value={system.recommendationQuality.waitQualityScore} />
            <MiniScore label="AVOID" value={system.recommendationQuality.avoidQualityScore} />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">{system.recommendationQuality.summary}</p>
        </AdminSection>
      </div>
    </div>
  );
}

function InsightGrid({ insights }: { insights: AdaptiveLearningInsight[] }) {
  if (!insights.length) return <AdminEmpty>No completed learning insight is available for this section yet.</AdminEmpty>;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {insights.map((insight) => (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4" key={`${insight.source}-${insight.title}-${insight.evidenceLabel}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-slate-100">{insight.title}</div>
            <StatusBadge tone={insight.severity === "warning" ? "warn" : insight.severity === "positive" ? "good" : "default"}>{insight.source}</StatusBadge>
          </div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{insight.evidenceLabel}</div>
          <p className="mt-2 text-sm leading-6 text-slate-400">{insight.detail}</p>
        </div>
      ))}
    </div>
  );
}

function WeightCard({ item }: { item: AdaptiveWeightAdjustment }) {
  const tone = item.status === "insufficient_evidence" ? "default" : item.suggestedAdjustment === 0 ? "good" : "warn";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-sm font-semibold text-slate-100">{item.factor}</div>
        <StatusBadge tone={tone}>{item.status === "review_only" ? "review" : "early"}</StatusBadge>
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-50">{item.suggestedAdjustment > 0 ? "+" : ""}{item.suggestedAdjustment}</div>
      <div className="mt-1 text-xs text-slate-500">Max bounded change +/-{item.maxAdjustment}</div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{item.reason}</p>
    </div>
  );
}

function CohortList({ rows }: { rows: AdaptiveLearningCohort[] }) {
  if (!rows.length) return <AdminEmpty>No high-signal cohort has enough completed observations yet.</AdminEmpty>;
  return (
    <div className="space-y-3">
      {rows.slice(0, 5).map((row) => (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4" key={`${row.groupValue}-${row.horizon}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-slate-100">{row.groupValue}</div>
            <StatusBadge tone={row.sampleSize === "HIGH" ? "good" : row.sampleSize === "MEDIUM" ? "default" : "warn"}>{row.sampleSize.toLowerCase()}</StatusBadge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <MiniMetric label="Reliability" value={`${row.reliabilityScore}/100`} />
            <MiniMetric label="Expectancy" value={formatMaybePct(row.expectancyPct)} />
            <MiniMetric label="Samples" value={row.count.toLocaleString()} />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">{row.detail}</p>
        </div>
      ))}
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="truncate text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-50">{value}/100</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="truncate text-[10px] uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className="mt-1 font-mono text-slate-200">{value}</div>
    </div>
  );
}

function formatMaybePct(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
