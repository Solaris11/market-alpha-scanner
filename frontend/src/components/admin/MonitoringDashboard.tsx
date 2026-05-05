"use client";

import { useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AdminMonitoringSummary, MonitoringTimeRange } from "@/lib/server/admin-data";
import { aggregateStatusBuckets, formatMonitoringMs, formatMonitoringPercent, sanitizeMonitoringRouteLabel } from "@/lib/admin-monitoring-ui";

type Tone = "bad" | "default" | "good" | "warn";

type ChartPoint = {
  bucket: string;
  value: number | null;
};

type ChartSeries = {
  color: string;
  label: string;
  valueFormatter: (value: number | null) => string;
  values: ChartPoint[];
};

type SlowRoute = AdminMonitoringSummary["requestMetrics"]["slowestRoutes"][number];

const COLORS = {
  amber: "#fbbf24",
  cyan: "#67e8f9",
  emerald: "#34d399",
  rose: "#fb7185",
  slate: "#94a3b8",
  violet: "#a78bfa",
};

export function MonitoringDashboard({ monitoring, range }: { monitoring: AdminMonitoringSummary; range: MonitoringTimeRange }) {
  const [expandedRouteKey, setExpandedRouteKey] = useState<string | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<string>(monitoring.syntheticChecks[0]?.checkName ?? "");
  const selectedCheckRows = monitoring.syntheticCheckSeries.filter((row) => row.checkName === selectedCheck);

  const requestSeries = monitoring.requestMetrics.series;
  const systemSeries = monitoring.systemSeries;

  const routeKey = (route: SlowRoute, index: number) => `${route.method}:${route.route}:${index}`;
  const latestSelectedCheck = monitoring.syntheticChecks.find((check) => check.checkName === selectedCheck) ?? monitoring.syntheticChecks[0] ?? null;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={`Requests ${range}`} value={monitoring.requestMetrics.requestsLastHour.toLocaleString()} />
        <MetricCard label={`4xx ${range}`} tone={monitoring.requestMetrics.recent4xx ? "warn" : "good"} value={monitoring.requestMetrics.recent4xx.toLocaleString()} />
        <MetricCard label={`5xx ${range}`} tone={monitoring.requestMetrics.recent5xx ? "bad" : "good"} value={monitoring.requestMetrics.recent5xx.toLocaleString()} />
        <MetricCard label="P95 latency" value={formatMonitoringMs(monitoring.requestMetrics.p95LatencyMs)} />
        <MetricCard label="CPU" value={formatMonitoringPercent(monitoring.system.cpuPercent)} />
        <MetricCard label="Memory" value={formatMonitoringPercent(monitoring.system.memoryPercent)} />
        <MetricCard label="Disk" tone={monitoring.system.diskPercent !== null && monitoring.system.diskPercent > 85 ? "warn" : "default"} value={formatMonitoringPercent(monitoring.system.diskPercent)} />
        <MetricCard label="Backup" tone={statusTone(monitoring.latestBackup?.status)} value={monitoring.latestBackup?.status ?? "unknown"} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartPanel className="xl:col-span-2" subtitle="Request volume from request_metrics for the selected window." title="Request Throughput">
          <TimeSeriesChart
            series={[{
              color: COLORS.cyan,
              label: "Requests",
              valueFormatter: (value) => value === null ? "n/a" : value.toLocaleString(),
              values: requestSeries.map((point) => ({ bucket: point.bucket, value: point.requests })),
            }]}
          />
        </ChartPanel>

        <ChartPanel subtitle="P50 and p95 latency by bucket." title="Latency">
          <TimeSeriesChart
            series={[
              {
                color: COLORS.slate,
                label: "P50",
                valueFormatter: formatMonitoringMs,
                values: requestSeries.map((point) => ({ bucket: point.bucket, value: point.p50LatencyMs })),
              },
              {
                color: COLORS.amber,
                label: "P95",
                valueFormatter: formatMonitoringMs,
                values: requestSeries.map((point) => ({ bucket: point.bucket, value: point.p95LatencyMs })),
              },
            ]}
          />
        </ChartPanel>

        <ChartPanel subtitle="Client and server error counts by bucket." title="Error Rate">
          <TimeSeriesChart
            series={[
              {
                color: COLORS.amber,
                label: "4xx",
                valueFormatter: (value) => value === null ? "n/a" : value.toLocaleString(),
                values: requestSeries.map((point) => ({ bucket: point.bucket, value: point.fourXx })),
              },
              {
                color: COLORS.rose,
                label: "5xx",
                valueFormatter: (value) => value === null ? "n/a" : value.toLocaleString(),
                values: requestSeries.map((point) => ({ bucket: point.bucket, value: point.fiveXx })),
              },
            ]}
          />
        </ChartPanel>

        <ChartPanel subtitle="Host CPU samples from system_metrics." title="CPU Over Time">
          <TimeSeriesChart
            maxY={100}
            series={[{
              color: COLORS.cyan,
              label: "CPU",
              valueFormatter: formatMonitoringPercent,
              values: systemSeries.map((point) => ({ bucket: point.bucket, value: point.cpuPercent })),
            }]}
          />
        </ChartPanel>

        <ChartPanel subtitle="Host memory samples from system_metrics." title="Memory Over Time">
          <TimeSeriesChart
            maxY={100}
            series={[{
              color: COLORS.violet,
              label: "Memory",
              valueFormatter: formatMonitoringPercent,
              values: systemSeries.map((point) => ({ bucket: point.bucket, value: point.memoryPercent })),
            }]}
          />
        </ChartPanel>

        <ChartPanel subtitle="Disk usage percentage with current free-space context." title="Disk Trend">
          <TimeSeriesChart
            footer={`Free: ${formatBytes(monitoring.system.diskFreeBytes)} · Backup dir: ${formatBytes(monitoring.system.backupDirBytes)} · scanner_output: ${formatBytes(monitoring.system.scannerOutputBytes)}`}
            maxY={100}
            series={[{
              color: COLORS.emerald,
              label: "Disk",
              valueFormatter: formatMonitoringPercent,
              values: systemSeries.map((point) => ({ bucket: point.bucket, value: point.diskPercent })),
            }]}
          />
        </ChartPanel>

        <ChartPanel subtitle="Synthetic check latency for the selected probe." title="Synthetic Latency">
          <SyntheticSelector checks={monitoring.syntheticChecks} selectedCheck={selectedCheck} setSelectedCheck={setSelectedCheck} />
          <TimeSeriesChart
            footer={latestSelectedCheck ? `Latest: ${latestSelectedCheck.status} · ${latestSelectedCheck.latencyMs}ms · ${formatDate(latestSelectedCheck.createdAt)}` : undefined}
            series={[{
              color: COLORS.cyan,
              label: selectedCheck || "Synthetic",
              valueFormatter: formatMonitoringMs,
              values: selectedCheckRows.map((point) => ({ bucket: point.bucket, value: point.latencyMs })),
            }]}
          />
        </ChartPanel>

        <ChartPanel subtitle="Synthetic ok/warn/fail result counts by bucket." title="Synthetic Status Timeline">
          <TimeSeriesChart
            series={[
              {
                color: COLORS.emerald,
                label: "OK",
                valueFormatter: countFormatter,
                values: monitoring.syntheticSeries.map((point) => ({ bucket: point.bucket, value: point.ok })),
              },
              {
                color: COLORS.amber,
                label: "Warn",
                valueFormatter: countFormatter,
                values: monitoring.syntheticSeries.map((point) => ({ bucket: point.bucket, value: point.warned })),
              },
              {
                color: COLORS.rose,
                label: "Fail",
                valueFormatter: countFormatter,
                values: monitoring.syntheticSeries.map((point) => ({ bucket: point.bucket, value: point.failed })),
              },
            ]}
          />
        </ChartPanel>

        <ChartPanel subtitle="Backup monitoring events by bucket." title="Backup Freshness Events">
          <TimeSeriesChart
            footer={monitoring.latestBackup ? `${monitoring.latestBackup.status}: ${monitoring.latestBackup.message}` : "No latest backup event found."}
            series={[
              {
                color: COLORS.emerald,
                label: "OK",
                valueFormatter: countFormatter,
                values: monitoring.backupSeries.map((point) => ({ bucket: point.bucket, value: point.ok })),
              },
              {
                color: COLORS.amber,
                label: "Warn",
                valueFormatter: countFormatter,
                values: monitoring.backupSeries.map((point) => ({ bucket: point.bucket, value: point.warned })),
              },
              {
                color: COLORS.rose,
                label: "Fail",
                valueFormatter: countFormatter,
                values: monitoring.backupSeries.map((point) => ({ bucket: point.bucket, value: point.failed })),
              },
            ]}
          />
        </ChartPanel>
      </div>

      <ChartPanel subtitle="Click a route to inspect its own latency trend, status distribution, and recent errors. Query strings are redacted before display." title="Slowest Routes Drilldown">
        {monitoring.requestMetrics.slowestRoutes.length ? (
          <div className="space-y-2">
            {monitoring.requestMetrics.slowestRoutes.map((route, index) => {
              const key = routeKey(route, index);
              const expanded = expandedRouteKey === key;
              const safeRoute = sanitizeMonitoringRouteLabel(route.route);
              return (
                <div className="rounded-xl border border-white/10 bg-slate-950/55" key={key}>
                  <button
                    className="grid w-full gap-3 p-3 text-left text-sm text-slate-300 transition hover:bg-white/[0.03] md:grid-cols-[minmax(0,1fr)_110px_90px_90px_90px]"
                    onClick={() => setExpandedRouteKey(expanded ? null : key)}
                    type="button"
                  >
                    <span className="min-w-0 truncate font-mono text-xs text-slate-100">{route.method} {safeRoute}</span>
                    <MetricPill label="p95" value={formatMonitoringMs(route.p95LatencyMs)} />
                    <MetricPill label="count" value={route.count.toLocaleString()} />
                    <MetricPill label="4xx" tone={route.fourXx ? "warn" : "default"} value={route.fourXx.toLocaleString()} />
                    <MetricPill label="5xx" tone={route.fiveXx ? "bad" : "default"} value={route.fiveXx.toLocaleString()} />
                  </button>
                  {expanded ? <RouteDetail route={route} safeRoute={safeRoute} /> : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState>No request metrics found for this window.</EmptyState>
        )}
      </ChartPanel>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Synthetic Check Details">
          {monitoring.syntheticChecks.length ? (
            <div className="grid gap-2">
              {monitoring.syntheticChecks.map((check) => (
                <button
                  className={`rounded-xl border p-3 text-left transition ${check.checkName === selectedCheck ? "border-cyan-300/35 bg-cyan-400/10" : "border-white/10 bg-white/[0.03] hover:border-cyan-300/25"}`}
                  key={check.checkName}
                  onClick={() => setSelectedCheck(check.checkName)}
                  type="button"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={statusTone(check.status)}>{check.status}</StatusBadge>
                      <span className="text-sm font-semibold text-slate-100">{check.checkName}</span>
                    </div>
                    <span className="text-xs text-slate-500">{check.latencyMs}ms</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{check.message}</p>
                  <div className="mt-1 text-xs text-slate-500">{formatDate(check.createdAt)}</div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState>No synthetic check rows found.</EmptyState>
          )}
        </ChartPanel>

        <ChartPanel title="Monitoring Events">
          {monitoring.appEvents.length ? (
            <div className="grid gap-2">
              {monitoring.appEvents.map((event) => (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={`${event.eventType}-${event.createdAt}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={statusTone(event.severity)}>{event.severity}</StatusBadge>
                    <span className="text-sm font-semibold text-slate-100">{event.eventType}</span>
                    <span className="text-xs text-slate-500">{formatDate(event.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{event.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No monitoring warnings or errors found.</EmptyState>
          )}
        </ChartPanel>
      </div>
    </div>
  );
}

function RouteDetail({ route, safeRoute }: { route: SlowRoute; safeRoute: string }) {
  const statusBuckets = aggregateStatusBuckets(route.statusCounts);
  const maxStatusCount = Math.max(...statusBuckets.map((item) => item.count), 1);
  return (
    <div className="border-t border-white/10 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{safeRoute}</div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <TimeSeriesChart
          height={190}
          series={[
            {
              color: COLORS.amber,
              label: "P95",
              valueFormatter: formatMonitoringMs,
              values: route.series.map((point) => ({ bucket: point.bucket, value: point.p95LatencyMs })),
            },
            {
              color: COLORS.cyan,
              label: "P50",
              valueFormatter: formatMonitoringMs,
              values: route.series.map((point) => ({ bucket: point.bucket, value: point.p50LatencyMs })),
            },
            {
              color: COLORS.rose,
              label: "Errors",
              valueFormatter: countFormatter,
              values: route.series.map((point) => ({ bucket: point.bucket, value: point.errors })),
            },
          ]}
        />
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status Distribution</div>
            {statusBuckets.length ? (
              <div className="mt-3 space-y-2">
                {statusBuckets.map((item) => (
                  <div className="grid grid-cols-[44px_1fr_52px] items-center gap-2 text-xs" key={item.label}>
                    <span className={statusBucketClass(item.label)}>{item.label}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                      <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.max(4, (item.count / maxStatusCount) * 100)}%` }} />
                    </div>
                    <span className="text-right text-slate-400">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No status data for this route.</p>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Errors</div>
            {route.recentErrors.length ? (
              <div className="mt-3 space-y-2 text-xs text-rose-100">
                {route.recentErrors.map((error) => <div key={`${safeRoute}-${error.createdAt}-${error.statusCode}`}>{error.statusCode} · {formatDate(error.createdAt)}</div>)}
              </div>
            ) : (
              <p className="mt-2 text-sm text-emerald-100">No recent errors.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeSeriesChart({ footer, height = 230, maxY, series }: { footer?: string; height?: number; maxY?: number; series: ChartSeries[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const chart = useMemo(() => buildChartModel(series, height, maxY), [height, maxY, series]);

  if (!chart.hasData) {
    return <EmptyState>No time-series data for this window.</EmptyState>;
  }

  const active = activeIndex === null ? null : chart.pointsByIndex[activeIndex];
  const tooltipX = active ? Math.min(Math.max(active.x + 10, 8), chart.width - 190) : 0;
  const tooltipY = active ? Math.min(Math.max(active.minY - 18, 8), height - 92) : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3">
        {series.map((item) => (
          <div className="inline-flex items-center gap-2 text-xs text-slate-400" key={item.label}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color, boxShadow: `0 0 14px ${item.color}` }} />
            {item.label}
          </div>
        ))}
      </div>
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/75 p-2">
        <svg className="block h-auto w-full" role="img" viewBox={`0 0 ${chart.width} ${height}`} xmlns="http://www.w3.org/2000/svg">
          <defs>
            {series.map((item) => (
              <linearGradient id={`${chartId}-area-${safeGradientId(item.label)}`} key={item.label} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={item.color} stopOpacity="0.02" />
              </linearGradient>
            ))}
          </defs>
          {chart.yTicks.map((tick) => (
            <g key={tick.y}>
              <line stroke="rgba(148,163,184,0.14)" x1={chart.paddingLeft} x2={chart.width - chart.paddingRight} y1={tick.y} y2={tick.y} />
              <text fill="rgb(100,116,139)" fontSize="11" textAnchor="end" x={chart.paddingLeft - 8} y={tick.y + 4}>{tick.label}</text>
            </g>
          ))}
          {chart.xTicks.map((tick) => (
            <g key={tick.bucket}>
              <line stroke="rgba(148,163,184,0.10)" x1={tick.x} x2={tick.x} y1={chart.paddingTop} y2={height - chart.paddingBottom} />
              <text fill="rgb(100,116,139)" fontSize="11" textAnchor="middle" x={tick.x} y={height - 8}>{formatCompactTime(tick.bucket)}</text>
            </g>
          ))}
          {chart.seriesPaths.map((item) => (
            <g key={item.label}>
              {item.areaPath ? <path d={item.areaPath} fill={`url(#${chartId}-area-${safeGradientId(item.label)})`} /> : null}
              {item.path ? <path d={item.path} fill="none" stroke={item.color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" style={{ filter: `drop-shadow(0 0 6px ${item.color}55)` }} /> : null}
              {item.points.map((point) => <circle cx={point.x} cy={point.y} fill={item.color} key={`${item.label}-${point.bucket}`} r="2.3" />)}
            </g>
          ))}
          {chart.buckets.map((bucket, index) => {
            const segmentWidth = chart.plotWidth / Math.max(1, chart.buckets.length);
            return (
              <rect
                fill="transparent"
                height={height - chart.paddingTop - chart.paddingBottom}
                key={bucket}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerMove={() => setActiveIndex(index)}
                onPointerLeave={() => setActiveIndex(null)}
                width={segmentWidth}
                x={chart.paddingLeft + Math.max(0, index - 0.5) * segmentWidth}
                y={chart.paddingTop}
              />
            );
          })}
          {active ? (
            <g>
              <line stroke="rgba(125,211,252,0.45)" strokeDasharray="3 4" x1={active.x} x2={active.x} y1={chart.paddingTop} y2={height - chart.paddingBottom} />
              {active.values.map((item) => <circle cx={active.x} cy={item.y} fill={item.color} key={item.label} r="4" stroke="rgb(2,6,23)" strokeWidth="2" />)}
              <rect fill="rgba(2,6,23,0.94)" height={64 + active.values.length * 18} rx="10" stroke="rgba(255,255,255,0.12)" width="180" x={tooltipX} y={tooltipY} />
              <text fill="rgb(226,232,240)" fontSize="12" fontWeight="700" x={tooltipX + 12} y={tooltipY + 21}>{formatDateTime(active.bucket)}</text>
              {active.values.map((item, index) => (
                <text fill={item.color} fontSize="12" key={item.label} x={tooltipX + 12} y={tooltipY + 44 + index * 18}>
                  {item.label}: {item.formatted}
                </text>
              ))}
            </g>
          ) : null}
        </svg>
      </div>
      {footer ? <p className="mt-2 text-xs leading-5 text-slate-500">{footer}</p> : null}
    </div>
  );
}

function buildChartModel(series: ChartSeries[], height: number, requestedMaxY?: number) {
  const width = 720;
  const paddingLeft = 48;
  const paddingRight = 16;
  const paddingTop = 14;
  const paddingBottom = 34;
  const buckets = Array.from(new Set(series.flatMap((item) => item.values.map((point) => point.bucket)))).sort();
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const values = series.flatMap((item) => item.values.map((point) => point.value)).filter((value): value is number => value !== null && Number.isFinite(value));
  const hasData = values.length > 0;
  const minValue = 0;
  const maxValue = Math.max(requestedMaxY ?? 0, ...values, 1);
  const yForValue = (value: number): number => height - paddingBottom - ((value - minValue) / Math.max(1, maxValue - minValue)) * plotHeight;
  const xForIndex = (index: number): number => paddingLeft + (buckets.length <= 1 ? plotWidth / 2 : (index / (buckets.length - 1)) * plotWidth);
  const seriesPaths = series.map((item, seriesIndex) => {
    const points = buckets.flatMap((bucket, index) => {
      const value = item.values.find((point) => point.bucket === bucket)?.value;
      if (value === null || value === undefined || !Number.isFinite(value)) return [];
      return [{ bucket, value, x: xForIndex(index), y: yForValue(value) }];
    });
    const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
    const baseline = height - paddingBottom;
    const areaPath = seriesIndex === 0 && points.length >= 2 ? `${path} L ${points.at(-1)?.x.toFixed(2)} ${baseline} L ${points[0].x.toFixed(2)} ${baseline} Z` : "";
    return { areaPath, color: item.color, label: item.label, path, points };
  });
  const pointsByIndex = buckets.map((bucket, index) => {
    const x = xForIndex(index);
    const activeValues = series.flatMap((item) => {
      const value = item.values.find((point) => point.bucket === bucket)?.value;
      if (value === null || value === undefined || !Number.isFinite(value)) return [];
      return [{ color: item.color, formatted: item.valueFormatter(value), label: item.label, y: yForValue(value) }];
    });
    return { bucket, minY: Math.min(...activeValues.map((item) => item.y), height / 2), values: activeValues, x };
  });
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = minValue + (maxValue - minValue) * (1 - ratio);
    return { label: compactNumber(value), y: paddingTop + ratio * plotHeight };
  });
  const xTicks = buckets.filter((_, index) => buckets.length <= 6 || index % Math.ceil(buckets.length / 6) === 0 || index === buckets.length - 1).map((bucket, index) => ({ bucket, x: xForIndex(buckets.indexOf(bucket) || index) }));
  return { buckets, hasData, paddingBottom, paddingLeft, paddingRight, paddingTop, plotWidth, pointsByIndex, seriesPaths, width, xTicks, yTicks };
}

function SyntheticSelector({ checks, selectedCheck, setSelectedCheck }: { checks: AdminMonitoringSummary["syntheticChecks"]; selectedCheck: string; setSelectedCheck: (value: string) => void }) {
  if (!checks.length) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {checks.map((check) => (
        <button
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${check.checkName === selectedCheck ? "border-cyan-300/45 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-cyan-300/35"}`}
          key={check.checkName}
          onClick={() => setSelectedCheck(check.checkName)}
          type="button"
        >
          {check.checkName}
        </button>
      ))}
    </div>
  );
}

function ChartPanel({ children, className = "", subtitle, title }: { children: ReactNode; className?: string; subtitle?: string; title: string }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl ${className}`}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, tone = "default" }: { label: string; tone?: Tone; value: ReactNode }) {
  const toneClass = {
    bad: "border-rose-300/25 bg-rose-400/[0.08] text-rose-100",
    default: "border-white/10 bg-white/[0.03] text-slate-50",
    good: "border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100",
    warn: "border-amber-300/25 bg-amber-400/[0.08] text-amber-100",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function MetricPill({ label, tone = "default", value }: { label: string; tone?: Tone; value: string }) {
  const color = tone === "bad" ? "text-rose-100" : tone === "warn" ? "text-amber-100" : "text-slate-200";
  return (
    <span className={`rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs ${color}`}>
      <span className="mr-1 text-slate-500">{label}</span>{value}
    </span>
  );
}

function StatusBadge({ children, tone = "default" }: { children: ReactNode; tone?: Tone }) {
  const toneClass = {
    bad: "border-rose-300/25 bg-rose-400/10 text-rose-100",
    default: "border-white/10 bg-white/[0.04] text-slate-200",
    good: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    warn: "border-amber-300/25 bg-amber-400/10 text-amber-100",
  }[tone];
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${toneClass}`}>{children}</span>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">{children}</div>;
}

function statusTone(status: string | null | undefined): Tone {
  const normalized = String(status ?? "").toLowerCase();
  if (["ok", "success", "active", "trialing", "healthy"].includes(normalized)) return "good";
  if (["warn", "warning", "pending", "past_due", "stale"].includes(normalized)) return "warn";
  if (["error", "fail", "failed", "missing", "canceled", "unpaid", "inactive"].includes(normalized)) return "bad";
  return "default";
}

function statusBucketClass(label: string): string {
  if (label === "5xx") return "text-rose-100";
  if (label === "4xx") return "text-amber-100";
  if (label === "2xx") return "text-emerald-100";
  return "text-slate-300";
}

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let next = Math.max(0, value);
  let unitIndex = 0;
  while (next >= 1024 && unitIndex < units.length - 1) {
    next /= 1024;
    unitIndex += 1;
  }
  return `${next.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function countFormatter(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : value.toLocaleString();
}

function compactNumber(value: number): string {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return `${Math.round(value)}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatCompactTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function safeGradientId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
