import { NextResponse } from "next/server";
import { normalizeAnalyticsRange } from "@/lib/analytics-policy";
import { requireAdmin } from "@/lib/server/access-control";
import { getAnalyticsSummary } from "@/lib/server/analytics";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/admin/analytics", async () => {
    const access = await requireAdmin();
    if (!access.ok) return access.response;
    const range = normalizeAnalyticsRange(new URL(request.url).searchParams.get("range"));
    return NextResponse.json({ analytics: await getAnalyticsSummary(range), ok: true });
  });
}
