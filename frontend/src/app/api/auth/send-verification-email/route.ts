import { after, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { createEmailVerification } from "@/lib/server/email-verification";
import { emailProviderConfigured, sendEmailVerificationEmail } from "@/lib/server/email";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "auth:send-verification-email", { limit: 5, windowMs: 60 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to verify your email.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  if (access.user.emailVerified) {
    return NextResponse.json({ ok: true, message: "Email is already verified." });
  }

  if (!emailProviderConfigured()) {
    return NextResponse.json({ ok: false, error: "email_not_configured", message: "Email verification is temporarily unavailable." }, { status: 503 });
  }

  try {
    const verification = await createEmailVerification(access.user);
    after(() => {
      void sendEmailVerificationEmail({
        expiresAt: verification.expiresAt,
        to: verification.email,
        verificationUrl: verification.verificationUrl,
      });
    });
    return NextResponse.json({ ok: true, message: "Verification email sent." });
  } catch (error) {
    console.warn("[auth] email verification request failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "email_verification_unavailable", message: "Email verification is temporarily unavailable." }, { status: 503 });
  }
}
