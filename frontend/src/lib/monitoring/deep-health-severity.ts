// Pure classification of the /api/health/deep body into a monitoring severity.
// Extracted from the synthetic monitor so it is unit-testable and cannot drift
// from the endpoint's own contract:
//   ok = db === "ok" && scanner !== "fail" && backup !== "failed"
// (see src/lib/server/monitoring.ts deepHealth). The backup component status is
// "ok" | "warn" | "failed" | "unknown" (src/lib/backup-health.ts) -- never the
// string "fail", so the check must compare against "failed".
export type DeepHealthSeverity = "ok" | "warn" | "fail";

function statusOf(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const status = (value as Record<string, unknown>).status;
    return typeof status === "string" ? status : "";
  }
  return "";
}

export function classifyDeepHealthSeverity(body: unknown): { message: string; status: DeepHealthSeverity } {
  const payload = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const db = statusOf(payload.db);
  const scanner = statusOf(payload.scanner);
  const backup = statusOf(payload.backup);
  if (db !== "ok") return { message: "Deep health DB check failed.", status: "fail" };
  if (scanner === "fail") return { message: "Deep health scanner check failed.", status: "fail" };
  if (backup === "failed") return { message: "Deep health backup check failed.", status: "fail" };
  if (scanner === "warn" || backup === "warn" || backup === "unknown") return { message: "Deep health is degraded.", status: "warn" };
  return { message: "Deep health is ok.", status: "ok" };
}
