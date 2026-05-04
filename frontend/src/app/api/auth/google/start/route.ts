import { NextResponse } from "next/server";
import { createGoogleOAuthState, GOOGLE_OAUTH_STATE_COOKIE, googleAuthUrl, googleOAuthStateCookieOptions } from "@/lib/server/oauth";
import { canonicalAppUrl, rateLimitRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const rateLimited = await rateLimitRequest(request, "auth:google-start", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const state = createGoogleOAuthState();
  const url = googleAuthUrl(state);
  if (!url) {
    return NextResponse.redirect(new URL("/terminal?authError=google_unavailable", canonicalAppUrl()));
  }

  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, googleOAuthStateCookieOptions());
  return response;
}
