import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
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

type AlertRow = QueryResultRow & {
  is_active: boolean;
  symbol: string | null;
  user_id: string | null;
};

export async function POST(request: Request, context: RouteContext) {
  return withRequestMetrics(request, "/api/admin/alerts/rules/[id]/disable", async () => disableRule(request, context));
}

async function disableRule(request: Request, context: RouteContext): Promise<Response> {
  const rateLimited = await rateLimitRequest(request, "admin:alerts:disable", { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const { id } = await context.params;
  try {
    const result = await dbTransaction(async (db) => {
      const current = await db.query<AlertRow>("SELECT user_id::text, symbol, is_active FROM alert_rules WHERE id = $1 LIMIT 1", [id]);
      const row = current.rows[0];
      if (!row) return { found: false };
      await db.query("UPDATE alert_rules SET is_active = false, updated_at = now() WHERE id = $1", [id]);
      await db.query(
        `
          INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, metadata, ip, user_agent, created_at)
          VALUES ($1::uuid, 'alert_rule.disable', 'alert_rule', $2, $3::jsonb, $4, $5, now())
        `,
        [
          access.user.id,
          id,
          JSON.stringify({ previousActive: row.is_active, symbol: row.symbol, userId: row.user_id }),
          request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          request.headers.get("user-agent")?.slice(0, 240) ?? null,
        ],
      );
      return { found: true };
    });
    if (!result.found) return NextResponse.json({ ok: false, message: "Alert rule not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn("[admin] alert disable failed", error instanceof Error ? error.message : error);
    await writeAdminAuditLog({
      action: "alert_rule.disable.failed",
      adminUserId: access.user.id,
      metadata: { reason: "db_error", ruleId: id },
      request,
      targetId: id,
      targetType: "alert_rule",
    }).catch(() => undefined);
    return NextResponse.json({ ok: false, message: "Unable to disable alert rule." }, { status: 500 });
  }
}
