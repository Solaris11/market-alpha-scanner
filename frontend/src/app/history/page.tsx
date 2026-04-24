import { MetricStrip } from "@/components/metric-strip";
import { TerminalShell } from "@/components/shell";
import { getHistorySummary } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return value.replace("T", " ").replace("Z", " UTC");
}

export default async function HistoryPage() {
  const history = await getHistorySummary();

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Snapshots", value: history.count.toLocaleString(), meta: "scan_*.csv" },
            { label: "Earliest", value: formatDate(history.earliest), meta: "history" },
            { label: "Latest", value: formatDate(history.latest), meta: "history" },
            { label: "Unique Dates", value: history.uniqueDates.length.toLocaleString(), meta: "trading days" },
          ]}
        />

        {!history.snapshots.length ? (
          <section className="terminal-panel rounded-md p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">History</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">No Historical Snapshots Found</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Save scanner snapshots to enable history and later performance analysis.</p>
            <pre className="mt-3 overflow-x-auto rounded border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
              python investment_scanner_mvp.py --save-history
            </pre>
          </section>
        ) : (
          <section>
            <div className="mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Snapshots</div>
              <h2 className="text-lg font-semibold text-slate-50">Saved Scans</h2>
            </div>
            <div className="terminal-panel overflow-hidden rounded-md">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] border-b border-slate-700/70 bg-slate-950/70 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <div>File</div>
                <div>Snapshot Time</div>
                <div>Modified</div>
              </div>
              <div className="divide-y divide-slate-800/90">
                {history.snapshots.map((snapshot) => (
                  <div className="grid grid-cols-[1.2fr_1fr_1fr] px-2 py-1.5 text-xs text-slate-300" key={snapshot.name}>
                    <div className="truncate font-mono">{snapshot.name}</div>
                    <div className="truncate">{formatDate(snapshot.timestamp)}</div>
                    <div className="truncate">{formatDate(snapshot.modifiedAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </TerminalShell>
  );
}
