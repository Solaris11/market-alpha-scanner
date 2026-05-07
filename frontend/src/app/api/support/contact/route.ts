import { NextResponse } from "next/server";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { createSupportTicket, sendSupportInternalTicketNotification, sendSupportTicketCreatedNotification } from "@/lib/server/support";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/support/contact", async () => {
    const rateLimited = await rateLimitRequest(request, "support:contact", { limit: 5, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;
    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;
    const user = await getCurrentUser().catch(() => null);
    try {
      const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const ticket = await createSupportTicket({ ...(payload ?? {}), user });
      after(async () => {
        await Promise.all([
          sendSupportTicketCreatedNotification(ticket, payload?.message),
          sendSupportInternalTicketNotification(ticket, payload?.message, user),
        ]);
      });
      return NextResponse.json({ ok: true, message: "Support request received.", ticketId: ticket.id }, { status: 201 });
    } catch {
      return NextResponse.json({ ok: false, error: "support_contact_unavailable" }, { status: 400 });
    }
  });
}
