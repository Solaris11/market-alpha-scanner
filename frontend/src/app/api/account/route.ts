import { NextResponse } from "next/server";
import { accountDeletionBlockedBySubscription } from "@/lib/security/account-lifecycle";
import { requireUser } from "@/lib/server/access-control";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth";
import { getDbPool } from "@/lib/server/db";
import { getBillingSubscriptionForUser } from "@/lib/server/billing";
import { clearCsrfCookie, rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const rateLimited = await rateLimitRequest(request, "account:delete", { limit: 5, windowMs: 60 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to delete your account.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  try {
    const subscription = await getBillingSubscriptionForUser(access.user.id);
    if (accountDeletionBlockedBySubscription({ currentPeriodEnd: subscription?.currentPeriodEnd, status: subscription?.status ?? null })) {
      return NextResponse.json({ ok: false, error: "subscription_active", message: "Cancel your active subscription before deleting your account." }, { status: 409 });
    }

    await deleteAccountData(access.user.id);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      ...sessionCookieOptions(),
      maxAge: 0,
    });
    clearCsrfCookie(response);
    return response;
  } catch (error) {
    console.warn("[account] delete failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "account_delete_unavailable", message: "Unable to delete account." }, { status: 503 });
  }
}

async function deleteAccountData(userId: string): Promise<void> {
  const pool = getDbPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const alertRulesExists = await client.query<{ exists: boolean }>("SELECT to_regclass('public.alert_rules') IS NOT NULL AS exists");
    if (alertRulesExists.rows[0]?.exists) {
      await client.query("DELETE FROM alert_rules WHERE user_id = $1", [userId]);
    }
    await client.query("DELETE FROM paper_trade_events WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM paper_positions WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM paper_accounts WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
