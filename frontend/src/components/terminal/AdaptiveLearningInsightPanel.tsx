import {
  adaptiveInsightLabel,
  adaptiveLearningStatusTone,
  adaptiveTrendLabel,
  type AdaptiveLearningInsight,
  type AdaptiveLearningSystem,
} from "@/lib/trading/adaptive-learning";
import { GlassPanel } from "./ui/GlassPanel";

export function AdaptiveLearningInsightPanel({
  compact = false,
  focusSymbol,
  system,
}: {
  compact?: boolean;
  focusSymbol?: string;
  system: AdaptiveLearningSystem | null;
}) {
  if (!system) return null;
  const insights = system.userFacingInsights.slice(0, compact ? 3 : 5);
  const tone = adaptiveLearningStatusTone(system.learningTrend);
  const toneClass = tone === "good" ? "border-emerald-300/20 bg-emerald-400/[0.06]" : tone === "warn" ? "border-amber-300/25 bg-amber-400/[0.08]" : "border-white/10 bg-slate-950/55";

  return (
    <GlassPanel className={`p-5 ${toneClass}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Adaptive Learning</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{focusSymbol ? `${focusSymbol.toUpperCase()} learning context` : "What the market taught us"}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Completed outcomes are used to detect calibration drift and reliability changes. This layer is observational and does not self-modify scanner scoring.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs md:min-w-[290px]">
          <LearningMetric label="Trend" value={adaptiveTrendLabel(system.learningTrend)} />
          <LearningMetric label="Reliability" value={`${system.confidenceReliabilityScore}/100`} />
          <LearningMetric label="Drift" value={`${system.calibrationDriftScore}/100`} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {insights.length ? insights.map((insight) => <InsightCard insight={insight} key={adaptiveInsightLabel(insight)} />) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400 lg:col-span-3">
            Learning insights will appear after enough later-outcome windows mature.
          </div>
        )}
      </div>

      {!compact ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
          {system.operatorBriefing[0]} No adaptive recommendation is financial advice or an automatic tuning instruction.
        </div>
      ) : null}
    </GlassPanel>
  );
}

function InsightCard({ insight }: { insight: AdaptiveLearningInsight }) {
  const toneClass = insight.severity === "warning"
    ? "border-amber-300/25 bg-amber-400/[0.08] text-amber-100"
    : insight.severity === "positive"
      ? "border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100"
      : "border-white/10 bg-white/[0.03] text-slate-200";
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-75">{insight.source}</div>
      <div className="mt-2 font-semibold">{insight.title}</div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-80">{insight.evidenceLabel}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{insight.detail}</p>
    </div>
  );
}

function LearningMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-100">{value}</div>
    </div>
  );
}
