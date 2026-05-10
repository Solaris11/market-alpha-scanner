import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { deactivateDeveloperWebhookEndpoint } from "@/lib/server/developer-platform";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withRequestMetrics(request, "/api/developer/webhooks/[id]/deactivate", async () => {
    const rateLimited = await rateLimitRequest(request, "developer-webhooks:deactivate", { limit: 20, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;

    const { id } = await context.params;
    const webhook = await deactivateDeveloperWebhookEndpoint({ id, userId: access.user.id });
    if (!webhook) return NextResponse.json({ message: "Webhook endpoint not found.", ok: false }, { status: 404 });
    return NextResponse.json({ message: "Webhook endpoint deactivated.", ok: true, webhook });
  });
}
