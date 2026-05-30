import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { loadEnterpriseReadiness } from "@/lib/server/enterprise";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/enterprise/readiness", async () => {
    const access = await requirePremium();
    if (!access.ok) return access.response;
    try {
      return NextResponse.json({ model: await loadEnterpriseReadiness(access.user), ok: true });
    } catch (error) {
      console.warn("[enterprise] readiness API failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Enterprise readiness is unavailable.", ok: false }, { status: 500 });
    }
  });
}
