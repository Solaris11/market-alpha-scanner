import { NextResponse } from "next/server";
import { checkoutBlockReason } from "@/lib/security/billing-readiness";
import { getBillingSubscriptionForUser, getOrCreateStripeCustomerForUser } from "@/lib/server/billing";
import { requireUser } from "@/lib/server/access-control";
import { getEntitlementForUser, hasPremiumAccess, legalNotAcceptedResponse, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { stripe, stripeAppBaseUrl, stripePriceId } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimited = rateLimitRequest(request, "stripe:checkout", { limit: 10, windowMs: 60_000 });
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
    const appBaseUrl = stripeAppBaseUrl();
    const subscription = await getBillingSubscriptionForUser(access.user.id);

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

    const customerId = await getOrCreateStripeCustomerForUser(access.user);
    const session = await stripe().checkout.sessions.create({
      cancel_url: `${appBaseUrl}/account?checkout=cancel`,
      customer: customerId,
      line_items: [{ price: stripePriceId(), quantity: 1 }],
      metadata: {
        email: access.user.email,
        user_id: access.user.id,
      },
      mode: "subscription",
      subscription_data: {
        metadata: {
          email: access.user.email,
          user_id: access.user.id,
        },
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
