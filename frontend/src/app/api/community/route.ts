import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { loadCommunityIntelligenceSystem } from "@/lib/server/community-intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/community", async () => {
    const access = await requirePremium();
    if (!access.ok) return access.response;

    try {
      const system = await loadCommunityIntelligenceSystem(access.user.id);
      return NextResponse.json({ ok: true, system }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.warn("[community] load failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Community intelligence is temporarily unavailable.", ok: false }, { status: 500 });
    }
  });
}
