import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { createDeveloperWebhookEndpoint, listDeveloperWebhookDeliveries, listDeveloperWebhookEndpoints, DeveloperApiAuthError } from "@/lib/server/developer-platform";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { REQUEST_BODY_LIMITS } from "@/lib/security/http-abuse-policy";
import { rateLimitRequest, rejectOversizedRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebhookPayload = {
  eventTypes?: unknown;
  name?: unknown;
  url?: unknown;
};

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/developer/webhooks", async () => {
    const access = await requirePremium();
    if (!access.ok) return access.response;
    const [webhooks, deliveries] = await Promise.all([
      listDeveloperWebhookEndpoints(access.user.id),
      listDeveloperWebhookDeliveries(access.user.id),
    ]);
    return NextResponse.json({ deliveries, ok: true, webhooks });
  });
}

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/developer/webhooks", async () => {
    const rateLimited = await rateLimitRequest(request, "developer-webhooks:create", { limit: 10, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;
    const oversized = rejectOversizedRequest(request, REQUEST_BODY_LIMITS.developerMutation);
    if (oversized) return oversized;

    const payload = (await request.json().catch(() => null)) as WebhookPayload | null;
    try {
      const created = await createDeveloperWebhookEndpoint({
        eventTypes: payload?.eventTypes,
        name: payload?.name,
        url: payload?.url,
        userId: access.user.id,
      });
      return NextResponse.json({ message: "Webhook endpoint created. Copy the signing secret now; it will not be shown again.", ok: true, signingSecret: created.signingSecret, webhook: created.endpoint });
    } catch (error) {
      if (error instanceof DeveloperApiAuthError) return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
      console.warn("[developer] webhook create failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to create webhook endpoint.", ok: false }, { status: 500 });
    }
  });
}
