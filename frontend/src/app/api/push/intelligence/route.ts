import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { sendMobileIntelligencePushesForUser } from "@/lib/server/mobile-push-intelligence";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { isWebPushDeliveryConfigured } from "@/lib/server/web-push";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const mutationError = validateMutationRequest(request) ?? requireCsrf(request);
  if (mutationError) return mutationError;

  const limited = await rateLimitRequest(request, "push-intelligence", { limit: 8, windowMs: 60_000 });
  if (limited) return limited;

  const access = await requirePremium();
  if (!access.ok) return access.response;

  if (!isWebPushDeliveryConfigured()) {
    return NextResponse.json({
      deliveryConfigured: false,
      ok: true,
      message: "Mobile intelligence packets are ready, but VAPID delivery keys are not configured.",
      summary: { attempted: 0, delivered: 0, eligiblePackets: 0 },
    });
  }

  const summary = await sendMobileIntelligencePushesForUser(access.user.id).catch(() => null);
  if (!summary) {
    return NextResponse.json({ ok: false, message: "Mobile intelligence push delivery failed." }, { status: 503 });
  }
  return NextResponse.json({ deliveryConfigured: true, ok: true, summary });
}
