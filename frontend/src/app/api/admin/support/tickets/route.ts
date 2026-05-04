import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/access-control";
import { listAdminSupportTickets } from "@/lib/server/support";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/admin/support/tickets", async () => {
    const access = await requireAdmin();
    if (!access.ok) return access.response;
    const url = new URL(request.url);
    return NextResponse.json({ ok: true, tickets: await listAdminSupportTickets({ status: url.searchParams.get("status") }) });
  });
}
