import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { replyToSupportTicket } from "@/lib/server/support";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ ticketId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withRequestMetrics(request, "/api/support/tickets/[ticketId]/reply", async () => {
    const rateLimited = await rateLimitRequest(request, "support:tickets:reply", { limit: 20, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;
    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;
    const access = await requireUser("Sign in to reply to this ticket.");
    if (!access.ok) return access.response;
    const csrf = requireCsrf(request);
    if (csrf) return csrf;
    const { ticketId } = await context.params;
    try {
      const payload = (await request.json().catch(() => null)) as { message?: unknown } | null;
      const ticket = await replyToSupportTicket({ message: payload?.message, ticketId, user: access.user });
      return NextResponse.json({ ok: true, ticket });
    } catch {
      return NextResponse.json({ ok: false, error: "ticket_reply_unavailable" }, { status: 404 });
    }
  });
}
