import { NextResponse } from "next/server";
import { createDevLoginSession, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DevLoginPayload = {
  email?: unknown;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as DevLoginPayload | null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const session = await createDevLoginSession(payload.email);
    const response = NextResponse.json({
      ok: true,
      user: session.user,
      note: "Private-beta email auth. No password is configured yet.",
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
