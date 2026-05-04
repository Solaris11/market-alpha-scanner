import { NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/server/email";
import { createPasswordReset } from "@/lib/server/password-reset";
import { rateLimitRequest, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ForgotPasswordPayload = {
  email?: unknown;
};

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "auth:forgot-password", { limit: 5, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const payload = (await request.json().catch(() => null)) as ForgotPasswordPayload | null;

  try {
    const resetRequest = await createPasswordReset(payload?.email);
    if (resetRequest) {
      await sendPasswordResetEmail({
        expiresAt: resetRequest.expiresAt,
        resetUrl: resetRequest.resetUrl,
        to: resetRequest.email,
      });
    }
  } catch (error) {
    console.warn("[auth] password reset request failed", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({
    ok: true,
    message: "If that email exists, a reset link has been sent.",
  });
}
