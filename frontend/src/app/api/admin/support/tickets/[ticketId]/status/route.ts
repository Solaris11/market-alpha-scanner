import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/access-control";
import { adminUpdateSupportTicketState } from "@/lib/server/support";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ ticketId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withRequestMetrics(request, "/api/admin/support/tickets/[ticketId]/status", async () => {
    const rateLimited = await rateLimitRequest(request, "admin:support:status", { limit: 30, windowMs: 60_000 });
    if (rateLimited) return rateLimited;
    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;
    const access = await requireAdmin();
    if (!access.ok) return access.response;
    const csrf = requireCsrf(request);
    if (csrf) return csrf;
    const { ticketId } = await context.params;
    try {
      const payload = (await request.json().catch(() => null)) as { priority?: unknown; status?: unknown } | null;
      const ticket = await adminUpdateSupportTicketState({ admin: access.user, priority: payload?.priority, request, status: payload?.status, ticketId });
      return NextResponse.json({ ok: true, ticket });
    } catch {
      return NextResponse.json({ ok: false, error: "admin_ticket_status_unavailable" }, { status: 400 });
    }
  });
}
