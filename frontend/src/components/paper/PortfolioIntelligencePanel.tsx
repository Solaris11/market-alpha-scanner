import {
  type PortfolioCorrelationCluster,
  type PortfolioExposureBucket,
  type PortfolioHeatmapCell,
  type PortfolioIntelligenceSystem,
  type PortfolioRiskTone,
  type PortfolioScenarioStress,
} from "@/lib/trading/portfolio-intelligence";
import { formatMoney, formatNumber } from "@/lib/ui/formatters";
import { humanizeInsightText } from "@/lib/ui/labels";

export function PortfolioIntelligencePanel({ system }: { system: PortfolioIntelligenceSystem }) {
  if (!system.openPositionCount) {
    return (
      <section className="min-w-0 overflow-hidden rounded-2xl border border-dashed border-white/10 bg-slate-950/60 p-4 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl sm:p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Portfolio Intelligence</div>
        <h2 className="mt-1 text-lg font-semibold text-slate-50">No active portfolio exposure</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Open paper positions will be analyzed for concentration, linked fragility, market exposure, and stress-test pressure.
        </p>
      </section>
    );
  }

  const sectors = system.exposureBuckets.filter((bucket) => bucket.type === "sector").slice(0, 5);
  const themes = system.exposureBuckets.filter((bucket) => bucket.type === "theme").slice(0, 5);
  const macro = system.exposureBuckets.filter((bucket) => bucket.type === "macro").slice(0, 3);
  const volatility = system.exposureBuckets.filter((bucket) => bucket.type === "volatility").slice(0, 3);
  const event = system.exposureBuckets.filter((bucket) => bucket.type === "event").slice(0, 3);
  const liquidity = system.exposureBuckets.filter((bucket) => bucket.type === "liquidity").slice(0, 3);
  const shock = system.exposureBuckets.filter((bucket) => bucket.type === "shock").slice(0, 3);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Portfolio Intelligence</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Exposure + Scenario Resilience</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{humanizeInsightText(system.summary)}</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 text-left sm:max-w-md sm:text-right xl:w-[390px]">
          <ScorePill label="Quality" tone={qualityTone(system.portfolioQualityScore)} value={`${system.portfolioQualityScore}/100`} />
          <ScorePill label="Fragility" tone={riskTone(system.fragilityScore)} value={`${system.fragilityScore}/100`} />
          <ScorePill label="Concentration" tone={riskTone(system.concentrationScore)} value={`${system.concentrationScore}/100`} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Open Exposure" value={formatMoney(system.totalExposureValue, 0)} meta={`${system.openPositionCount} open positions`} />
        <Metric label="Open Risk" value={formatMoney(system.openRiskAmount, 0)} meta={system.accountValue ? `${formatNumber((system.openRiskAmount / system.accountValue) * 100, 1)}% of paper account` : "active stop risk"} tone={system.openRiskAmount > 0 ? "warn" : "neutral"} />
        <Metric label="Diversification" value={`${system.diversificationQualityScore}/100`} meta={system.portfolioQualityLabel} tone={qualityTone(system.diversificationQualityScore)} />
        <Metric label="Stress Vulnerability" value={`${system.scenarioVulnerabilityScore}/100`} meta="highest weighted stress" tone={riskTone(system.scenarioVulnerabilityScore)} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Market Support" value={`${system.macroAlignmentScore}/100`} meta="weighted open exposure" tone={qualityTone(system.macroAlignmentScore)} />
        <Metric label="Liquidity Risk" value={`${system.liquidityRiskScore}/100`} meta="tightening sensitivity" tone={riskTone(system.liquidityRiskScore)} />
        <Metric label="Large-Move Exposure" value={`${system.shockExposureScore}/100`} meta="big moves in both directions" tone={riskTone(system.shockExposureScore)} />
        <Metric
          label="Correlation Proof"
          value={`${system.rollingCorrelationConfidenceScore}/100`}
          meta={system.rollingCorrelationPairs.length ? `${system.rollingCorrelationPairs.length} rolling pairs` : "factor fallback"}
          tone={system.rollingCorrelationPairs.length ? qualityTone(system.rollingCorrelationConfidenceScore) : "warn"}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <div className="space-y-4">
          <ExposureGroup buckets={sectors} title="Sector Exposure" />
          <ExposureGroup buckets={themes} title="Theme Exposure" />
          <div className="grid gap-4 lg:grid-cols-2">
            <ExposureGroup buckets={macro} title="Market Exposure" />
            <ExposureGroup buckets={volatility} title="Volatility Exposure" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <ExposureGroup buckets={event} title="Event Exposure" />
            <ExposureGroup buckets={liquidity} title="Liquidity Exposure" />
            <ExposureGroup buckets={shock} title="Large-Move Exposure" />
          </div>
        </div>

        <div className="space-y-4">
          <ClusterList clusters={system.correlationClusters} />
          <RollingCorrelationList pairs={system.rollingCorrelationPairs.slice(0, 3)} />
          <ScenarioStressList scenarios={system.scenarioStress.slice(0, 4)} />
          <HedgeOffsetList offsets={system.hedgeOffsetContexts} warning={system.hiddenCorrelationWarning} />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">Stress Proof</div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {system.stressProofSummary.map((line) => (
            <div className="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2 text-xs leading-5 text-slate-300" key={line}>{line}</div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <Heatmap cells={system.heatmap.slice(0, 12)} />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Trust Boundary</div>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-400">
          {system.limitations.map((line) => <li key={line}>- {line}</li>)}
        </ul>
      </div>
    </section>
  );
}

