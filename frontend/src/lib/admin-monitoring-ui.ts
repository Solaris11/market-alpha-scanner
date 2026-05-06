import type { MonitoringTimeRange } from "@/lib/server/admin-data";

export const MONITORING_TIME_RANGES: MonitoringTimeRange[] = ["15m", "1h", "6h", "24h", "1w", "1m", "6m"];

const SECRET_PARAM_PATTERN = /(token|secret|password|signature|authorization|cookie|csrf|key)=([^&]+)/gi;
const UTC_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
  timeZoneName: "short",
  year: "numeric",
});
const UTC_COMPACT_TIME_FORMAT = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: "UTC",
});

export function normalizeMonitoringRange(value: string | undefined): MonitoringTimeRange {
  return value === "15m" || value === "1h" || value === "6h" || value === "24h" || value === "1w" || value === "1m" || value === "6m" ? value : "1h";
}

export function hasNumericSeriesData(series: Array<{ value: number | null }>): boolean {
  return series.some((point) => point.value !== null && Number.isFinite(point.value));
}

export function sanitizeMonitoringRouteLabel(route: string): string {
  const [path, query] = route.split("?", 2);
  if (!query) return path || "/";
  const redacted = query.replace(SECRET_PARAM_PATTERN, "$1=[redacted]");
  return `${path || "/"}?${redacted}`;
}

export function formatMonitoringPercent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : `${Math.round(value)}%`;
}

export function formatMonitoringMs(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : `${Math.round(value)}ms`;
}

export function formatMonitoringDateTime(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return UTC_DATE_TIME_FORMAT.format(date);
}

export function formatMonitoringCompactTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return UTC_COMPACT_TIME_FORMAT.format(date);
}

export function statusBucket(statusCode: number): "2xx" | "3xx" | "4xx" | "5xx" | "other" {
  if (statusCode >= 200 && statusCode < 300) return "2xx";
  if (statusCode >= 300 && statusCode < 400) return "3xx";
  if (statusCode >= 400 && statusCode < 500) return "4xx";
  if (statusCode >= 500 && statusCode < 600) return "5xx";
  return "other";
}

export function aggregateStatusBuckets(statusCounts: Array<{ count: number; statusCode: number }>): Array<{ count: number; label: string }> {
  const buckets: Record<ReturnType<typeof statusBucket>, number> = {
    "2xx": 0,
    "3xx": 0,
    "4xx": 0,
    "5xx": 0,
    other: 0,
  };
  for (const item of statusCounts) {
    buckets[statusBucket(item.statusCode)] += item.count;
  }
  return Object.entries(buckets)
    .map(([label, count]) => ({ count, label }))
    .filter((item) => item.count > 0);
}
