import { NextResponse } from "next/server";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { getPublicStrategyPerformanceSystem } from "@/lib/server/public-strategy-performance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/public/strategy-performance", async () => {
    const system = await getPublicStrategyPerformanceSystem();
    return NextResponse.json({ ok: true, system });
  });
}
