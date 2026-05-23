import { NextResponse } from "next/server";
import { REQUEST_BODY_LIMITS } from "@/lib/security/http-abuse-policy";
import { requirePremium } from "@/lib/server/access-control";
import { invalidateDiscoverySystemCache } from "@/lib/server/discovery-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, rejectOversizedRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { readUserSavedScans, upsertUserSavedScan } from "@/lib/server/user-saved-scans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SavedScanMutationPayload = {
  name?: unknown;
  payload?: unknown;
};

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/user/saved-scans", async () => {
    const access = await requirePremium();
    if (!access.ok) return access.response;

    try {
      const scans = await readUserSavedScans(access.user.id);
      return NextResponse.json({ ok: true, scans });
    } catch (error) {
      console.warn("[saved-scans] failed to read saved scans", error instanceof Error ? error.message : error);
      return NextResponse.json({ ok: false, message: "Failed to load saved scans.", scans: [] }, { status: 500 });
    }
  });
}

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/user/saved-scans", () => saveSavedScan(request));
}

async function saveSavedScan(request: Request): Promise<Response> {
  const rateLimited = await rateLimitRequest(request, "user-saved-scans:write", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const oversized = rejectOversizedRequest(request, REQUEST_BODY_LIMITS.savedScanMutation);
  if (oversized) return oversized;

  const access = await requirePremium();
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  try {
    const payload = (await request.json().catch(() => null)) as SavedScanMutationPayload | null;
    const scan = await upsertUserSavedScan(access.user.id, {
      name: payload?.name,
      payload: payload?.payload,
    });
    invalidateDiscoverySystemCache(access.user.id);
    return NextResponse.json({ ok: true, scan });
  } catch (error) {
    console.warn("[saved-scans] failed to save scan", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Failed to save scan." }, { status: 400 });
  }
}
