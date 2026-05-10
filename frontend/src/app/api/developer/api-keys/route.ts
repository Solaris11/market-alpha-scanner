import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { createDeveloperApiKey, listDeveloperApiKeys } from "@/lib/server/developer-platform";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { REQUEST_BODY_LIMITS } from "@/lib/security/http-abuse-policy";
import { rateLimitRequest, rejectOversizedRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ApiKeyPayload = {
  name?: unknown;
  scopes?: unknown;
};

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/developer/api-keys", async () => {
    const access = await requirePremium();
    if (!access.ok) return access.response;
    return NextResponse.json({ apiKeys: await listDeveloperApiKeys(access.user.id), ok: true });
  });
}

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/developer/api-keys", async () => {
    const rateLimited = await rateLimitRequest(request, "developer-api-keys:create", { limit: 5, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;
    const oversized = rejectOversizedRequest(request, REQUEST_BODY_LIMITS.developerMutation);
    if (oversized) return oversized;

    const payload = (await request.json().catch(() => null)) as ApiKeyPayload | null;
    try {
      const created = await createDeveloperApiKey({
        name: payload?.name,
        scopes: payload?.scopes,
        userId: access.user.id,
      });
      return NextResponse.json({ apiKey: created.record, key: created.key, message: "API key created. Copy it now; it will not be shown again.", ok: true });
    } catch (error) {
      console.warn("[developer] api key create failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to create API key.", ok: false }, { status: 500 });
    }
  });
}
