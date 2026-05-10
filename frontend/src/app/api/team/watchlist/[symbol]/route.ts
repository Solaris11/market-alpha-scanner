import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { removeTeamWorkspaceSymbol, TeamWorkspaceAccessError } from "@/lib/server/team-intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ symbol: string }> }) {
  return withRequestMetrics(request, "/api/team/watchlist/[symbol]", async () => {
    const rateLimited = await rateLimitRequest(request, "team-watchlist:write", { limit: 40, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;

    const { symbol } = await context.params;
    const workspaceId = new URL(request.url).searchParams.get("workspaceId");

    try {
      const system = await removeTeamWorkspaceSymbol({ request, symbol, userId: access.user.id, workspaceId });
      return NextResponse.json({ message: "Shared watchlist symbol removed.", ok: true, system });
    } catch (error) {
      if (error instanceof TeamWorkspaceAccessError) {
        return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
      }
      console.warn("[team] watchlist removal failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to remove shared watchlist symbol.", ok: false }, { status: 500 });
    }
  });
}
