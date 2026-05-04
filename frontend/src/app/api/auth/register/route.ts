import { NextResponse } from "next/server";
import { registerWithPassword, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth";
import { createLoginNotifications } from "@/lib/server/notifications";
import { rateLimitRequest, requestIp, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RegisterPayload = {
  displayName?: unknown;
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "auth:register", { limit: 3, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const payload = (await request.json().catch(() => null)) as RegisterPayload | null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Unable to create account." }, { status: 400 });
  }

  try {
    const session = await registerWithPassword({ ...payload, ip: requestIp(request) });
    await createLoginNotifications(session.user.id).catch((notificationError) => {
      console.warn("[notifications] register notification failed", notificationError instanceof Error ? notificationError.message : notificationError);
    });
    const response = NextResponse.json({ ok: true, user: session.user });
    response.cookies.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    console.warn("[auth] registration failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Unable to create account." }, { status: 400 });
  }
}
