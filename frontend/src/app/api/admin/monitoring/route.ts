import { NextResponse } from "next/server";
import { normalizeMonitoringRange } from "@/lib/admin-monitoring-ui";
import { requireAdmin } from "@/lib/server/access-control";
import { getAdminMonitoringSummary } from "@/lib/server/admin-data";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/admin/monitoring", async () => {
    const access = await requireAdmin();
    if (!access.ok) return access.response;
    const range = new URL(request.url).searchParams.get("range");
    return NextResponse.json({ ok: true, monitoring: await getAdminMonitoringSummary(normalizeMonitoringRange(range ?? undefined)) });
  });
}
