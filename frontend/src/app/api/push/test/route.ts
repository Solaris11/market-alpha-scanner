import { NextResponse } from "next/server";
import { createNotificationWithAction } from "@/lib/server/notifications";
import { requirePremium } from "@/lib/server/access-control";
import { listEnabledPushSubscriptions, logMobilePushIntelligenceEvent } from "@/lib/server/push-subscriptions";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { isWebPushDeliveryConfigured, sendMobileWebPush } from "@/lib/server/web-push";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const mutationError = validateMutationRequest(request) ?? requireCsrf(request);
  if (mutationError) return mutationError;

  const limited = await rateLimitRequest(request, "push-test", { limit: 12, windowMs: 60_000 });
  if (limited) return limited;

  const access = await requirePremium();
  if (!access.ok) return access.response;

  const title = "TradeVeto mobile intelligence is ready";
  const body = "Push alerts are connected for watchlist, shock, macro, fragility, and what-changed updates.";
  await createNotificationWithAction(access.user.id, "system", title, body, "/mobile").catch(() => null);

  await logMobilePushIntelligenceEvent(access.user.id, {
    actionUrl: "/mobile",
    eventType: "push_test",
    message: body,
    priority: "medium",
    title,
  }).catch(() => undefined);

  if (!isWebPushDeliveryConfigured()) {
    return NextResponse.json({
      delivered: 0,
      deliveryConfigured: false,
      ok: true,
      message: "Push is subscribed, but VAPID delivery keys are not configured on the server yet.",
    });
  }

  const subscriptions = await listEnabledPushSubscriptions(access.user.id).catch(() => []);
  const results = await Promise.all(
    subscriptions.map((subscription) =>
      sendMobileWebPush(subscription, {
        body,
        tag: "tradeveto-push-test",
        title,
        url: "/mobile",
      }),
    ),
  );

  return NextResponse.json({
    delivered: results.filter((result) => result.ok).length,
    deliveryConfigured: true,
    ok: true,
    attempted: results.length,
  });
}
