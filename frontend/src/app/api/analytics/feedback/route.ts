import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { recordBetaFeedback, type BetaFeedbackPayload } from "@/lib/server/analytics";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/analytics/feedback", async () => {
    const rateLimited = await rateLimitRequest(request, "analytics:feedback", { limit: 20, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;
    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const payload = (await request.json().catch(() => null)) as BetaFeedbackPayload | null;
    const user = await getCurrentUser().catch(() => null);
    const result = await recordBetaFeedback({ payload: payload ?? {}, request, user });
    return NextResponse.json({ id: result.id, ok: true });
  });
}
