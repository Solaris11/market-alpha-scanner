import { NextResponse } from "next/server";
import { getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, validateMutationRequest } from "@/lib/server/request-security";
import { supportChatResponse } from "@/lib/security/support-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/support/chat", async () => {
    const rateLimited = await rateLimitRequest(request, "support:chat", { limit: 30, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;
    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;
    const payload = (await request.json().catch(() => null)) as { message?: unknown } | null;
    const response = supportChatResponse(payload?.message);
    const entitlement = await getEntitlement().catch(() => null);
    return NextResponse.json({
      ok: response.ok,
      classification: response.classification,
      message: response.message,
      premium: entitlement ? hasPremiumAccess(entitlement) : false,
    }, { status: response.ok ? 200 : 200 });
  });
}
