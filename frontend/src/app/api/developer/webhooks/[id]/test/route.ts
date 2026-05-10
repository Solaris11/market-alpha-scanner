import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { sendDeveloperWebhookTest, DeveloperApiAuthError } from "@/lib/server/developer-platform";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withRequestMetrics(request, "/api/developer/webhooks/[id]/test", async () => {
    const rateLimited = await rateLimitRequest(request, "developer-webhooks:test", { limit: 10, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;

    const { id } = await context.params;
    try {
      const delivery = await sendDeveloperWebhookTest({ endpointId: id, userId: access.user.id });
      return NextResponse.json({ delivery, message: "Webhook test delivery completed.", ok: true });
    } catch (error) {
      if (error instanceof DeveloperApiAuthError) return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
      console.warn("[developer] webhook test failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Webhook test failed.", ok: false }, { status: 500 });
    }
  });
}
