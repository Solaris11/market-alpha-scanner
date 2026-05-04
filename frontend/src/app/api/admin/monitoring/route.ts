import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/access-control";
import { getAdminMonitoringSummary } from "@/lib/server/admin-data";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/admin/monitoring", async () => {
    const access = await requireAdmin();
    if (!access.ok) return access.response;
    return NextResponse.json({ ok: true, monitoring: await getAdminMonitoringSummary() });
  });
}
