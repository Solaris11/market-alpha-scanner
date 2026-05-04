import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { validAdminRoleMutation } from "@/lib/security/admin-policy";
import { requireAdmin } from "@/lib/server/access-control";
import { writeAdminAuditLog } from "@/lib/server/admin";
import { dbTransaction } from "@/lib/server/db";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UserRoleRow = QueryResultRow & {
  email: string;
  role: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withRequestMetrics(request, "/api/admin/users/[id]/role", async () => updateRole(request, context));
}

async function updateRole(request: Request, context: RouteContext): Promise<Response> {
  const rateLimited = await rateLimitRequest(request, "admin:users:role", { limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as { confirm?: unknown; role?: unknown } | null;
  const validation = validAdminRoleMutation({
    actorUserId: access.user.id,
    confirm: payload?.confirm,
    role: payload?.role,
    targetUserId: id,
  });
  if (!validation.ok) {
    return NextResponse.json({ ok: false, message: "Role change confirmation failed." }, { status: 400 });
  }

  try {
    const result = await dbTransaction(async (db) => {
      const user = await db.query<UserRoleRow>("SELECT email, role FROM users WHERE id = $1::uuid LIMIT 1", [id]);
      const target = user.rows[0];
      if (!target) return { found: false, previousRole: null as string | null, targetEmail: null as string | null };
      await db.query("UPDATE users SET role = $2, updated_at = now() WHERE id = $1::uuid", [id, validation.role]);
      await db.query(
        `
          INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, metadata, ip, user_agent, created_at)
          VALUES ($1::uuid, $2, 'user', $3, $4::jsonb, $5, $6, now())
        `,
        [
          access.user.id,
          "user.role.update",
          id,
          JSON.stringify({ newRole: validation.role, previousRole: target.role, targetEmail: target.email }),
          request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          request.headers.get("user-agent")?.slice(0, 240) ?? null,
        ],
      );
      return { found: true, previousRole: target.role, targetEmail: target.email };
    });
    if (!result.found) return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    return NextResponse.json({ ok: true, role: validation.role });
  } catch (error) {
    console.warn("[admin] role update failed", error instanceof Error ? error.message : error);
    await writeAdminAuditLog({
      action: "user.role.update.failed",
      adminUserId: access.user.id,
      metadata: { reason: "db_error", targetUserId: id },
      request,
      targetId: id,
      targetType: "user",
    }).catch(() => undefined);
    return NextResponse.json({ ok: false, message: "Unable to update user role." }, { status: 500 });
  }
}
