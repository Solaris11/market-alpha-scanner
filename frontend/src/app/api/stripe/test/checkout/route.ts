import { NextResponse } from "next/server";
import { checkoutBlockReason } from "@/lib/security/billing-readiness";
import { STRIPE_TEST_MODE } from "@/lib/security/stripe-mode";
import { getBillingSubscriptionForUser, getOrCreateStripeCustomerForUser } from "@/lib/server/billing";
import { requireUser } from "@/lib/server/access-control";
import { getEntitlementForUser, hasPremiumAccess, legalNotAcceptedResponse, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { stripe, stripeAppBaseUrl, stripeBetaTrialDays, stripePriceId, stripePromotionCodesEnabled, stripeTestModeAllowedForUser, stripeTestModeDeniedMessage } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/stripe/test/checkout", () => checkout(request));
}

async function checkout(request: Request): Promise<Response> {
  const rateLimited = await rateLimitRequest(request, "stripe:test:checkout", { limit: 3, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to run billing QA.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  if (!stripeTestModeAllowedForUser(access.user)) {
    return NextResponse.json({ ok: false, error: "stripe_test_mode_denied", message: stripeTestModeDeniedMessage(access.user) }, { status: 403 });
  }

  const entitlement = await getEntitlementForUser(access.user);
  if (requiresLegalAcceptance(entitlement)) {
    return legalNotAcceptedResponse(entitlement);
  }

  if (checkoutBlockReason({ emailVerified: access.user.emailVerified, legalAccepted: entitlement.legalStatus.allAccepted }) === "email_not_verified") {
    return NextResponse.json({ ok: false, error: "email_not_verified", message: "Verify this QA email before running test checkout." }, { status: 403 });
  }

  try {
    const subscription = await getBillingSubscriptionForUser(access.user.id);
    if (subscription?.stripeMode === "live") {
      return NextResponse.json({ ok: false, error: "live_billing_profile_exists", message: "This account already has a live Stripe billing profile. Use a disposable QA account for test mode." }, { status: 409 });
    }

    if (hasPremiumAccess(entitlement) && subscription?.stripeCustomerId) {
      const portal = await stripe(STRIPE_TEST_MODE).billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${stripeAppBaseUrl()}/account?billing=test_portal_return`,
      });
      return NextResponse.json({ ok: true, mode: STRIPE_TEST_MODE, url: portal.url });
    }

    const customerId = await getOrCreateStripeCustomerForUser(access.user, STRIPE_TEST_MODE);
    const trialPeriodDays = stripeBetaTrialDays(STRIPE_TEST_MODE);
    const session = await stripe(STRIPE_TEST_MODE).checkout.sessions.create({
      allow_promotion_codes: stripePromotionCodesEnabled(STRIPE_TEST_MODE) || undefined,
      cancel_url: `${stripeAppBaseUrl()}/account?checkout=test_cancel`,
      customer: customerId,
      line_items: [{ price: stripePriceId(STRIPE_TEST_MODE), quantity: 1 }],
      metadata: {
        email: access.user.email,
        stripe_mode: STRIPE_TEST_MODE,
        user_id: access.user.id,
      },
      mode: "subscription",
      subscription_data: {
        metadata: {
          email: access.user.email,
          stripe_mode: STRIPE_TEST_MODE,
          user_id: access.user.id,
        },
        ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
      },
      success_url: `${stripeAppBaseUrl()}/account?checkout=test_success`,
    });

    if (!session.url) {
      return NextResponse.json({ ok: false, message: "Stripe test checkout is temporarily unavailable." }, { status: 503 });
    }

    console.info("[stripe:test] checkout session created for allowlisted QA account", { userId: access.user.id });
    return NextResponse.json({ ok: true, mode: STRIPE_TEST_MODE, url: session.url });
  } catch (error) {
    console.warn("[stripe:test] checkout unavailable", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Stripe test checkout is temporarily unavailable." }, { status: 503 });
  }
}

