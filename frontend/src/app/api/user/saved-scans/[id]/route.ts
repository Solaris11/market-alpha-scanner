import { NextResponse } from "next/server";
import { REQUEST_BODY_LIMITS } from "@/lib/security/http-abuse-policy";
import { requirePremium } from "@/lib/server/access-control";
import { invalidateDiscoverySystemCache } from "@/lib/server/discovery-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, rejectOversizedRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { deleteUserSavedScan, touchUserSavedScan, upsertUserSavedScan } from "@/lib/server/user-saved-scans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SavedScanPatchPayload = {
  name?: unknown;
  payload?: unknown;
  touch?: unknown;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withRequestMetrics(request, "/api/user/saved-scans/[id]", () => updateSavedScan(request, context));
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return withRequestMetrics(request, "/api/user/saved-scans/[id]", () => removeSavedScan(request, context));
}

async function updateSavedScan(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const rateLimited = await rateLimitRequest(request, "user-saved-scans:update", { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const oversized = rejectOversizedRequest(request, REQUEST_BODY_LIMITS.savedScanMutation);
  if (oversized) return oversized;

  const access = await requirePremium();
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as SavedScanPatchPayload | null;
  try {
    if (payload?.touch === true) {
      const scan = await touchUserSavedScan(access.user.id, id);
      if (!scan) return NextResponse.json({ ok: false, message: "Saved scan not found." }, { status: 404 });
      invalidateDiscoverySystemCache(access.user.id);
      return NextResponse.json({ ok: true, scan });
    }
    const scan = await upsertUserSavedScan(access.user.id, {
      name: payload?.name,
      payload: payload?.payload,
    });
    invalidateDiscoverySystemCache(access.user.id);
    return NextResponse.json({ ok: true, scan });
  } catch (error) {
    console.warn("[saved-scans] failed to update scan", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Failed to update saved scan." }, { status: 400 });
  }
}

async function removeSavedScan(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const rateLimited = await rateLimitRequest(request, "user-saved-scans:delete", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requirePremium();
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const { id } = await context.params;
  try {
    const deleted = await deleteUserSavedScan(access.user.id, id);
    if (!deleted) return NextResponse.json({ ok: false, message: "Saved scan not found." }, { status: 404 });
    invalidateDiscoverySystemCache(access.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn("[saved-scans] failed to delete scan", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Failed to delete saved scan." }, { status: 400 });
  }
}
