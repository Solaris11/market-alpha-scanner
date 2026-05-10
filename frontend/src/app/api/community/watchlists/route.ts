import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { CommunityIntelligenceError, createCommunitySharedWatchlist } from "@/lib/server/community-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WatchlistPayload = {
  description?: unknown;
  name?: unknown;
  symbols?: unknown;
};

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/community/watchlists", async () => {
    const rateLimited = await rateLimitRequest(request, "community-watchlist:write", { limit: 15, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;

    const payload = (await request.json().catch(() => null)) as WatchlistPayload | null;
    const symbols = Array.isArray(payload?.symbols) ? payload.symbols : [];
    try {
      const system = await createCommunitySharedWatchlist({
        description: payload?.description,
        name: payload?.name,
        symbols,
        userId: access.user.id,
      });
      return NextResponse.json({ message: "Shared watchlist published.", ok: true, system });
    } catch (error) {
      if (error instanceof CommunityIntelligenceError) {
        return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
      }
      console.warn("[community] shared watchlist failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to publish shared watchlist.", ok: false }, { status: 500 });
    }
  });
}