function HedgeOffsetList({ offsets, warning }: { offsets: PortfolioIntelligenceSystem["hedgeOffsetContexts"]; warning: string | null }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">Hedge / Offset Context</div>
      <div className="mt-3 space-y-3">
        {warning ? (
          <div className="rounded-xl border border-amber-300/25 bg-amber-400/[0.08] p-3 text-xs leading-5 text-amber-100">{warning}</div>
        ) : null}
        {offsets.length ? offsets.map((offset) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3" key={offset.label}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 break-words text-sm font-semibold text-slate-100">{offset.label}</div>
              <div className={`text-xs font-black ${toneClass(offset.tone)}`}>{offset.score}/100</div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{offset.reason}</p>
            <div className="mt-2 break-words text-xs text-slate-500">{offset.symbols.join(", ")}</div>
          </div>
        )) : (
          <div className="text-sm leading-6 text-slate-400">No meaningful hedge or offset context is detected yet.</div>
        )}
      </div>
    </div>
  );
}

function ExposureGroup({ buckets, title }: { buckets: PortfolioExposureBucket[]; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-3 space-y-3">
        {buckets.length ? buckets.map((bucket) => <ExposureRow bucket={bucket} key={`${bucket.type}:${bucket.label}`} />) : (
          <div className="text-sm leading-6 text-slate-400">No exposure bucket is available yet.</div>
        )}
      </div>
    </div>
  );
}

function ExposureRow({ bucket }: { bucket: PortfolioExposureBucket }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 break-words font-semibold text-slate-100">{bucket.label}</span>
        <span className={toneClass(bucket.tone)}>{bucket.percent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${barTone(bucket.tone)}`} style={{ width: `${Math.max(4, Math.min(100, bucket.percent))}%` }} />
      </div>
      <div className="mt-1 break-words text-xs leading-5 text-slate-500">{bucket.symbols.join(", ")} · risk {bucket.riskScore}/100</div>
    </div>
  );
}

function ClusterList({ clusters }: { clusters: PortfolioCorrelationCluster[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Correlation + Fragility</div>
      <div className="mt-3 space-y-3">
        {clusters.length ? clusters.map((cluster) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3" key={`${cluster.type}:${cluster.label}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 break-words text-sm font-semibold text-slate-100">{cluster.label}</div>
              <div className={`text-xs font-black ${toneClass(cluster.tone)}`}>{cluster.score}/100</div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{cluster.reason}</p>
            <div className="mt-2 break-words text-xs text-slate-500">{cluster.symbols.join(", ")}</div>
          </div>
        )) : (
          <div className="text-sm leading-6 text-slate-400">No major correlated fragility cluster is flagged.</div>
        )}
      </div>
    </div>
  );
}

function RollingCorrelationList({ pairs }: { pairs: PortfolioIntelligenceSystem["rollingCorrelationPairs"] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Rolling Correlation Proof</div>
      <div className="mt-3 space-y-3">
        {pairs.length ? pairs.map((pair) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3" key={`${pair.left}:${pair.right}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 break-words text-sm font-semibold text-slate-100">{pair.left} / {pair.right}</div>
              <div className="font-mono text-xs font-black text-slate-100">{pair.correlation.toFixed(2)}</div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {pair.observationCount} aligned daily return observations; confidence {pair.confidenceScore}/100, combined exposure {pair.combinedWeightPct}%.
            </p>
          </div>
        )) : (
          <div className="text-sm leading-6 text-slate-400">Daily price history is not available here yet, so portfolio correlation uses factor and scenario overlap.</div>
        )}
      </div>
    </div>
  );
}

