import { NextResponse } from "next/server";
import { normalizeNotificationId } from "@/lib/notifications";
import { requireUser } from "@/lib/server/access-control";
import { markNotificationRead } from "@/lib/server/notifications";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReadPayload = {
  id?: unknown;
};

export async function POST(request: Request) {
  const rateLimited = rateLimitRequest(request, "notifications:read-write", { limit: 120, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to update notifications.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = (await request.json().catch(() => null)) as ReadPayload | null;
  const id = normalizeNotificationId(payload?.id);
  if (!id) {
    return NextResponse.json({ ok: false, error: "invalid_notification" }, { status: 400 });
  }

  try {
    const updated = await markNotificationRead(access.user.id, id);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "notification_not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn("[notifications] mark read failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "notification_update_unavailable" }, { status: 503 });
  }
}
