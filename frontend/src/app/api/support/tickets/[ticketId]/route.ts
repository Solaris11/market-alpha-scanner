import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { getSupportTicketForUser } from "@/lib/server/support";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ ticketId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  return withRequestMetrics(request, "/api/support/tickets/[ticketId]", async () => {
    const access = await requireUser("Sign in to view this support ticket.");
    if (!access.ok) return access.response;
    const { ticketId } = await context.params;
    const ticket = await getSupportTicketForUser(ticketId, access.user.id).catch(() => null);
    if (!ticket) return NextResponse.json({ ok: false, error: "ticket_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, ticket });
  });
}
