import Link from "next/link";
import { AdminEmpty, AdminSection, AdminStatCard, StatusBadge } from "@/components/admin/AdminChrome";
import { getAdminMonitoringSummary, type MonitoringTimeRange } from "@/lib/server/admin-data";
import { formatAdminDate, formatBytes, statusTone } from "../view-utils";

export const dynamic = "force-dynamic";

export default async function AdminMonitoringPage({ searchParams }: { searchParams?: Promise<{ range?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const range = normalizeRange(params.range);
  const monitoring = await getAdminMonitoringSummary(range);
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-2">
        {(["15m", "1h", "6h", "24h"] as const).map((item) => (
          <Link
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${item === range ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/35"}`}
            href={`/admin/monitoring?range=${item}`}
            key={item}
          >
            {item}
          </Link>
        ))}
      </nav>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label={`Requests ${range}`} value={monitoring.requestMetrics.requestsLastHour.toLocaleString()} />
        <AdminStatCard label={`4xx ${range}`} tone={monitoring.requestMetrics.recent4xx ? "warn" : "good"} value={monitoring.requestMetrics.recent4xx.toLocaleString()} />
        <AdminStatCard label={`5xx ${range}`} tone={monitoring.requestMetrics.recent5xx ? "bad" : "good"} value={monitoring.requestMetrics.recent5xx.toLocaleString()} />
        <AdminStatCard label="P95 latency" value={monitoring.requestMetrics.p95LatencyMs === null ? "Unknown" : `${Math.round(monitoring.requestMetrics.p95LatencyMs)}ms`} />
        <AdminStatCard label="CPU" value={monitoring.system.cpuPercent === null ? "Unknown" : `${monitoring.system.cpuPercent}%`} />
        <AdminStatCard label="Memory" value={monitoring.system.memoryPercent === null ? "Unknown" : `${monitoring.system.memoryPercent}%`} />
        <AdminStatCard label="Disk" tone={monitoring.system.diskPercent !== null && monitoring.system.diskPercent > 85 ? "warn" : "default"} value={monitoring.system.diskPercent === null ? "Unknown" : `${monitoring.system.diskPercent}%`} />
        <AdminStatCard label="Backup" tone={statusTone(monitoring.latestBackup?.status)} value={monitoring.latestBackup?.status ?? "unknown"} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminSection title="Requests over time" subtitle="Throughput, p95 latency, and 5xx errors for the selected window.">
          <MetricBars
            bars={monitoring.requestMetrics.series.map((point) => ({
              label: compactTime(point.bucket),
              meta: `${point.requests} req / ${Math.round(point.p95LatencyMs ?? 0)}ms p95`,
              tone: point.errors ? "bad" : "good",
              value: point.requests,
            }))}
          />
        </AdminSection>
        <AdminSection title="System trend" subtitle="CPU and memory samples from host monitoring.">
          <MetricBars
            bars={monitoring.systemSeries.map((point) => ({
              label: compactTime(point.bucket),
              meta: `CPU ${formatMetric(point.cpuPercent)} / MEM ${formatMetric(point.memoryPercent)}`,
              tone: point.cpuPercent !== null && point.cpuPercent > 80 ? "warn" : "default",
              value: Math.max(point.cpuPercent ?? 0, point.memoryPercent ?? 0),
            }))}
          />
        </AdminSection>
      </div>

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
          <div className="space-y-2">
            {monitoring.requestMetrics.slowestRoutes.map((route, index) => (
              <details className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300" key={`${route.route}-${index}`}>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="min-w-0 font-mono text-xs text-slate-100">{route.route}</span>
                    <span className="text-xs text-slate-400">{route.method} · max {route.maxLatencyMs}ms · p95 {route.p95LatencyMs === null ? "n/a" : `${Math.round(route.p95LatencyMs)}ms`}</span>
                  </div>
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
                  <MetricBars bars={[{ label: "P95", meta: `${Math.round(route.p95LatencyMs ?? 0)}ms`, tone: "default", value: route.p95LatencyMs ?? 0 }, { label: "Max", meta: `${route.maxLatencyMs}ms`, tone: route.maxLatencyMs > 2000 ? "warn" : "default", value: route.maxLatencyMs }]} />
                  <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3 text-xs">
                    <div>Requests: {route.count}</div>
                    <div>Errors: {route.errors}</div>
                    <div>Worst status: {route.statusCode}</div>
                    {route.recentErrors.length ? (
                      <div className="mt-2 space-y-1 text-rose-100">
                        {route.recentErrors.map((error) => <div key={`${route.route}-${error.createdAt}-${error.statusCode}`}>{error.statusCode} · {formatAdminDate(error.createdAt)}</div>)}
                      </div>
                    ) : <div className="mt-2 text-emerald-100">No recent errors.</div>}
                  </div>
                </div>
              </details>
            ))}
          </div>
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

function MetricBars({ bars }: { bars: Array<{ label: string; meta: string; tone: "bad" | "default" | "good" | "warn"; value: number }> }) {
  if (!bars.length) return <AdminEmpty>No chart data for this window.</AdminEmpty>;
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  return (
    <div className="space-y-2">
      {bars.slice(-16).map((bar) => (
        <div className="grid grid-cols-[54px_1fr_130px] items-center gap-2 text-xs" key={`${bar.label}-${bar.meta}`}>
          <span className="text-slate-500">{bar.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className={`h-full rounded-full ${barColor(bar.tone)}`} style={{ width: `${Math.max(4, (bar.value / max) * 100)}%` }} />
          </div>
          <span className="truncate text-right text-slate-400">{bar.meta}</span>
        </div>
      ))}
    </div>
  );
}

function barColor(tone: "bad" | "default" | "good" | "warn") {
  if (tone === "bad") return "bg-rose-300";
  if (tone === "good") return "bg-emerald-300";
  if (tone === "warn") return "bg-amber-300";
  return "bg-cyan-300";
}

function normalizeRange(value: string | undefined): MonitoringTimeRange {
  return value === "15m" || value === "6h" || value === "24h" ? value : "1h";
}

function compactTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMetric(value: number | null) {
  return value === null ? "n/a" : `${Math.round(value)}%`;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-slate-100">{value}</div>
    </div>
  );
}
