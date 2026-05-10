import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { disablePushSubscription } from "@/lib/server/push-subscriptions";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";

type UnsubscribePayload = {
  endpoint?: unknown;
};

export async function POST(request: Request) {
  const mutationError = validateMutationRequest(request) ?? requireCsrf(request);
  if (mutationError) return mutationError;

  const limited = await rateLimitRequest(request, "push-unsubscribe", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const access = await requireUser();
  if (!access.ok) return access.response;

  const payload = (await request.json().catch(() => null)) as UnsubscribePayload | null;
  const endpoint = typeof payload?.endpoint === "string" ? payload.endpoint.trim() : "";
  if (!endpoint) return NextResponse.json({ ok: false, message: "Endpoint is required." }, { status: 400 });

  try {
    const disabled = await disablePushSubscription(access.user.id, endpoint);
    return NextResponse.json({ disabled, ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Push subscription could not be disabled." }, { status: 503 });
  }
}
