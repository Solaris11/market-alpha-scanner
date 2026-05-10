import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { createTeamResearchNote, TeamWorkspaceAccessError } from "@/lib/server/team-intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ResearchNotePayload = {
  body?: unknown;
  symbol?: unknown;
  title?: unknown;
  visibility?: unknown;
  workspaceId?: unknown;
};

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/team/research-notes", async () => {
    const rateLimited = await rateLimitRequest(request, "team-research-notes:write", { limit: 20, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;

    const payload = (await request.json().catch(() => null)) as ResearchNotePayload | null;
    const workspaceId = typeof payload?.workspaceId === "string" ? payload.workspaceId : null;

    try {
      const system = await createTeamResearchNote({
        body: payload?.body,
        request,
        symbol: payload?.symbol,
        title: payload?.title,
        userId: access.user.id,
        visibility: payload?.visibility,
        workspaceId,
      });
      return NextResponse.json({ message: "Team research note saved.", ok: true, system });
    } catch (error) {
      if (error instanceof TeamWorkspaceAccessError) {
        return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
      }
      console.warn("[team] research note failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to save team research note.", ok: false }, { status: 500 });
    }
  });
}
