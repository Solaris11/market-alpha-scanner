export type MonitoringSeverity = "critical" | "info" | "warning";
export type MonitoringStatus = "fail" | "ok" | "warn";

export type RequestMetricInput = {
  latencyMs: number;
  method: string;
  route: string;
  statusCode: number;
  userId?: string | null;
};

export const MONITORING_RETENTION_SQL = {
  monitoringEvents: "DELETE FROM monitoring_events WHERE created_at < now() - interval '30 days'",
  requestMetrics: "DELETE FROM request_metrics WHERE created_at < now() - interval '30 days'",
  syntheticCheckResults: "DELETE FROM synthetic_check_results WHERE created_at < now() - interval '30 days'",
  systemMetrics: "DELETE FROM system_metrics WHERE created_at < now() - interval '30 days'",
} as const;

const SENSITIVE_SEGMENT_PATTERNS = [
  /^sess_/i,
  /^csrf/i,
  /^tok_/i,
  /^sk_(test|live)/i,
  /^whsec_/i,
  /^Bearer$/i,
  /^[A-Za-z0-9_-]{32,}$/,
];

export function cleanMonitoringText(value: unknown, maxLength = 500): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

export function sanitizeRouteForMetrics(value: string): string {
  const pathname = safePathname(value);
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => (isSensitiveSegment(segment) ? "[redacted]" : segment.slice(0, 80)));
  return `/${segments.join("/")}`.slice(0, 240) || "/";
}

export function normalizeRequestMetric(input: RequestMetricInput): Required<RequestMetricInput> {
  return {
    latencyMs: clampInteger(input.latencyMs, 0, 3_600_000),
    method: cleanMonitoringText(input.method, 12).toUpperCase() || "GET",
    route: sanitizeRouteForMetrics(input.route),
    statusCode: clampInteger(input.statusCode, 100, 599),
    userId: input.userId ?? null,
  };
}

export function syntheticStatusFromHttp(statusCode: number, allowedStatuses: number[]): MonitoringStatus {
  return allowedStatuses.includes(statusCode) ? "ok" : statusCode >= 500 ? "fail" : "warn";
}

export function monitoringTokenFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.MARKET_ALPHA_MONITORING_TOKEN?.trim() || null;
}

function safePathname(value: string): string {
  try {
    return new URL(value, "https://tradeveto.com").pathname;
  } catch {
    return "/";
  }
}

function isSensitiveSegment(segment: string): boolean {
  const decoded = safeDecode(segment);
  return SENSITIVE_SEGMENT_PATTERNS.some((pattern) => pattern.test(decoded));
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}
