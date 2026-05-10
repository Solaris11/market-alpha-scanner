import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { normalizePushSubscriptionInput, savePushSubscription } from "@/lib/server/push-subscriptions";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const mutationError = validateMutationRequest(request) ?? requireCsrf(request);
  if (mutationError) return mutationError;

  const limited = await rateLimitRequest(request, "push-subscribe", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const access = await requireUser();
  if (!access.ok) return access.response;

  const payload = (await request.json().catch(() => null)) as unknown;
  const input = normalizePushSubscriptionInput(payload);
  if (!input) {
    return NextResponse.json({ ok: false, message: "Valid browser push subscription details are required." }, { status: 400 });
  }

  try {
    const subscription = await savePushSubscription(access.user.id, input);
    return NextResponse.json({
      ok: true,
      subscription: {
        id: subscription.id,
        platform: subscription.platform,
        preferences: subscription.preferences,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Push subscription could not be saved." }, { status: 503 });
  }
}