function ScenarioStressList({ scenarios }: { scenarios: PortfolioScenarioStress[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">Scenario Stress</div>
      <div className="mt-3 space-y-3">
        {scenarios.length ? scenarios.map((scenario) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3" key={scenario.scenarioKey}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 break-words text-sm font-semibold text-slate-100">{scenario.scenarioLabel}</div>
              <div className={`text-xs font-black ${toneClass(scenario.tone)}`}>{scenario.weightedVulnerabilityScore}/100</div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{humanizeInsightText(scenario.summary)}</p>
            {scenario.impactedSymbols.length ? <div className="mt-2 break-words text-xs text-slate-500">Impacted: {scenario.impactedSymbols.join(", ")}</div> : null}
          </div>
        )) : (
          <div className="text-sm leading-6 text-slate-400">Scenario stress appears after current scanner context is available for open symbols.</div>
        )}
      </div>
    </div>
  );
}

function Heatmap({ cells }: { cells: PortfolioHeatmapCell[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Portfolio Heatmap</div>
          <div className="mt-1 text-sm text-slate-400">Exposure weight, fragility, market support, and stress-test vulnerability by symbol.</div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cells.length ? cells.map((cell) => (
          <div className={`rounded-xl border p-3 ${cellTone(cell.tone)}`} key={cell.symbol}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-lg font-black text-slate-50">{cell.symbol}</div>
                <div className="mt-0.5 text-xs text-slate-400">{cell.sector}</div>
              </div>
              <div className="text-right text-xs text-slate-300">{cell.weightPct}%</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <Mini label="Fragility" value={`${cell.fragilityScore}/100`} />
              <Mini label="Upside / Downside" value={`${cell.asymmetryScore}/100`} />
              <Mini label="Market" value={`${cell.macroAlignmentScore}/100`} />
              <Mini label="Stress" value={`${cell.scenarioVulnerabilityScore}/100`} />
              <Mini label="Liquidity" value={`${cell.liquidityRiskScore}/100`} />
              <Mini label="Large Move" value={`${cell.shockExposureScore}/100`} />
            </div>
          </div>
        )) : (
          <div className="text-sm leading-6 text-slate-400">No open symbols are available for the heatmap.</div>
        )}
      </div>
    </div>
  );
}

function ScorePill({ label, tone, value }: { label: string; tone: PortfolioRiskTone; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-2.5 sm:p-3">
      <div className="min-w-0 break-words text-[8px] font-black uppercase leading-3 tracking-normal text-slate-500 sm:text-[9px]">{label}</div>
      <div className={`mt-1 break-words font-semibold ${toneClass(tone)}`}>{value}</div>
    </div>
  );
}

function Metric({ label, meta, tone = "neutral", value }: { label: string; meta: string; tone?: PortfolioRiskTone; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="break-words text-[10px] font-semibold uppercase leading-4 tracking-normal text-slate-500">{label}</div>
      <div className={`mt-2 break-words font-mono text-xl font-black ${toneClass(tone)}`}>{value}</div>
      <div className="mt-1 break-words text-xs leading-5 text-slate-500">{meta}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-slate-100">{value}</div>
    </div>
  );
}

function qualityTone(score: number): PortfolioRiskTone {
  if (score >= 70) return "good";
  if (score >= 52) return "neutral";
  if (score >= 38) return "warn";
  return "risk";
}

function riskTone(score: number): PortfolioRiskTone {
  if (score >= 72) return "risk";
  if (score >= 55) return "warn";
  if (score <= 34) return "good";
  return "neutral";
}

function toneClass(tone: PortfolioRiskTone): string {
  if (tone === "good") return "text-emerald-300";
  if (tone === "risk") return "text-rose-300";
  if (tone === "warn") return "text-amber-200";
  return "text-slate-100";
}

function barTone(tone: PortfolioRiskTone): string {
  if (tone === "good") return "bg-emerald-400";
  if (tone === "risk") return "bg-rose-400";
  if (tone === "warn") return "bg-amber-300";
  return "bg-cyan-300";
}

function cellTone(tone: PortfolioRiskTone): string {
  if (tone === "risk") return "border-rose-300/25 bg-rose-400/[0.07]";
  if (tone === "warn") return "border-amber-300/25 bg-amber-400/[0.07]";
  if (tone === "good") return "border-emerald-300/20 bg-emerald-400/[0.06]";
  return "border-white/10 bg-slate-950/35";
}
