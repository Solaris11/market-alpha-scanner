import { NextRequest, NextResponse } from "next/server";
import { deleteSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  await deleteSessionToken(token).catch(() => undefined);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
