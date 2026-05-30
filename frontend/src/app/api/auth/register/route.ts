import { NextResponse } from "next/server";
import { betaSignupDecisionForRequest } from "@/lib/server/beta-access";
import { normalizeAuthEmail, registerWithPassword, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth";
import { recordAnalyticsEvents } from "@/lib/server/analytics";
import { createLoginNotifications } from "@/lib/server/notifications";
import { rateLimitRequest, requestIp, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RegisterPayload = {
  displayName?: unknown;
  email?: unknown;
  inviteCode?: unknown;
  password?: unknown;
  referralCode?: unknown;
  referralShareId?: unknown;
};

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "auth:register", { limit: 3, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const payload = (await request.json().catch(() => null)) as RegisterPayload | null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Unable to create account." }, { status: 400 });
  }

  try {
    const betaDecision = await betaSignupDecisionForRequest({ email: normalizeAuthEmail(payload.email), inviteCode: payload.inviteCode });
    if (!betaDecision.allowed) {
      return NextResponse.json({ ok: false, error: "early_access_required", message: betaDecision.message ?? "Early access signup requires access." }, { status: 403 });
    }

    const session = await registerWithPassword({ ...payload, ip: requestIp(request) });
    await createLoginNotifications(session.user.id).catch((notificationError) => {
      console.warn("[notifications] register notification failed", notificationError instanceof Error ? notificationError.message : notificationError);
    });
    if (typeof payload.referralCode === "string" || typeof payload.referralShareId === "string") {
      await recordAnalyticsEvents({
        events: [{
          deviceType: "unknown",
          eventName: "referral_signup",
          metadata: {
            referralCode: typeof payload.referralCode === "string" ? payload.referralCode : null,
            shareId: typeof payload.referralShareId === "string" ? payload.referralShareId : null,
          },
          occurredAt: new Date().toISOString(),
          pagePath: "/register",
          source: "auth_register",
        }],
        request,
        user: session.user,
      }).catch((analyticsError) => {
        console.warn("[growth] referral signup attribution failed", analyticsError instanceof Error ? analyticsError.message : analyticsError);
      });
    }
    const response = NextResponse.json({ ok: true, user: session.user });
    response.cookies.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    console.warn("[auth] registration failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Unable to create account." }, { status: 400 });
  }
}
