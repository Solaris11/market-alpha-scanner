import Link from "next/link";
import { MetricStrip } from "@/components/metric-strip";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { RunCommandButton } from "@/components/run-command-button";
import { TerminalShell } from "@/components/shell";
import { getAlertOverview } from "@/lib/alerts";
import { getFullRanking, getHistorySummary, getTopCandidates } from "@/lib/scanner-data";
import { getEntitlement } from "@/lib/server/entitlements";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const entitlement = await getEntitlement();
  if (!entitlement.isAdmin) {
    return (
      <TerminalShell>
        <PremiumLockedState
          authenticated={entitlement.authenticated}
          description="Scanner operations are restricted to administrators."
          previewItems={["Signal refresh controls", "Scanner run status", "Alert operation state"]}
          title="Scanner controls are restricted"
        />
      </TerminalShell>
    );
  }

  const [rawRanking, rawTopCandidates, history, alerts, scanSafety] = await Promise.all([getFullRanking(), getTopCandidates(), getHistorySummary(), getAlertOverview({ stateLimit: 25 }), getCurrentScanSafety()]);
  const ranking = applyStaleDataSafetyToRows(rawRanking, scanSafety);
  const topCandidates = applyStaleDataSafetyToRows(rawTopCandidates, scanSafety);

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Signals", value: ranking.length.toLocaleString(), meta: "latest universe" },
            { label: "Top Opportunities", value: topCandidates.length.toLocaleString(), meta: "decision-ready" },
            { label: "Saved Runs", value: history.count.toLocaleString(), meta: "signal memory" },
            { label: "Alert Rules", value: alerts.activeCount.toLocaleString(), meta: "enabled" },
          ]}
        />

        <section className="terminal-panel rounded-2xl p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Signal Refresh</div>
          <h2 className="mt-1 text-xl font-semibold text-slate-50">Refresh Market Signals</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Update opportunities, market context, trade plans, and alert state for the terminal experience.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <RunCommandButton endpoint="/api/run-scanner" label="Refresh Signals" />
            <Link className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition-all duration-200 hover:border-cyan-400/40 hover:bg-white/5 hover:text-cyan-100" href="/advanced">
              Advanced diagnostics
            </Link>
          </div>
        </section>

        <section className="terminal-panel rounded-2xl p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Alerts</div>
          <h2 className="mt-1 text-xl font-semibold text-slate-50">Notification Readiness</h2>
          <div className="mt-2 grid gap-2 text-xs text-slate-400 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">Active rules: {alerts.activeCount.toLocaleString()}</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">Last sent: {alerts.lastSentAt ?? "Never"}</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">Status: {alerts.activeCount ? "Enabled" : "No active rules"}</div>
          </div>
        </section>
      </div>
    </TerminalShell>
  );
}
