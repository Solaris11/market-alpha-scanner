import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { loadLiveIntelligenceSystem } from "@/lib/server/live-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/live-intelligence", async () => {
    const access = await requirePremium();
    if (!access.ok) return access.response;

    const refreshIntervalMs = refreshIntervalFromRequest(request);
    const system = await loadLiveIntelligenceSystem({ refreshIntervalMs, streamMode: "snapshot" });
    return NextResponse.json({ ok: true, system });
  });
}

function refreshIntervalFromRequest(request: Request): number | undefined {
  const url = new URL(request.url);
  const raw = url.searchParams.get("intervalMs");
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(10_000, Math.min(120_000, Math.trunc(parsed)));
}
