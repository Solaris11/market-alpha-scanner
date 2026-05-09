import { AdminEmpty, AdminSection, AdminStatCard, StatusBadge } from "@/components/admin/AdminChrome";
import type { EvidenceDepthSummary } from "@/lib/trading/evidence-depth";
import { evidenceMaturityTone } from "@/lib/trading/evidence-maturity";

export function EvidenceDepthDashboard({ summary }: { summary: EvidenceDepthSummary }) {
  const primaryWindow = summary.windows.find((window) => window.windowLabel === "90D") ?? summary.windows[summary.windows.length - 1] ?? null;
  const duplicateCount = summary.duplicateChecks.reduce((sum, check) => sum + check.duplicateGroups, 0);

  return (
    <AdminSection title="Phase 8.1 Evidence Depth" subtitle="Historical evidence maturity across scanner runs, market memory, shock intelligence, and completed forward outcomes.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Evidence maturity" meta={summary.summary} tone={statusToneForEvidence(summary.label)} value={`${summary.maturityScore}/100`} />
        <AdminStatCard label="Calendar depth" meta="Unique signal days in 90-day view" tone={(primaryWindow?.uniqueSignalDays ?? 0) >= 30 ? "good" : "warn"} value={primaryWindow?.uniqueSignalDays.toLocaleString() ?? "0"} />
        <AdminStatCard label="Completed outcomes" meta="Forward-return rows with returns" tone={(primaryWindow?.completedForwardReturnCount ?? 0) >= 10_000 ? "good" : "warn"} value={primaryWindow?.completedForwardReturnCount.toLocaleString() ?? "0"} />
        <AdminStatCard label="Duplicate groups" meta="Integrity gates must remain zero" tone={duplicateCount === 0 ? "good" : "bad"} value={duplicateCount.toLocaleString()} />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-black uppercase tracking-normal text-cyan-300">30/60/90 Day Evidence Views</div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-normal text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Window</th>
                  <th className="py-2 pr-3 text-right">Runs</th>
                  <th className="py-2 pr-3 text-right">Signals</th>
                  <th className="py-2 pr-3 text-right">Memory</th>
                  <th className="py-2 pr-3 text-right">Symbols</th>
                  <th className="py-2 pr-3 text-right">Days</th>
                  <th className="py-2 text-right">Completed outcomes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {summary.windows.map((window) => (
                  <tr className="text-slate-300" key={window.windowLabel}>
                    <td className="py-2 pr-3 font-mono font-semibold text-slate-100">{window.windowLabel}</td>
                    <td className="py-2 pr-3 text-right font-mono">{window.scanRunCount.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right font-mono">{window.signalCount.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right font-mono">{window.memorySnapshotCount.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right font-mono">{window.uniqueSymbolCount.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right font-mono">{window.uniqueSignalDays.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">{window.completedForwardReturnCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-black uppercase tracking-normal text-amber-200">Remaining Evidence Gaps</div>
          {summary.remainingGaps.length ? (
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              {summary.remainingGaps.map((gap) => <li key={gap}>- {gap}</li>)}
            </ul>
          ) : (
            <AdminEmpty>No major evidence gap is dominant right now.</AdminEmpty>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-black uppercase tracking-normal text-cyan-300">Representative Symbol Coverage</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {summary.representativeSymbols.map((symbol) => (
              <div className="rounded-lg border border-white/10 bg-slate-950/35 p-3" key={symbol.symbol}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-mono text-sm font-black text-slate-50">{symbol.symbol}</div>
                  <StatusBadge tone={statusToneForEvidence(symbol.evidenceMaturity)}>{symbol.evidenceMaturity}</StatusBadge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <MiniMetric label="Signals" value={symbol.scannerSignalCount.toLocaleString()} />
                  <MiniMetric label="Memory" value={symbol.memorySnapshotCount.toLocaleString()} />
                  <MiniMetric label="Outcomes" value={symbol.forwardReturnCount.toLocaleString()} />
                  <MiniMetric label="Depth" value={`${symbol.historicalDepthDays}d`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-black uppercase tracking-normal text-cyan-300">Storage + Integrity</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {summary.tableCounts.map((row) => <MiniMetric key={row.area} label={row.area} value={row.count.toLocaleString()} />)}
          </div>
          <div className="mt-4 grid gap-2">
            {summary.duplicateChecks.map((check) => (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/35 p-3" key={check.label}>
                <div className="text-xs text-slate-300">{check.label}</div>
                <StatusBadge tone={check.duplicateGroups === 0 ? "good" : "bad"}>{check.duplicateGroups.toLocaleString()}</StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminSection>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
      <div className="truncate text-[9px] font-black uppercase leading-3 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100" title={value}>{value}</div>
    </div>
  );
}

function statusToneForEvidence(label: string): "bad" | "default" | "good" | "warn" {
  const tier = label === "High Confidence Evidence" ? "high" : label === "Mature Evidence" ? "mature" : label === "Developing Evidence" ? "developing" : "limited";
  const tone = evidenceMaturityTone(tier);
  if (tone === "good") return "good";
  if (tone === "warn") return "warn";
  return "default";
}
