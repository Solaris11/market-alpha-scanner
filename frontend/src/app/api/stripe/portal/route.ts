import { NextResponse } from "next/server";
import { getBillingSubscriptionForUser } from "@/lib/server/billing";
import { requireUser } from "@/lib/server/access-control";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { stripe, stripeAppBaseUrl } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimited = rateLimitRequest(request, "stripe:portal", { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to manage billing.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  try {
    const subscription = await getBillingSubscriptionForUser(access.user.id);
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ ok: false, message: "No Stripe billing profile is available for this account." }, { status: 404 });
    }

    const portal = await stripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${stripeAppBaseUrl()}/account`,
    });

    return NextResponse.json({ ok: true, url: portal.url });
  } catch (error) {
    console.warn("[stripe] billing portal unavailable", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Billing portal is temporarily unavailable." }, { status: 503 });
  }
}
