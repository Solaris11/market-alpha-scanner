import { NextResponse } from "next/server";
import { loginWithPassword, normalizeAuthEmail, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth";
import { createLoginNotifications } from "@/lib/server/notifications";
import { rateLimitRequest, requestIp, validateMutationRequest } from "@/lib/server/request-security";
import { rateLimitExceededResponse, tooManyAttempts } from "@/lib/server/rate-limit";

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
  const email = normalizeAuthEmail(payload?.email);
  const ip = requestIp(request);
  const rateLimitKey = `login:${ip}:${email ?? "invalid"}`;

  if (tooManyAttempts(rateLimitKey, { limit: 8, windowMs: 15 * 60 * 1000 })) {
    return rateLimitExceededResponse();
  }

  const rateLimited = rateLimitRequest(request, "auth:login", { limit: 30, windowMs: 15 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  try {
    const session = await loginWithPassword({ email: payload?.email, ip, password: payload?.password });
    if (!session) {
      return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
    }
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
