import { NextResponse } from "next/server";
import { normalizeNotificationFeedbackValue, normalizeNotificationId } from "@/lib/notifications";
import { requireUser } from "@/lib/server/access-control";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { recordNotificationFeedback } from "@/lib/server/notifications";
import { rateLimitRequest, rejectOversizedRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { REQUEST_BODY_LIMITS } from "@/lib/security/http-abuse-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FeedbackPayload = {
  feedback?: unknown;
  id?: unknown;
  metadata?: unknown;
  source?: unknown;
};

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/notifications/feedback", async () => {
    const rateLimited = await rateLimitRequest(request, "notifications:feedback", { limit: 120, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const oversized = rejectOversizedRequest(request, REQUEST_BODY_LIMITS.notificationFeedback);
    if (oversized) return oversized;

    const access = await requireUser("Sign in to rate notifications.");
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;

    const payload = (await request.json().catch(() => null)) as FeedbackPayload | null;
    const id = normalizeNotificationId(payload?.id);
    const feedback = normalizeNotificationFeedbackValue(payload?.feedback);
    if (!id || !feedback) {
      return NextResponse.json({ ok: false, error: "invalid_notification_feedback" }, { status: 400 });
    }

    try {
      const summary = await recordNotificationFeedback({
        feedback,
        metadata: payload?.metadata,
        notificationId: id,
        source: payload?.source,
        userId: access.user.id,
      });
      if (!summary) {
        return NextResponse.json({ ok: false, error: "notification_not_found" }, { status: 404 });
      }
      return NextResponse.json({ feedback, ok: true, summary });
    } catch (error) {
      console.warn("[notifications] feedback failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ ok: false, error: "notification_feedback_unavailable" }, { status: 503 });
    }
  });
}
