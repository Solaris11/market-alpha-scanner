import { NextResponse } from "next/server";
import { deepHealth, withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/health/deep", async () => {
    const health = await deepHealth();
    return NextResponse.json(health, {
      headers: {
        "Cache-Control": "no-store",
      },
      status: health.ok ? 200 : 503,
    });
  });
}
