import { MetricStrip } from "@/components/metric-strip";
import { TerminalShell } from "@/components/shell";
import type { HistorySnapshot } from "@/lib/types";
import { getHistorySummary } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return value.replace("T", " ").replace("Z", " UTC");
}

function timestampMs(snapshot: HistorySnapshot) {
  const value = snapshot.timestamp ?? snapshot.modifiedAt;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function formatDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms)) return "N/A";
  const abs = Math.abs(ms);
  const minutes = abs / 60_000;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function averageInterval(snapshots: HistorySnapshot[]) {
  const ordered = snapshots
    .map(timestampMs)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (ordered.length < 2) return null;
  const intervals = ordered.slice(1).map((value, index) => value - ordered[index]);
  return intervals.reduce((total, value) => total + value, 0) / intervals.length;
}

function snapshotsToday(snapshots: HistorySnapshot[]) {
  const today = new Date().toISOString().slice(0, 10);
  return snapshots.filter((snapshot) => String(snapshot.timestamp ?? snapshot.modifiedAt).slice(0, 10) === today).length;
}

function SnapshotTimeline({ snapshots }: { snapshots: HistorySnapshot[] }) {
  const ordered = snapshots
    .map((snapshot) => timestampMs(snapshot))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (!ordered.length) {
    return <div className="rounded border border-dashed border-slate-700/70 px-3 py-8 text-center text-xs text-slate-500">No snapshot timestamps available.</div>;
  }

  const minTime = ordered[0];
  const maxTime = ordered[ordered.length - 1];
  const width = 720;
  const height = 170;
  const padding = 24;
  const span = Math.max(1, maxTime - minTime);
  const maxY = Math.max(1, ordered.length - 1);
  const points = ordered.map((value, index) => {
    const x = padding + ((value - minTime) / span) * (width - padding * 2);
    const y = height - padding - (index / maxY) * (height - padding * 2);
    return { x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");

  return (
    <div className="terminal-panel overflow-x-auto rounded-md p-3">
      <svg className="min-w-[720px]" height={height} role="img" viewBox={`0 0 ${width} ${height}`} width="100%">
        <title>Snapshots over time</title>
        <line stroke="rgba(148,163,184,0.22)" x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        <line stroke="rgba(148,163,184,0.22)" x1={padding} x2={padding} y1={padding} y2={height - padding} />
        <path d={path} fill="none" stroke="rgb(125,211,252)" strokeWidth="2" />
        {points.map((point, index) => (
          <circle cx={point.x} cy={point.y} fill="rgb(16,185,129)" key={`${point.x}-${index}`} r="3" />
        ))}
        <text fill="rgb(100,116,139)" fontSize="10" x={padding} y={height - 6}>
          {new Date(minTime).toISOString().slice(0, 10)}
        </text>
        <text fill="rgb(100,116,139)" fontSize="10" textAnchor="end" x={width - padding} y={height - 6}>
          {new Date(maxTime).toISOString().slice(0, 10)}
        </text>
      </svg>
    </div>
  );
}

export default async function HistoryPage() {
  const history = await getHistorySummary();
  const avgInterval = averageInterval(history.snapshots);

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

        <section className="terminal-panel rounded-md p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Quick Insights</div>
              <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">Snapshots today:</span> {snapshotsToday(history.snapshots).toLocaleString()}
                </div>
                <div>
                  <span className="text-slate-500">Avg interval:</span> {formatDuration(avgInterval)}
                </div>
              </div>
            </div>
            {history.snapshots[0] ? (
              <a
                className="rounded border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-100 hover:bg-sky-400/15"
                href="/api/history/latest"
              >
                Open latest snapshot
              </a>
            ) : null}
          </div>
        </section>

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
          <>
            <section>
              <div className="mb-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Timeline</div>
                <h2 className="text-lg font-semibold text-slate-50">Snapshots Over Time</h2>
              </div>
              <SnapshotTimeline snapshots={history.snapshots} />
            </section>

            <section>
              <div className="mb-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Snapshots</div>
                <h2 className="text-lg font-semibold text-slate-50">Saved Scans</h2>
              </div>
              <div className="terminal-panel overflow-x-auto rounded-md">
                <table className="w-full min-w-[900px] table-fixed border-collapse text-xs">
                  <colgroup>
                    <col style={{ width: 290 }} />
                    <col style={{ width: 220 }} />
                    <col style={{ width: 120 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 220 }} />
                  </colgroup>
                  <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left">File</th>
                      <th className="px-2 py-1.5 text-left">Timestamp</th>
                      <th className="px-2 py-1.5 text-left">Date</th>
                      <th className="px-2 py-1.5 text-left">Diff From Previous</th>
                      <th className="px-2 py-1.5 text-left">Modified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/90">
                    {history.snapshots.map((snapshot, index) => {
                      const current = timestampMs(snapshot);
                      const previous = index === 0 ? null : timestampMs(history.snapshots[index - 1]);
                      const diff = current !== null && previous !== null ? previous - current : null;
                      const snapshotTime = snapshot.timestamp ?? snapshot.modifiedAt;
                      return (
                        <tr className="hover:bg-sky-400/5" key={snapshot.name}>
                          <td className="truncate px-2 py-1.5 font-mono text-slate-300">{snapshot.name}</td>
                          <td className="truncate px-2 py-1.5 text-slate-300">{formatDate(snapshot.timestamp)}</td>
                          <td className="truncate px-2 py-1.5 text-slate-400">{snapshotTime.slice(0, 10)}</td>
                          <td className="truncate px-2 py-1.5 text-slate-400">{formatDuration(diff)}</td>
                          <td className="truncate px-2 py-1.5 text-slate-400">{formatDate(snapshot.modifiedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </TerminalShell>
  );
}
