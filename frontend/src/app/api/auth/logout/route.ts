import { NextRequest, NextResponse } from "next/server";
import { deleteSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth";
import { clearCsrfCookie, rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rateLimited = await rateLimitRequest(request, "auth:logout", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const csrf = requireCsrf(request);
    if (csrf) return csrf;
  }

  await deleteSessionToken(token).catch(() => undefined);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  clearCsrfCookie(response);
  return response;
}
