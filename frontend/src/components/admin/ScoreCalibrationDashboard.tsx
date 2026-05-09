import { AdminEmpty, AdminSection, AdminStatCard, StatusBadge } from "@/components/admin/AdminChrome";
import type { CalibrationSeverity, ScoreCalibrationAnomalySummary, ScoreCalibrationAxis, ScoreCalibrationBucket, ScoreCalibrationFinding, ScoreCalibrationSystem } from "@/lib/trading/score-calibration";

export function ScoreCalibrationDashboard({ system }: { system: ScoreCalibrationSystem }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Confidence" tone={scoreTone(system.calibrationConfidence)} value={`${system.calibrationConfidence}/100`} />
        <AdminStatCard label="Consistency" tone={scoreTone(system.outcomeConsistency)} value={`${system.outcomeConsistency}/100`} />
        <AdminStatCard label="Reliability" meta={`${system.observationCount.toLocaleString()} primary-horizon observations`} tone={reliabilityTone(system.reliabilityLabel)} value={system.reliabilityLabel} />
        <AdminStatCard label="Generated" value={new Date(system.generatedAt).toLocaleString()} />
      </section>

      <AdminSection title="Score outcome proof" subtitle="Calibration is observational and review-only. It measures whether scores line up with completed forward outcomes; it does not auto-change scanner weights.">
        <p className="text-sm leading-6 text-slate-300">{system.summary}</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {system.operatorFindings.map((finding) => <FindingCard finding={finding} key={`${finding.title}-${finding.evidence}`} />)}
        </div>
      </AdminSection>

      <AdminSection title="Calibration axes" subtitle="Each axis compares bucketed scores against completed forward returns, drawdowns, adverse outcomes, and large-move rates.">
        {system.axes.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {system.axes.map((axis) => <AxisCard axis={axis} key={`${axis.axisId}-${axis.horizon}`} />)}
          </div>
        ) : (
          <AdminEmpty>No completed score calibration buckets are available yet.</AdminEmpty>
        )}
      </AdminSection>

      <AdminSection title="Bucket detail" subtitle="High false positives or non-monotonic buckets require review before any score-threshold changes.">
        {system.axes.length ? <BucketTable axes={system.axes} /> : <AdminEmpty>No bucket rows available.</AdminEmpty>}
      </AdminSection>

      <AdminSection title="Calibration anomalies" subtitle="Representative false positives, false negatives, overly conservative cases, overly aggressive cases, missed winners, and avoided losers.">
        <div className="grid gap-3 xl:grid-cols-2">
          {system.anomalySummaries.map((summary) => <AnomalyCard summary={summary} key={summary.type} />)}
        </div>
      </AdminSection>
    </div>
  );
}

function FindingCard({ finding }: { finding: ScoreCalibrationFinding }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-slate-100">{finding.title}</div>
        <StatusBadge tone={severityTone(finding.severity)}>{finding.severity}</StatusBadge>
      </div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{finding.evidence}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{finding.detail}</p>
    </div>
  );
}

function AxisCard({ axis }: { axis: ScoreCalibrationAxis }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-100">{axis.axisLabel}</div>
          <div className="mt-1 text-xs text-slate-500">{axis.horizon} horizon, {axis.observationCount.toLocaleString()} observations</div>
        </div>
        <StatusBadge tone={reliabilityTone(axis.reliabilityLabel)}>{axis.reliabilityLabel}</StatusBadge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <MiniMetric label="Confidence" value={`${axis.calibrationConfidence}/100`} />
        <MiniMetric label="Monotonicity" value={`${axis.monotonicityScore}/100`} />
        <MiniMetric label="False +" value={formatMaybePct(axis.falsePositiveRate)} />
        <MiniMetric label="False -" value={formatMaybePct(axis.falseNegativeRate)} />
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-400">{axis.interpretation}</p>
    </div>
  );
}

