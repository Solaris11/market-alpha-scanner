import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { markAllNotificationsRead } from "@/lib/server/notifications";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "notifications:read-all", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to update notifications.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  try {
    const updated = await markAllNotificationsRead(access.user.id);
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.warn("[notifications] mark all read failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "notification_update_unavailable" }, { status: 503 });
  }
}
