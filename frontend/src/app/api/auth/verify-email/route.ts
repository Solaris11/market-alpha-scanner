import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/server/email-verification";
import { canonicalAppUrl, rateLimitRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const rateLimited = await rateLimitRequest(request, "auth:verify-email", { limit: 30, windowMs: 60 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  const token = new URL(request.url).searchParams.get("token");
  let verified = false;
  try {
    verified = await verifyEmailToken(token);
  } catch (error) {
    console.warn("[auth] email verification failed", error instanceof Error ? error.message : error);
  }

  const redirectUrl = new URL("/account", canonicalAppUrl());
  redirectUrl.searchParams.set("email", verified ? "verified" : "invalid");
  return NextResponse.redirect(redirectUrl);
}
