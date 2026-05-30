import { NextResponse } from "next/server";
import { checkoutBlockReason } from "@/lib/security/billing-readiness";
import { STRIPE_LIVE_MODE } from "@/lib/security/stripe-mode";
import { getBillingSubscriptionForUser, getOrCreateStripeCustomerForUser } from "@/lib/server/billing";
import { requireUser } from "@/lib/server/access-control";
import { getEntitlementForUser, hasPremiumAccess, legalNotAcceptedResponse, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { stripe, stripeAppBaseUrl, stripeBetaTrialDays, stripePriceId, stripePromotionCodesEnabled } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckoutPayload = {
  organicLandingPath?: unknown;
  organicSearchEngine?: unknown;
  organicSource?: unknown;
  referralCode?: unknown;
  referralShareId?: unknown;
};

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/stripe/checkout", () => checkout(request));
}

async function checkout(request: Request): Promise<Response> {
  const rateLimited = await rateLimitRequest(request, "stripe:checkout", { limit: 5, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to upgrade.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const entitlement = await getEntitlementForUser(access.user);
  if (requiresLegalAcceptance(entitlement)) {
    return legalNotAcceptedResponse(entitlement);
  }

  if (checkoutBlockReason({ emailVerified: access.user.emailVerified, legalAccepted: entitlement.legalStatus.allAccepted }) === "email_not_verified") {
    return NextResponse.json({ ok: false, error: "email_not_verified", message: "Verify your email before upgrading." }, { status: 403 });
  }

  try {
    const payload = (await request.json().catch(() => null)) as CheckoutPayload | null;
    const referralCode = normalizeStripeReferralField(payload?.referralCode);
    const referralShareId = normalizeStripeReferralField(payload?.referralShareId);
    const organicLandingPath = normalizeStripeOrganicPath(payload?.organicLandingPath);
    const organicSearchEngine = normalizeStripeReferralField(payload?.organicSearchEngine);
    const organicSource = normalizeStripeReferralField(payload?.organicSource);
    const appBaseUrl = stripeAppBaseUrl();
    const subscription = await getBillingSubscriptionForUser(access.user.id, STRIPE_LIVE_MODE);

    if (hasPremiumAccess(entitlement)) {
      if (subscription?.stripeCustomerId) {
        const portal = await stripe().billingPortal.sessions.create({
          customer: subscription.stripeCustomerId,
          return_url: `${appBaseUrl}/account?billing=portal_return`,
        });
        return NextResponse.json({ ok: true, url: portal.url });
      }
      return NextResponse.json({ ok: false, message: "Premium access is already active on this account." }, { status: 409 });
    }

    const customerId = await getOrCreateStripeCustomerForUser(access.user, STRIPE_LIVE_MODE);
    const trialPeriodDays = stripeBetaTrialDays(STRIPE_LIVE_MODE);
    const session = await stripe(STRIPE_LIVE_MODE).checkout.sessions.create({
      allow_promotion_codes: stripePromotionCodesEnabled(STRIPE_LIVE_MODE) || undefined,
      cancel_url: `${appBaseUrl}/account?checkout=cancel`,
      customer: customerId,
      line_items: [{ price: stripePriceId(STRIPE_LIVE_MODE), quantity: 1 }],
      metadata: {
        email: access.user.email,
        organic_landing_path: organicLandingPath ?? "",
        organic_search_engine: organicSearchEngine ?? "",
        organic_source: organicSource ?? "",
        referral_code: referralCode ?? "",
        referral_share_id: referralShareId ?? "",
        stripe_mode: STRIPE_LIVE_MODE,
        user_id: access.user.id,
      },
      mode: "subscription",
      subscription_data: {
        metadata: {
          email: access.user.email,
          organic_landing_path: organicLandingPath ?? "",
          organic_search_engine: organicSearchEngine ?? "",
          organic_source: organicSource ?? "",
          referral_code: referralCode ?? "",
          referral_share_id: referralShareId ?? "",
          stripe_mode: STRIPE_LIVE_MODE,
          user_id: access.user.id,
        },
        ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
      },
      success_url: `${appBaseUrl}/account?checkout=success`,
    });

    if (!session.url) {
      return NextResponse.json({ ok: false, message: "Checkout is temporarily unavailable." }, { status: 503 });
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.warn("[stripe] checkout unavailable", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Checkout is temporarily unavailable." }, { status: 503 });
  }
}

function normalizeStripeReferralField(value: unknown): string | null {
  const text = String(value ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return text || null;
}

function normalizeStripeOrganicPath(value: unknown): string | null {
  const text = String(value ?? "").trim().replace(/[^A-Za-z0-9/_\-.]/g, "").slice(0, 160);
  return text.startsWith("/") ? text : null;
}
