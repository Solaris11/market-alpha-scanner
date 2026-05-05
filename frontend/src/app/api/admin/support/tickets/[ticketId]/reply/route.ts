import { NextResponse } from "next/server";
import { after } from "next/server";
import { requireAdmin } from "@/lib/server/access-control";
import { adminReplyToSupportTicket, sendSupportTicketReplyNotification } from "@/lib/server/support";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ ticketId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withRequestMetrics(request, "/api/admin/support/tickets/[ticketId]/reply", async () => {
    const rateLimited = await rateLimitRequest(request, "admin:support:reply", { limit: 30, windowMs: 60_000 });
    if (rateLimited) return rateLimited;
    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;
    const access = await requireAdmin();
    if (!access.ok) return access.response;
    const csrf = requireCsrf(request);
    if (csrf) return csrf;
    const { ticketId } = await context.params;
    try {
      const payload = (await request.json().catch(() => null)) as { message?: unknown } | null;
      const ticket = await adminReplyToSupportTicket({ admin: access.user, message: payload?.message, request, ticketId });
      after(async () => {
        await sendSupportTicketReplyNotification(ticket, payload?.message);
      });
      return NextResponse.json({ ok: true, ticket });
    } catch {
      return NextResponse.json({ ok: false, error: "admin_ticket_reply_unavailable" }, { status: 400 });
    }
  });
}
