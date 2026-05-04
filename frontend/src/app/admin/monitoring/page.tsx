import { AdminEmpty, AdminSection, AdminStatCard, AdminTable, StatusBadge } from "@/components/admin/AdminChrome";
import { getAdminMonitoringSummary } from "@/lib/server/admin-data";
import { formatAdminDate, formatBytes, statusTone } from "../view-utils";

export const dynamic = "force-dynamic";

export default async function AdminMonitoringPage() {
  const monitoring = await getAdminMonitoringSummary();
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Requests last hour" value={monitoring.requestMetrics.requestsLastHour.toLocaleString()} />
        <AdminStatCard label="4xx last hour" tone={monitoring.requestMetrics.recent4xx ? "warn" : "good"} value={monitoring.requestMetrics.recent4xx.toLocaleString()} />
        <AdminStatCard label="5xx last hour" tone={monitoring.requestMetrics.recent5xx ? "bad" : "good"} value={monitoring.requestMetrics.recent5xx.toLocaleString()} />
        <AdminStatCard label="P95 latency" value={monitoring.requestMetrics.p95LatencyMs === null ? "Unknown" : `${Math.round(monitoring.requestMetrics.p95LatencyMs)}ms`} />
        <AdminStatCard label="CPU" value={monitoring.system.cpuPercent === null ? "Unknown" : `${monitoring.system.cpuPercent}%`} />
        <AdminStatCard label="Memory" value={monitoring.system.memoryPercent === null ? "Unknown" : `${monitoring.system.memoryPercent}%`} />
        <AdminStatCard label="Disk" tone={monitoring.system.diskPercent !== null && monitoring.system.diskPercent > 85 ? "warn" : "default"} value={monitoring.system.diskPercent === null ? "Unknown" : `${monitoring.system.diskPercent}%`} />
        <AdminStatCard label="Backup" tone={statusTone(monitoring.latestBackup?.status)} value={monitoring.latestBackup?.status ?? "unknown"} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminSection title="Synthetic checks">
          {monitoring.syntheticChecks.length ? (
            <div className="grid gap-2">
              {monitoring.syntheticChecks.map((check) => (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={check.checkName}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={statusTone(check.status)}>{check.status}</StatusBadge>
                      <span className="text-sm font-semibold text-slate-100">{check.checkName}</span>
                    </div>
                    <span className="text-xs text-slate-500">{check.latencyMs}ms</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{check.message}</p>
                  <div className="mt-1 text-xs text-slate-500">{formatAdminDate(check.createdAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmpty>No synthetic check rows found.</AdminEmpty>
          )}
        </AdminSection>

        <AdminSection title="System metrics">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Info label="Disk free" value={formatBytes(monitoring.system.diskFreeBytes)} />
            <Info label="Backup dir" value={formatBytes(monitoring.system.backupDirBytes)} />
            <Info label="scanner_output" value={formatBytes(monitoring.system.scannerOutputBytes)} />
            <Info label="Updated" value={formatAdminDate(monitoring.system.updatedAt)} />
          </dl>
        </AdminSection>
      </div>

      <AdminSection title="Slowest routes">
        {monitoring.requestMetrics.slowestRoutes.length ? (
          <AdminTable>
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Route</th>
                  <th className="px-3 py-3">Method</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {monitoring.requestMetrics.slowestRoutes.map((route, index) => (
                  <tr className="text-slate-300" key={`${route.route}-${index}`}>
                    <td className="px-3 py-3 font-mono text-xs">{route.route}</td>
                    <td className="px-3 py-3">{route.method}</td>
                    <td className="px-3 py-3">{route.statusCode}</td>
                    <td className="px-3 py-3">{route.latencyMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        ) : (
          <AdminEmpty>No request metrics found for the last hour.</AdminEmpty>
        )}
      </AdminSection>

      <AdminSection title="Monitoring events">
        {monitoring.appEvents.length ? (
          <div className="grid gap-2">
            {monitoring.appEvents.map((event) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={`${event.eventType}-${event.createdAt}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={statusTone(event.severity)}>{event.severity}</StatusBadge>
                  <span className="text-sm font-semibold text-slate-100">{event.eventType}</span>
                  <span className="text-xs text-slate-500">{formatAdminDate(event.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{event.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <AdminEmpty>No monitoring warnings or errors found.</AdminEmpty>
        )}
      </AdminSection>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-slate-100">{value}</div>
    </div>
  );
}
