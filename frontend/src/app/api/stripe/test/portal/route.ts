import { NextResponse } from "next/server";
import { STRIPE_TEST_MODE } from "@/lib/security/stripe-mode";
import { getBillingSubscriptionForUser } from "@/lib/server/billing";
import { requireUser } from "@/lib/server/access-control";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { stripe, stripeAppBaseUrl, stripeTestModeAllowedForUser, stripeTestModeDeniedMessage } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "stripe:test:portal", { limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to manage QA billing.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  if (!stripeTestModeAllowedForUser(access.user)) {
    return NextResponse.json({ ok: false, error: "stripe_test_mode_denied", message: stripeTestModeDeniedMessage(access.user) }, { status: 403 });
  }

  try {
    const subscription = await getBillingSubscriptionForUser(access.user.id, STRIPE_TEST_MODE);
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ ok: false, error: "test_billing_profile_not_found", message: "No Stripe test billing profile is available for this QA account." }, { status: 404 });
    }

    const portal = await stripe(STRIPE_TEST_MODE).billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${stripeAppBaseUrl()}/account?billing=test_portal_return`,
    });

    return NextResponse.json({ ok: true, mode: STRIPE_TEST_MODE, url: portal.url });
  } catch (error) {
    console.warn("[stripe:test] billing portal unavailable", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Stripe test billing portal is temporarily unavailable." }, { status: 503 });
  }
}

