import type { ShockMovePattern } from "@/lib/trading/shock-move";
import { formatNumber } from "@/lib/ui/formatters";
import { humanizeInsightText } from "@/lib/ui/labels";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function ShockPatternMemoryCard({ pattern }: { pattern: ShockMovePattern | null }) {
  if (!pattern) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Large-Move Memory" title="High-Volatility Context" meta="building" />
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Large-move history is not available for this symbol yet. TradeVeto will show it after the limited historical refresh has enough price history.
        </p>
      </GlassPanel>
    );
  }

  const timing = pattern.timingValidation ?? null;
  const evidenceQualityScore = pattern.evidenceQualityScore ?? pattern.reliabilityScore;
  const falsePositiveRiskScore = pattern.falsePositiveRiskScore ?? 50;
  const liquidityQualityScore = pattern.liquidityQualityScore ?? 58;

  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle eyebrow="Large-Move Memory" title={humanizeInsightText(pattern.opportunityState)} meta={`${pattern.lookbackWindow} lookback`} />
        <div className="rounded-full border border-amber-300/25 bg-amber-400/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
          Speculative research
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Opportunity" value={formatNumber(pattern.opportunityScore, 0)} />
        <Metric label="Upside / Downside Balance" value={formatNumber(pattern.asymmetryScore, 0)} />
        <Metric label="Upside History" value={formatNumber(pattern.upsideShockScore, 0)} />
        <Metric label="Downside Risk" value={formatNumber(pattern.downsideRiskScore, 0)} tone={pattern.downsideRiskScore >= 70 ? "risk" : "neutral"} />
        <Metric label="Similarity" value={formatNumber(pattern.currentSimilarityScore, 0)} />
        <Metric label="Reliability" value={formatNumber(pattern.reliabilityScore, 0)} />
        <Metric label="Timing Proof" value={timing ? formatNumber(timing.timingQualityScore, 0) : "building"} />
        <Metric label="Entry Timing" value={timing ? formatNumber(timing.entryQualityScore, 0) : "building"} />
        <Metric label="Evidence Quality" value={formatNumber(evidenceQualityScore, 0)} />
        <Metric label="False Alarm Risk" value={formatNumber(falsePositiveRiskScore, 0)} tone={falsePositiveRiskScore >= 62 ? "risk" : "neutral"} />
        <Metric label="Volume Quality" value={formatNumber(liquidityQualityScore, 0)} tone={liquidityQualityScore < 45 ? "risk" : "neutral"} />
        <Metric label="Upside Events" value={pattern.upsideShockCount.toLocaleString()} />
        <Metric label="Downside Events" value={pattern.downsideShockCount.toLocaleString()} tone={pattern.downsideShockCount > pattern.upsideShockCount ? "risk" : "neutral"} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Zone label="Research entry area" value={humanizeInsightText(pattern.researchEntryZone)} />
        <Zone label="Too-extended area" value={humanizeInsightText(pattern.doNotChaseZone)} tone="risk" />
        <Zone label="Historical exit area" value={humanizeInsightText(pattern.historicalExitZone)} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <NarrativeList items={pattern.commonPreconditions} title="What often appeared before big moves" />
        <NarrativeList items={pattern.commonFailureConditions} title="What often made these setups fail" />
      </div>

      {timing ? (
        <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.045] p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase leading-4 tracking-[0.14em] text-cyan-200/80">Timing Proof</div>
              <p className="mt-1 text-sm leading-6 text-slate-300">{humanizeInsightText(timing.summary)}</p>
            </div>
            <div className="rounded-full border border-white/10 bg-slate-950/45 px-3 py-1.5 font-mono text-xs font-black text-slate-100">
              n={timing.validationSampleSize}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Early Detection" value={formatRate(timing.earlyDetectionRate)} />
            <Metric label="Missed Moves" value={formatRate(timing.missedOpportunityRate)} tone={(timing.missedOpportunityRate ?? 0) >= 0.45 ? "risk" : "neutral"} />
            <Metric label="False Alarm" value={formatRate(timing.falsePositiveRate)} tone={(timing.falsePositiveRate ?? 0) >= 0.45 ? "risk" : "neutral"} />
            <Metric label="Pullback Success" value={formatRate(timing.pullbackEntrySuccessRate)} />
            <Metric label="Avg Chase DD" value={formatSignedPct(timing.averageDrawdownAfterChasePct)} tone={(timing.averageDrawdownAfterChasePct ?? 0) <= -5 ? "risk" : "neutral"} />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Zone label="Best past entry behavior" value={humanizeInsightText(timing.bestHistoricalEntryZone)} />
            <Zone label="Best past exit behavior" value={humanizeInsightText(timing.bestHistoricalExitZone)} />
          </div>

          {timing.replayStudies.length ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/35 p-3">
              <div className="text-[10px] font-black uppercase leading-4 tracking-[0.14em] text-slate-500">Would TradeVeto Have Seen It?</div>
              <div className="mt-2 grid gap-2 xl:grid-cols-2">
                {timing.replayStudies.slice(0, 4).map((study) => (
                  <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3" key={`${study.eventDate}-${study.return1d}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-mono text-xs font-black text-slate-100">{study.eventDate.slice(0, 10)}</div>
                      <div className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${study.preMoveDetected ? "border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100" : "border-amber-300/25 bg-amber-400/[0.08] text-amber-100"}`}>
                        {study.preMoveDetected ? "seen" : "missed"}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Metric label="1D Move" value={formatSignedPct(study.return1d)} />
                      <Metric label="5D Follow" value={formatSignedPct(study.return5d)} />
                      <Metric label="Pre Score" value={formatNumber(study.preMoveScore, 0)} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{humanizeInsightText(study.verdict)}</p>
                    <ul className="mt-2 space-y-1 text-[11px] leading-4 text-slate-400">
                      {study.beforeMoveEvidence.slice(0, 3).map((item) => <li key={item}>- {humanizeInsightText(item)}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Large-move history is research context, not a main TradeVeto signal or financial advice. Thin, stale, or noisy moves are lowered before ranking. AI may explain the evidence, but the numbers come from TradeVeto's scoring engine.
      </p>
    </GlassPanel>
  );
}

function formatRate(value: number | null): string {
  if (value === null) return "building";
  return `${Math.round(value * 100)}%`;
}

function formatSignedPct(value: number | null): string {
  if (value === null) return "building";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
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
        {items.slice(0, 4).map((item) => <li key={item}>- {humanizeInsightText(item)}</li>)}
      </ul>
    </div>
  );
}
