import { NextResponse } from "next/server";
import { createGoogleOAuthState, GOOGLE_OAUTH_STATE_COOKIE, googleAuthUrl, googleOAuthStateCookieOptions } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const state = createGoogleOAuthState();
  const url = googleAuthUrl(state);
  if (!url) {
    return NextResponse.redirect(new URL("/terminal?authError=google_unavailable", request.url));
  }

  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, googleOAuthStateCookieOptions());
  return response;
}
