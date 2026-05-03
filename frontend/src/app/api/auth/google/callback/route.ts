import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth";
import { createLoginNotifications } from "@/lib/server/notifications";
import { authenticateGoogleCode, GOOGLE_OAUTH_STATE_COOKIE, googleOAuthStateCookieOptions } from "@/lib/server/oauth";
import { canonicalAppUrl, rateLimitRequest, requestIp } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rateLimited = rateLimitRequest(request, "auth:google-callback", { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const redirectUrl = new URL("/terminal", canonicalAppUrl());

  if (!code || !state || !cookieState || state !== cookieState) {
    redirectUrl.searchParams.set("authError", "google_failed");
    return clearState(NextResponse.redirect(redirectUrl));
  }

  try {
    const session = await authenticateGoogleCode(code, requestIp(request));
    await createLoginNotifications(session.user.id).catch((notificationError) => {
      console.warn("[notifications] google login notification failed", notificationError instanceof Error ? notificationError.message : notificationError);
    });
    const response = clearState(NextResponse.redirect(redirectUrl));
    response.cookies.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    console.warn("[auth] google oauth failed", error instanceof Error ? error.message : error);
    redirectUrl.searchParams.set("authError", "google_failed");
    return clearState(NextResponse.redirect(redirectUrl));
  }
}

function clearState(response: NextResponse): NextResponse {
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    ...googleOAuthStateCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
