import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { listNotifications } from "@/lib/server/notifications";
import { rateLimitRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const rateLimited = await rateLimitRequest(request, "notifications:read", { limit: 120, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const access = await requireUser("Sign in to view notifications.");
  if (!access.ok) return access.response;

  try {
    const payload = await listNotifications(access.user.id);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    console.warn("[notifications] list failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "notifications_unavailable" }, { status: 503 });
  }
}
