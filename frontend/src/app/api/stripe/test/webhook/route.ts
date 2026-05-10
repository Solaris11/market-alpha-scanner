import { STRIPE_TEST_MODE } from "@/lib/security/stripe-mode";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { stripeWebhookResponse } from "../../webhook/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/stripe/test/webhook", () => stripeWebhookResponse(request, STRIPE_TEST_MODE));
}

