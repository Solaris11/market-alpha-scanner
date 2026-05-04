import { NextResponse } from "next/server";
import { createDevLoginSession, devLoginEnabled, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth";
import { rateLimitRequest, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DevLoginPayload = {
  email?: unknown;
};

export async function POST(request: Request) {
  if (!devLoginEnabled()) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const rateLimited = await rateLimitRequest(request, "auth:dev-login", { limit: 10, windowMs: 15 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const payload = (await request.json().catch(() => null)) as DevLoginPayload | null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const session = await createDevLoginSession(payload.email);
    const response = NextResponse.json({
      ok: true,
      user: session.user,
    });
    response.cookies.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign in.";
    if (message === "Enter a valid email address.") {
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Private-beta auth is unavailable." }, { status: 503 });
  }
}
