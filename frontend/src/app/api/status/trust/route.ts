import { NextResponse } from "next/server";
import { getProductionTrustStatus } from "@/lib/server/production-trust-status";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/status/trust", async () => {
    const status = await getProductionTrustStatus();
    return NextResponse.json({ ok: true, status });
  });
}
