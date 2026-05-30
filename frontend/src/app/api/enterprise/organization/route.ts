import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { updateEnterpriseOrganization } from "@/lib/server/enterprise";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrganizationPayload = {
  accountType?: unknown;
  name?: unknown;
  primaryDomain?: unknown;
  sessionTtlMinutes?: unknown;
  ssoRequired?: unknown;
};

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/enterprise/organization", async () => {
    const rateLimited = await rateLimitRequest(request, "enterprise-organization:update", { limit: 12, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;

    const payload = (await request.json().catch(() => null)) as OrganizationPayload | null;
    try {
      const model = await updateEnterpriseOrganization({ patch: payload ?? {}, request, user: access.user });
      return NextResponse.json({ message: "Organization settings updated.", model, ok: true });
    } catch (error) {
      console.warn("[enterprise] organization update failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to update organization settings.", ok: false }, { status: 500 });
    }
  });
}
