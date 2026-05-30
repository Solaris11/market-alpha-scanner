import type { PredictiveIntelligenceSystem } from "@/lib/trading/predictive-intelligence";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function PredictiveIntelligencePanel({
  compact = false,
  system,
}: {
  compact?: boolean;
  system: PredictiveIntelligenceSystem;
}) {
  const topForecast = system.opportunityForecasts[0] ?? null;
  return (
    <GlassPanel className="overflow-hidden p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          eyebrow="Predictive Intelligence"
          meta={`${system.confidenceFramework.confidenceBand} confidence`}
          title="Next-Pressure Forecast"
        />
        <div className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
          {system.marketRegimeForecast.confidenceScore}/100
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "lg:grid-cols-3" : "xl:grid-cols-[1.15fr_0.85fr]"}`}>
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Market regime forecast</div>
          <div className="mt-2 text-2xl font-semibold capitalize tracking-tight text-slate-50">
            {system.marketRegimeForecast.forecast.replace(/_/g, " ")}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{system.marketRegimeForecast.likelyPath}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full border border-white/10 px-2 py-1 text-slate-300">{system.marketRegimeForecast.timeHorizon}</span>
            <span className="rounded-full border border-white/10 px-2 py-1 text-amber-200">{system.marketRegimeForecast.uncertainty.label}</span>
            <span className="rounded-full border border-white/10 px-2 py-1 text-slate-300">{system.marketRegimeForecast.historicalValidation.label}</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Top opportunity forecast</div>
          {topForecast ? (
            <>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="font-mono text-2xl font-black text-slate-50">{topForecast.symbol}</div>
                <div className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">
                  {topForecast.opportunityQualityScore}/100
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{topForecast.likelyPath}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <ForecastMetric label="State" value={topForecast.researchActionState} />
                <ForecastMetric label="Risk" value={topForecast.riskProfile} />
                <ForecastMetric label="Volatility" value={topForecast.expectedVolatility} />
                <ForecastMetric label="Horizon" value={topForecast.timeHorizon} />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-400">Opportunity forecasts need scanner rows before they can be ranked.</p>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Predictive alert ranking</div>
          <div className="mt-3 space-y-2">
            {system.predictiveAlerts.slice(0, compact ? 3 : 5).map((alert) => (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3" key={`${alert.rank}-${alert.title}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{alert.rank}. {alert.title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">{alert.whyItMatters}</div>
                  </div>
                  <div className="font-mono text-sm font-black text-cyan-100">{alert.importanceScore}</div>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">{alert.nextAction}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Trust boundary</div>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
            {system.confidenceFramework.trustBoundary.map((item) => <li key={item}>- {item}</li>)}
          </ul>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-300">
            Portfolio forecast: {system.portfolioForecast.status === "operational" ? `${system.portfolioForecast.riskForecastScore}/100 risk pressure` : system.portfolioForecast.limitedReason}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function ForecastMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/30 p-2">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-xs font-semibold capitalize text-slate-200" title={value}>{value}</div>
    </div>
  );
}
