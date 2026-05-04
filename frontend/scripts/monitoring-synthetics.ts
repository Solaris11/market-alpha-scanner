import { loadEnvFiles, monitoringBaseUrl, postMonitoringPayload, safeErrorMessage, statusFromHttp, type MonitoringStatus } from "./monitoring-common";

type SyntheticCheck = {
  allowedStatuses: number[];
  name: string;
  path: string;
  validate?: (statusCode: number, body: unknown) => { message: string; status: MonitoringStatus };
};

type CheckResult = {
  latencyMs: number;
  message: string;
  metadata: Record<string, unknown>;
  name: string;
  status: MonitoringStatus;
};

const checks: SyntheticCheck[] = [
  {
    allowedStatuses: [200],
    name: "api_health",
    path: "/api/health",
  },
  {
    allowedStatuses: [200, 503],
    name: "api_health_deep",
    path: "/api/health/deep",
    validate: (_statusCode, body) => validateDeepHealth(body),
  },
  {
    allowedStatuses: [200],
    name: "anonymous_session",
    path: "/api/session",
    validate: (_statusCode, body) => {
      const authenticated = objectValue(body).authenticated === true;
      return authenticated ? { message: "Anonymous session unexpectedly authenticated.", status: "fail" } : { message: "Anonymous session is safe.", status: "ok" };
    },
  },
  {
    allowedStatuses: [200],
    name: "anonymous_ranking_limited",
    path: "/api/ranking",
    validate: (_statusCode, body) => {
      const payload = objectValue(body);
      return payload.limited === true && Array.isArray(payload.rows) && payload.rows.length === 0
        ? { message: "Anonymous ranking returns limited preview.", status: "ok" }
        : { message: "Anonymous ranking did not return a safe limited preview.", status: "fail" };
    },
  },
  {
    allowedStatuses: [401, 403],
    name: "anonymous_history_denied",
    path: "/api/history/latest",
  },
];

async function main(): Promise<void> {
  loadEnvFiles();
  const results: CheckResult[] = [];
  for (const check of checks) {
    const result = await runCheck(check);
    results.push(result);
    await postMonitoringPayload({
      checkName: result.name,
      kind: "synthetic_check",
      latencyMs: result.latencyMs,
      message: result.message,
      metadata: result.metadata,
      status: result.status,
    });
    if (result.status !== "ok") {
      await postMonitoringPayload({
        eventType: `synthetic:${result.name}`,
        kind: "monitoring_event",
        message: result.message,
        metadata: result.metadata,
        severity: result.status === "fail" ? "critical" : "warning",
        status: result.status,
      });
    }
  }
  console.log(JSON.stringify(summary(results), null, 2));
  if (results.some((result) => result.status === "fail")) process.exitCode = 2;
}

async function runCheck(check: SyntheticCheck): Promise<CheckResult> {
  const startedAt = Date.now();
  const url = `${monitoringBaseUrl()}${check.path}`;
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const latencyMs = Date.now() - startedAt;
    const body = await parseBody(response);
    const validated = check.validate?.(response.status, body);
    const status = validated?.status ?? statusFromHttp(response.status, check.allowedStatuses);
    const message = validated?.message ?? (status === "ok" ? `HTTP ${response.status} accepted.` : `HTTP ${response.status} outside expected range.`);
    return {
      latencyMs,
      message,
      metadata: { expectedStatuses: check.allowedStatuses, httpStatus: response.status, path: check.path },
      name: check.name,
      status,
    };
  } catch (error) {
    return {
      latencyMs: Date.now() - startedAt,
      message: safeErrorMessage(error),
      metadata: { path: check.path },
      name: check.name,
      status: "fail",
    };
  }
}

function validateDeepHealth(body: unknown): { message: string; status: MonitoringStatus } {
  const payload = objectValue(body);
  const db = objectValue(payload.db).status;
  const scanner = objectValue(payload.scanner).status;
  const backup = objectValue(payload.backup).status;
  if (db !== "ok") return { message: "Deep health DB check failed.", status: "fail" };
  if (scanner === "fail") return { message: "Deep health scanner check failed.", status: "fail" };
  if (backup === "fail") return { message: "Deep health backup check failed.", status: "fail" };
  if (scanner === "warn" || backup === "warn" || backup === "unknown") return { message: "Deep health is degraded.", status: "warn" };
  return { message: "Deep health is ok.", status: "ok" };
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { text: text.slice(0, 120) };
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function summary(results: CheckResult[]): Record<string, unknown> {
  return {
    checked: results.length,
    failed: results.filter((result) => result.status === "fail").length,
    ok: results.filter((result) => result.status === "ok").length,
    warned: results.filter((result) => result.status === "warn").length,
  };
}

main().catch((error: unknown) => {
  console.error(`[monitoring:synthetics] failed: ${safeErrorMessage(error)}`);
  process.exit(1);
});
