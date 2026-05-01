import { NextResponse } from "next/server";
import { createPasswordReset } from "@/lib/server/password-reset";
import { canonicalAppUrl, rateLimitRequest, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ForgotPasswordPayload = {
  email?: unknown;
};

export async function POST(request: Request) {
  const rateLimited = rateLimitRequest(request, "auth:forgot-password", { limit: 8, windowMs: 60 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const payload = (await request.json().catch(() => null)) as ForgotPasswordPayload | null;
  const origin = canonicalAppUrl().origin;

  try {
    const resetUrl = await createPasswordReset(payload?.email, origin);
    if (resetUrl && resetLinkLoggingEnabled()) {
      console.info("[auth] password reset link:", resetUrl);
    }
  } catch (error) {
    console.warn("[auth] password reset request failed", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link will be available shortly.",
  });
}

function resetLinkLoggingEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.MARKET_ALPHA_LOG_RESET_LINKS === "true";
}