function BucketTable({ axes }: { axes: ScoreCalibrationAxis[] }) {
  const rows = axes.flatMap((axis) => axis.buckets.map((bucket) => ({ axis, bucket })));
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-[1120px] w-full text-left text-sm">
        <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-3 py-3">Axis</th>
            <th className="px-3 py-3">Bucket</th>
            <th className="px-3 py-3 text-right">Count</th>
            <th className="px-3 py-3 text-right">Avg signal</th>
            <th className="px-3 py-3 text-right">Avg return</th>
            <th className="px-3 py-3 text-right">Median</th>
            <th className="px-3 py-3 text-right">Win rate</th>
            <th className="px-3 py-3 text-right">Adverse</th>
            <th className="px-3 py-3 text-right">Large gain</th>
            <th className="px-3 py-3 text-right">Drawdown</th>
            <th className="px-3 py-3">Sample</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map(({ axis, bucket }) => (
            <tr className="text-slate-300" key={`${axis.axisId}-${axis.horizon}-${bucket.bucketOrder}`}>
              <td className="px-3 py-3">
                <div className="font-semibold text-slate-100">{axis.axisLabel}</div>
                <div className="mt-1 font-mono text-xs text-slate-500">{axis.horizon}</div>
              </td>
              <td className="px-3 py-3 font-mono text-xs text-slate-300">{bucket.bucketLabel}</td>
              <td className="px-3 py-3 text-right font-mono">{bucket.count.toLocaleString()}</td>
              <td className="px-3 py-3 text-right font-mono">{formatMaybeNumber(bucket.avgSignal)}</td>
              <td className={`px-3 py-3 text-right font-mono ${returnTone(bucket.avgReturnPct)}`}>{formatMaybePct(bucket.avgReturnPct)}</td>
              <td className={`px-3 py-3 text-right font-mono ${returnTone(bucket.medianReturnPct)}`}>{formatMaybePct(bucket.medianReturnPct)}</td>
              <td className="px-3 py-3 text-right font-mono">{formatMaybePct(bucket.winRatePct)}</td>
              <td className="px-3 py-3 text-right font-mono text-amber-100">{formatMaybePct(bucket.adverseRatePct)}</td>
              <td className="px-3 py-3 text-right font-mono text-cyan-100">{formatMaybePct(bucket.largeGainRatePct)}</td>
              <td className={`px-3 py-3 text-right font-mono ${returnTone(bucket.avgDrawdownPct)}`}>{formatMaybePct(bucket.avgDrawdownPct)}</td>
              <td className="px-3 py-3">
                <StatusBadge tone={bucket.sampleSize === "HIGH" ? "good" : bucket.sampleSize === "MEDIUM" ? "default" : "warn"}>{bucket.sampleSize.toLowerCase()}</StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnomalyCard({ summary }: { summary: ScoreCalibrationAnomalySummary }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-slate-100">{summary.label}</div>
        <StatusBadge tone={severityTone(summary.severity)}>{summary.count.toLocaleString()}</StatusBadge>
      </div>
      {summary.examples.length ? (
        <div className="mt-3 space-y-3">
          {summary.examples.map((item) => (
            <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3" key={`${summary.type}-${item.symbol}-${item.signalDate}-${item.horizon}-${item.returnPct}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono text-sm font-semibold text-slate-100">{item.symbol}</div>
                <div className={`font-mono text-xs ${returnTone(item.returnPct)}`}>{formatMaybePct(item.returnPct)} {item.horizon}</div>
              </div>
              <div className="mt-2 text-xs text-slate-500">{item.signalDate ?? "unknown date"} - score {formatMaybeNumber(item.finalScore)} - {item.decision}</div>
              <p className="mt-2 text-sm leading-5 text-slate-400">{item.reason}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No representative examples in the bounded anomaly sample.</p>
      )}
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

function scoreTone(score: number): "default" | "good" | "warn" | "bad" {
  if (score >= 75) return "good";
  if (score < 45) return "warn";
  return "default";
}

function reliabilityTone(label: string): "default" | "good" | "warn" | "bad" {
  if (label.includes("Reliable")) return "good";
  if (label.includes("Insufficient")) return "warn";
  return "default";
}

function severityTone(severity: CalibrationSeverity): "default" | "good" | "warn" | "bad" {
  if (severity === "positive") return "good";
  if (severity === "warning") return "warn";
  return "default";
}

function formatMaybeNumber(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : value.toFixed(1);
}

function formatMaybePct(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : `${value.toFixed(2)}%`;
}

function returnTone(value: number | null): string {
  if (value === null) return "text-slate-400";
  if (value > 0) return "text-emerald-200";
  if (value < 0) return "text-rose-200";
  return "text-slate-300";
}
