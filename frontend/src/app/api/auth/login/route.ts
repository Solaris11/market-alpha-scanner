import { NextResponse } from "next/server";
import { loginWithPassword, normalizeAuthEmail, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth";
import { recordEnterpriseSecurityEvent } from "@/lib/server/enterprise";
import { createLoginNotifications } from "@/lib/server/notifications";
import { rateLimitRequest, requestIp, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginPayload = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const payload = (await request.json().catch(() => null)) as LoginPayload | null;
  const ip = requestIp(request);

  const rateLimited = await rateLimitRequest(request, "auth:login", { limit: 5, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const session = await loginWithPassword({ email: payload?.email, ip, password: payload?.password, request });
    if (!session) {
      return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
    }
    await recordEnterpriseSecurityEvent({ authMethod: "password", eventType: "login.success", ip, request, userId: session.user.id }).catch(() => undefined);
    await createLoginNotifications(session.user.id).catch((notificationError) => {
      console.warn("[notifications] login notification failed", notificationError instanceof Error ? notificationError.message : notificationError);
    });
    const response = NextResponse.json({ ok: true, user: session.user });
    response.cookies.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    console.warn("[auth] login failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
  }
}
