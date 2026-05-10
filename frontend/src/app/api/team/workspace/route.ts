import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { loadTeamWorkspaceSystem, TeamWorkspaceAccessError } from "@/lib/server/team-intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/team/workspace", async () => {
    const access = await requirePremium();
    if (!access.ok) return access.response;

    try {
      const workspaceId = new URL(request.url).searchParams.get("workspaceId");
      const system = await loadTeamWorkspaceSystem(access.user.id, workspaceId);
      return NextResponse.json({ ok: true, system });
    } catch (error) {
      if (error instanceof TeamWorkspaceAccessError) {
        return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
      }
      console.warn("[team] workspace API failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to load team workspace.", ok: false }, { status: 500 });
    }
  });
}
