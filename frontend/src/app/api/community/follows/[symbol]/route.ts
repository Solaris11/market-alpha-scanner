import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { removeCommunityOpportunityFollow } from "@/lib/server/community-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ symbol: string }> }) {
  return withRequestMetrics(request, "/api/community/follows/[symbol]", async () => {
    const rateLimited = await rateLimitRequest(request, "community-follow:write", { limit: 40, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;

    const { symbol } = await context.params;
    try {
      const system = await removeCommunityOpportunityFollow({ symbol, userId: access.user.id });
      return NextResponse.json({ message: "Community marker removed.", ok: true, system });
    } catch (error) {
      console.warn("[community] follow removal failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to remove community marker.", ok: false }, { status: 500 });
    }
  });
}
