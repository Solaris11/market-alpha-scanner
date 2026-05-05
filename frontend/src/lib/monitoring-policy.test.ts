import assert from "node:assert/strict";
import test from "node:test";
import { MONITORING_RETENTION_SQL, monitoringTokenFromEnv, normalizeRequestMetric, sanitizeRouteForMetrics, syntheticStatusFromHttp } from "./monitoring-policy";

test("request metrics route sanitizer removes query strings and token-like segments", () => {
  assert.equal(sanitizeRouteForMetrics("/api/auth/verify-email?token=secret"), "/api/auth/verify-email");
  assert.equal(sanitizeRouteForMetrics("/api/session/sess_1234567890abcdef"), "/api/session/[redacted]");
  assert.equal(sanitizeRouteForMetrics("/api/item/abcdefghijklmnopqrstuvwxyzABCDEFG123456789"), "/api/item/[redacted]");
});

test("request metrics normalization does not store secrets, raw query strings, or invalid status codes", () => {
  const metric = normalizeRequestMetric({
    latencyMs: 12.4,
    method: "post",
    route: "/api/reset-password/tok_123?password=secret",
    statusCode: 999,
    userId: null,
  });

  assert.equal(metric.method, "POST");
  assert.equal(metric.route, "/api/reset-password/[redacted]");
  assert.equal(metric.statusCode, 599);
  assert.equal(metric.latencyMs, 12);
  assert.doesNotMatch(metric.route, /secret|tok_123/);
});

test("synthetic status maps accepted, warning, and failure HTTP statuses", () => {
  assert.equal(syntheticStatusFromHttp(200, [200]), "ok");
  assert.equal(syntheticStatusFromHttp(401, [200]), "warn");
  assert.equal(syntheticStatusFromHttp(503, [200]), "fail");
});

test("monitoring retention cleanup deletes 30 day old rows from all detail tables", () => {
  assert.match(MONITORING_RETENTION_SQL.requestMetrics, /request_metrics/);
  assert.match(MONITORING_RETENTION_SQL.syntheticCheckResults, /synthetic_check_results/);
  assert.match(MONITORING_RETENTION_SQL.systemMetrics, /system_metrics/);
  assert.match(MONITORING_RETENTION_SQL.monitoringEvents, /monitoring_events/);
  for (const statement of Object.values(MONITORING_RETENTION_SQL)) {
    assert.match(statement, /interval '30 days'/);
  }
});

test("monitoring ingest token does not fall back to the session secret", () => {
  assert.equal(monitoringTokenFromEnv({ MARKET_ALPHA_SESSION_SECRET: "session-secret" } as unknown as NodeJS.ProcessEnv), null);
  assert.equal(monitoringTokenFromEnv({ MARKET_ALPHA_MONITORING_TOKEN: "monitoring-token", MARKET_ALPHA_SESSION_SECRET: "session-secret" } as unknown as NodeJS.ProcessEnv), "monitoring-token");
});
