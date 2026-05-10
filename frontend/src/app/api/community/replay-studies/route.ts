import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { CommunityIntelligenceError, createCommunityReplayStudy } from "@/lib/server/community-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReplayStudyPayload = {
  replayTimestamp?: unknown;
  summary?: unknown;
  symbol?: unknown;
  tags?: unknown;
  title?: unknown;
};

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/community/replay-studies", async () => {
    const rateLimited = await rateLimitRequest(request, "community-replay-study:write", { limit: 15, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;

    const payload = (await request.json().catch(() => null)) as ReplayStudyPayload | null;
    try {
      const system = await createCommunityReplayStudy({
        replayTimestamp: payload?.replayTimestamp,
        summary: payload?.summary,
        symbol: payload?.symbol,
        tags: Array.isArray(payload?.tags) ? payload.tags : [],
        title: payload?.title,
        userId: access.user.id,
      });
      return NextResponse.json({ message: "Replay study shared.", ok: true, system });
    } catch (error) {
      if (error instanceof CommunityIntelligenceError) {
        return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
      }
      console.warn("[community] replay study failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to share replay study.", ok: false }, { status: 500 });
    }
  });
}
