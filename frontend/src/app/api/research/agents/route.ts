import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { loadAutomatedResearchAgentsSystem } from "@/lib/server/research-agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/research/agents", async () => {
    const access = await requirePremium();
    if (!access.ok) return access.response;

    const system = await loadAutomatedResearchAgentsSystem({ userId: access.user.id });
    return NextResponse.json({ ok: true, system });
  });
}
