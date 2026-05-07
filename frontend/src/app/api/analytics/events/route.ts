import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { recordAnalyticsEvents, type AnalyticsEventPayload } from "@/lib/server/analytics";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EventsPayload = {
  events?: unknown;
};

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/analytics/events", async () => {
    const rateLimited = await rateLimitRequest(request, "analytics:events", { limit: 240, windowMs: 60_000 });
    if (rateLimited) return rateLimited;
    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const payload = (await request.json().catch(() => null)) as EventsPayload | null;
    const events = Array.isArray(payload?.events) ? (payload.events as AnalyticsEventPayload[]) : [];
    const user = await getCurrentUser().catch(() => null);
    const result = await recordAnalyticsEvents({ events, request, user });
    return NextResponse.json({ inserted: result.inserted, ok: true });
  });
}
