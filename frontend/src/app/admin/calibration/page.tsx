import { AdminEmpty, AdminSection, AdminStatCard, StatusBadge } from "@/components/admin/AdminChrome";
import { CalibrationTable } from "@/components/admin/CalibrationTable";
import { getAdminCalibrationSummary } from "@/lib/server/admin-data";
import { formatAdminDate, statusTone } from "../view-utils";

export const dynamic = "force-dynamic";

const GROUP_SECTIONS = [
  { key: "score_bucket", title: "Score bucket vs forward return" },
  { key: "decision", title: "Decision/action vs forward return" },
  { key: "setup_type", title: "Setup type vs forward return" },
  { key: "asset_type", title: "Asset type vs forward return" },
  { key: "market_regime", title: "Market regime vs forward return" },
] as const;

export default async function AdminCalibrationPage() {
  const calibration = await getAdminCalibrationSummary();
  const totalSignals = calibration.distributions.reduce((sum, row) => sum + row.count, 0);
  const enterCount = calibration.distributions.filter((row) => row.decision === "ENTER" || row.decision === "BUY" || row.decision === "STRONG_BUY").reduce((sum, row) => sum + row.count, 0);
  const avoidCount = calibration.distributions.filter((row) => row.decision === "AVOID" || row.decision === "EXIT").reduce((sum, row) => sum + row.count, 0);
  const watchCount = Math.max(0, totalSignals - enterCount - avoidCount);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Forward observations" value={calibration.observationCount.toLocaleString()} />
        <AdminStatCard label="Latest run" meta={formatAdminDate(calibration.latestRun?.completedAt)} tone={statusTone(calibration.latestRun?.status)} value={calibration.latestRun?.status ?? "unknown"} />
        <AdminStatCard label="BUY/ENTER latest" tone={enterCount > 0 ? "warn" : "good"} value={`${enterCount}/${totalSignals || 0}`} />
        <AdminStatCard label="Generated" value={formatAdminDate(calibration.generatedAt)} />
      </section>

      <AdminSection title="Latest decision distribution" subtitle="Current scanner output distribution. Trade-permitted count is derived from the hard-veto diagnostics payload.">
        {calibration.distributions.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            <DistributionCard label="Buy / Enter" total={totalSignals} value={enterCount} />
            <DistributionCard label="Watch / Wait" total={totalSignals} value={watchCount} />
            <DistributionCard label="Avoid / Exit" total={totalSignals} value={avoidCount} />
            {calibration.distributions.map((row) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4" key={row.decision}>
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge tone={row.tradePermittedCount > 0 ? "warn" : statusTone(row.decision)}>{row.decision}</StatusBadge>
                  <span className="font-mono text-sm text-slate-400">{row.count.toLocaleString()}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Metric label="Avg score" value={numberText(row.avgScore)} />
                  <Metric label="Avg conf" value={numberText(row.avgConfidence)} />
                  <Metric label="Permitted" value={row.tradePermittedCount.toLocaleString()} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AdminEmpty>No scanner signal distribution found.</AdminEmpty>
        )}
      </AdminSection>

      {GROUP_SECTIONS.map((section) => (
        <AdminSection key={section.key} title={section.title} subtitle="Counts below 30 are marked low sample and should not be used for tuning by themselves.">
          {calibration.groups[section.key].length ? <CalibrationTable rows={calibration.groups[section.key]} /> : <AdminEmpty>No calibration rows found for {section.title}.</AdminEmpty>}
        </AdminSection>
      ))}
    </div>
  );
}

function DistributionCard({ label, total, value }: { label: string; total: number; value: number }) {
  const share = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/[0.06] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-50">{value.toLocaleString()}</div>
      <div className="mt-1 text-xs text-slate-400">{share.toFixed(1)}% of latest run</div>
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

function numberText(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : value.toFixed(1);
}
