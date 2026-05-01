import { HistoryWorkspace } from "@/components/history-workspace";
import { MetricStrip } from "@/components/metric-strip";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { TerminalShell } from "@/components/shell";
import { getFullRanking, getHistorySummary, getHistorySymbolsFromSnapshots } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return value.replace("T", " ").replace("Z", " UTC");
}

export default async function HistoryPage() {
  const entitlement = await getEntitlement();
  if (!hasPremiumAccess(entitlement)) {
    return (
      <TerminalShell>
        <PremiumLockedState
          authenticated={entitlement.authenticated}
          description="Signal memory, historical symbol timelines, and CSV snapshot exports are premium research tools. Free users can still review the current terminal preview."
          previewItems={["Saved scanner run timeline", "Symbol-by-symbol decision history", "Premium-only CSV history export"]}
          title={entitlement.authenticated ? "History is available on Premium" : "Sign in to preview signal history"}
        />
      </TerminalShell>
    );
  }

  const [history, rawRanking, historySymbols, scanSafety] = await Promise.all([getHistorySummary(), getFullRanking(), getHistorySymbolsFromSnapshots(), getCurrentScanSafety()]);
  const ranking = applyStaleDataSafetyToRows(rawRanking, scanSafety);
  const symbols = Array.from(new Set([...ranking.map((row) => row.symbol), ...historySymbols].filter(Boolean).map((symbol) => String(symbol).trim().toUpperCase()))).sort();
  const defaultSymbol = String(ranking[0]?.symbol ?? symbols[0] ?? "").trim().toUpperCase();

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Saved Runs", value: history.count.toLocaleString(), meta: "signal memory" },
            { label: "Earliest", value: formatDate(history.earliest), meta: "history" },
            { label: "Latest", value: formatDate(history.latest), meta: "history" },
            { label: "Unique Dates", value: history.uniqueDates.length.toLocaleString(), meta: "trading days" },
          ]}
        />

        {!history.snapshots.length ? (
          <section className="terminal-panel rounded-2xl p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">History</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">No Signal Memory Yet</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Run signal refreshes over time to build conviction timelines, performance context, and symbol history.</p>
          </section>
        ) : (
          <HistoryWorkspace defaultSymbol={defaultSymbol} history={history} symbols={symbols} />
        )}
      </div>
    </TerminalShell>
  );
}
