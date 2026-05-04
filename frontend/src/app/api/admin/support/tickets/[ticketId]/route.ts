import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/access-control";
import { getAdminSupportTicket } from "@/lib/server/support";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ ticketId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  return withRequestMetrics(request, "/api/admin/support/tickets/[ticketId]", async () => {
    const access = await requireAdmin();
    if (!access.ok) return access.response;
    const { ticketId } = await context.params;
    const ticket = await getAdminSupportTicket(ticketId).catch(() => null);
    if (!ticket) return NextResponse.json({ ok: false, error: "ticket_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, ticket });
  });
}
