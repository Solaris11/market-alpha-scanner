import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { getPushSubscriptionStatus } from "@/lib/server/push-subscriptions";
import { isWebPushDeliveryConfigured, webPushPublicKey } from "@/lib/server/web-push";
import { rateLimitRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireUser();
  if (!access.ok) return access.response;

  const limited = await rateLimitRequest(request, "push-status", { limit: 90, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const status = await getPushSubscriptionStatus(access.user.id);
    return NextResponse.json({
      ok: true,
      deliveryConfigured: isWebPushDeliveryConfigured(),
      publicKey: webPushPublicKey(),
      status,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        deliveryConfigured: isWebPushDeliveryConfigured(),
        message: "Push subscription storage is not available yet.",
      },
      { status: 503 },
    );
  }
}
