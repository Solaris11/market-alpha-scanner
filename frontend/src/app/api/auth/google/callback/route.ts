import { NextRequest, NextResponse } from "next/server";
import { clientIp, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth";
import { authenticateGoogleCode, GOOGLE_OAUTH_STATE_COOKIE, googleOAuthStateCookieOptions } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const redirectUrl = new URL("/terminal", request.url);

  if (!code || !state || !cookieState || state !== cookieState) {
    redirectUrl.searchParams.set("authError", "google_failed");
    return clearState(NextResponse.redirect(redirectUrl));
  }

  try {
    const session = await authenticateGoogleCode(code, clientIp(request));
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
