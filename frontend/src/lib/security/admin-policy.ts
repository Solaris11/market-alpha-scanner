export type UserRole = "user" | "admin";

export type AdminAccessState = "authenticated_admin" | "authenticated_non_admin" | "unauthenticated";

const SENSITIVE_KEY_PATTERN = /authorization|cookie|password|secret|token|api[_-]?key|smtp|stripe_secret|webhook/i;

export function normalizeUserRole(value: unknown): UserRole {
  return value === "admin" ? "admin" : "user";
}

export function adminAccessState(input: { role?: unknown } | null): AdminAccessState {
  if (!input) return "unauthenticated";
  return normalizeUserRole(input.role) === "admin" ? "authenticated_admin" : "authenticated_non_admin";
}

export function isAdminRole(value: unknown): boolean {
  return normalizeUserRole(value) === "admin";
}

export function validAdminRoleMutation(input: { actorUserId: string; confirm?: unknown; role?: unknown; targetUserId: string }): { ok: true; role: UserRole } | { ok: false; reason: string } {
  if (input.role !== "user" && input.role !== "admin") {
    return { ok: false, reason: "invalid_role" };
  }
  const role = normalizeUserRole(input.role);
  const confirm = String(input.confirm ?? "").trim();
  if (input.actorUserId === input.targetUserId && role !== "admin") {
    return { ok: false, reason: "cannot_demote_self" };
  }
  if (role === "admin" && confirm !== "PROMOTE ADMIN") {
    return { ok: false, reason: "confirmation_required" };
  }
  if (role === "user" && confirm !== "DEMOTE ADMIN") {
    return { ok: false, reason: "confirmation_required" };
  }
  return { ok: true, role };
}

export function sanitizeAdminAuditMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input).slice(0, 40)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    safe[safeKey(key)] = safeValue(value);
  }
  return safe;
}

function safeKey(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9:_.-]/g, "_").slice(0, 120) || "field";
}

function safeValue(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 240);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeValue(item));
  if (typeof value === "object") return sanitizeAdminAuditMetadata(value as Record<string, unknown>);
  return String(value).slice(0, 120);
}
