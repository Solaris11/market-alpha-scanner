import { AdminEmpty, AdminSection, AdminStatCard, StatusBadge } from "@/components/admin/AdminChrome";
import { scenarioStateLabel, type ScenarioImpact, type ScenarioIntelligenceSystem, type ScenarioSummary, type SymbolScenarioProfile } from "@/lib/trading/scenario-intelligence";

export function ScenarioIntelligenceDashboard({ system }: { system: ScenarioIntelligenceSystem }) {
  const dominant = [...system.scenarioSummaries].sort((left, right) => right.averageVulnerabilityScore - left.averageVulnerabilityScore)[0] ?? null;
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Portfolio stress" tone={system.portfolioStressScore >= 70 ? "warn" : system.portfolioStressScore <= 45 ? "good" : "default"} value={`${system.portfolioStressScore}/100`} />
        <AdminStatCard label="Scenario count" value={system.scenarios.length.toLocaleString()} />
        <AdminStatCard label="Stress leader" tone={dominant?.tone === "warning" ? "warn" : "default"} value={dominant?.scenario.label ?? "No scenario"} meta={dominant ? `${dominant.averageVulnerabilityScore}/100 vulnerability` : undefined} />
        <AdminStatCard label="Symbols modeled" value={system.symbolProfiles.length.toLocaleString()} />
      </section>

      <AdminSection title="Scenario stress map" subtitle="First-generation macro, volatility, liquidity, sector, and event stress scenarios. These estimates are not price forecasts.">
        {system.scenarioSummaries.length ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {system.scenarioSummaries.map((summary) => <ScenarioSummaryCard key={summary.scenario.key} summary={summary} />)}
          </div>
        ) : (
          <AdminEmpty>No scenario summaries are available.</AdminEmpty>
        )}
      </AdminSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminSection title="Most vulnerable setups" subtitle="Highest modeled downside vulnerability under the scenario set.">
          <ProfileList profiles={system.mostVulnerable} mode="vulnerable" />
        </AdminSection>
        <AdminSection title="Most resilient setups" subtitle="Highest average resilience across all modeled scenarios.">
          <ProfileList profiles={system.mostResilient} mode="resilient" />
        </AdminSection>
      </div>

      <AdminSection title="Limitations" subtitle="Scenario Intelligence stays bounded and explainable by design.">
        <ul className="space-y-2 text-sm leading-6 text-slate-400">
          {system.limitations.map((line) => <li key={line}>- {line}</li>)}
        </ul>
      </AdminSection>
    </div>
  );
}

function ScenarioSummaryCard({ summary }: { summary: ScenarioSummary }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-slate-100">{summary.scenario.label}</div>
        <StatusBadge tone={summary.tone === "warning" ? "warn" : summary.tone === "positive" ? "good" : "default"}>{summary.scenario.category}</StatusBadge>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{summary.summary}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Resilience" value={`${summary.averageResilienceScore}/100`} />
        <Metric label="Vulnerability" value={`${summary.averageVulnerabilityScore}/100`} />
      </div>
      {summary.impactedSymbols.length ? (
        <div className="mt-3 text-xs text-slate-400">Impacted: {summary.impactedSymbols.join(", ")}</div>
      ) : null}
    </div>
  );
}

function ProfileList({ mode, profiles }: { mode: "resilient" | "vulnerable"; profiles: SymbolScenarioProfile[] }) {
  if (!profiles.length) return <AdminEmpty>No symbol stress profile is available.</AdminEmpty>;
  return (
    <div className="space-y-3">
      {profiles.slice(0, 6).map((profile) => (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4" key={`${mode}-${profile.symbol}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-100">{profile.symbol}</div>
              <div className="mt-1 text-xs text-slate-500">{profile.setupResilienceLabel}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg text-slate-50">{mode === "resilient" ? profile.averageResilienceScore : profile.worstCaseVulnerabilityScore}</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{mode === "resilient" ? "resilience" : "vulnerability"}</div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">{profile.impactSummary}</p>
          <ImpactMini impact={profile.highestRiskScenario} />
        </div>
      ))}
    </div>
  );
}

function ImpactMini({ impact }: { impact: ScenarioImpact }) {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/35 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-100">{impact.scenario.label}</span>
        <span className="font-black uppercase tracking-[0.14em] text-amber-100">{scenarioStateLabel(impact.state)}</span>
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-400">{impact.riskExplanation}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-slate-200">{value}</div>
    </div>
  );
}
