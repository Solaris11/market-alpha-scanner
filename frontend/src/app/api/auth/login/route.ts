import { NextResponse } from "next/server";
import { clientIp, loginWithPassword, normalizeAuthEmail, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth";
import { tooManyAttempts } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginPayload = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as LoginPayload | null;
  const email = normalizeAuthEmail(payload?.email);
  const ip = clientIp(request) ?? "unknown";
  const rateLimitKey = `login:${ip}:${email ?? "invalid"}`;

  if (tooManyAttempts(rateLimitKey, { limit: 8, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 });
  }

  try {
    const session = await loginWithPassword({ email: payload?.email, ip, password: payload?.password });
    if (!session) {
      return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true, user: session.user });
    response.cookies.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    console.warn("[auth] login failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
  }
}
