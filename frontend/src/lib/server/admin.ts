import "server-only";

import { notFound } from "next/navigation";
import type { AuthUser } from "./auth";
import { getCurrentUser } from "./auth";
import { dbQuery } from "./db";
import { requestIp } from "./request-security";
import { isAdminRole, sanitizeAdminAuditMetadata } from "@/lib/security/admin-policy";

export function isAdminUser(user: AuthUser | null): boolean {
  return Boolean(user && isAdminRole(user.role));
}

export async function requireAdminPageUser(): Promise<AuthUser> {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !isAdminUser(user)) notFound();
  return user;
}

export async function writeAdminAuditLog(input: {
  action: string;
  adminUserId: string;
  metadata?: Record<string, unknown>;
  request?: Request;
  targetId?: string | null;
  targetType: string;
}): Promise<void> {
  const metadata = sanitizeAdminAuditMetadata(input.metadata ?? {});
  await dbQuery(
    `
      INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, metadata, ip, user_agent, created_at)
      VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7, now())
    `,
    [
      input.adminUserId,
      cleanText(input.action, 120),
      cleanText(input.targetType, 80),
      input.targetId ? cleanText(input.targetId, 160) : null,
      JSON.stringify(metadata),
      input.request ? requestIp(input.request) : null,
      input.request ? cleanText(input.request.headers.get("user-agent") ?? "", 240) : null,
    ],
  );
}

function cleanText(value: string, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength) || "unknown";
}
