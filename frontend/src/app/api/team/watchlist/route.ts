import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { addTeamWorkspaceSymbols, TeamWorkspaceAccessError } from "@/lib/server/team-intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WatchlistPayload = {
  symbols?: unknown;
  workspaceId?: unknown;
};

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/team/watchlist", async () => {
    const rateLimited = await rateLimitRequest(request, "team-watchlist:write", { limit: 40, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;

    const payload = (await request.json().catch(() => null)) as WatchlistPayload | null;
    const rawSymbols = Array.isArray(payload?.symbols) ? payload.symbols : [];
    const workspaceId = typeof payload?.workspaceId === "string" ? payload.workspaceId : null;

    try {
      const system = await addTeamWorkspaceSymbols({ request, symbols: rawSymbols, userId: access.user.id, workspaceId });
      return NextResponse.json({ message: "Shared watchlist updated.", ok: true, system });
    } catch (error) {
      if (error instanceof TeamWorkspaceAccessError) {
        return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
      }
      console.warn("[team] watchlist update failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to update shared watchlist.", ok: false }, { status: 500 });
    }
  });
}
