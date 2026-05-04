import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/server/password-reset";
import { rateLimitRequest, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ResetPasswordPayload = {
  newPassword?: unknown;
  token?: unknown;
};

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "auth:reset-password", { limit: 10, windowMs: 60 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const payload = (await request.json().catch(() => null)) as ResetPasswordPayload | null;
  try {
    const ok = await resetPassword(payload?.token, payload?.newPassword);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Reset link is invalid or expired." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn("[auth] reset password failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Unable to reset password." }, { status: 400 });
  }
}
