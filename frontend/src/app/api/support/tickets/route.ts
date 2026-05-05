import { NextResponse } from "next/server";
import { after } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { createSupportTicket, listSupportTicketsForUser, sendSupportTicketCreatedNotification } from "@/lib/server/support";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/support/tickets", async () => {
    const access = await requireUser("Sign in to view support tickets.");
    if (!access.ok) return access.response;
    return NextResponse.json({ ok: true, tickets: await listSupportTicketsForUser(access.user.id) });
  });
}

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/support/tickets", async () => {
    const rateLimited = await rateLimitRequest(request, "support:tickets:create", { limit: 10, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;
    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;
    const access = await requireUser("Sign in to create a support ticket.");
    if (!access.ok) return access.response;
    const csrf = requireCsrf(request);
    if (csrf) return csrf;
    try {
      const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const ticket = await createSupportTicket({ ...(payload ?? {}), user: access.user });
      after(async () => {
        await sendSupportTicketCreatedNotification(ticket, payload?.message);
      });
      return NextResponse.json({ ok: true, ticket }, { status: 201 });
    } catch {
      return NextResponse.json({ ok: false, error: "support_ticket_unavailable" }, { status: 400 });
    }
  });
}
