import { NextResponse } from "next/server";
import {
  emailContactsFromEnv,
  renderBillingLifecycleEmail,
  renderEmailVerificationEmail,
  renderOperationalAlertEmail,
  renderPasswordResetEmail,
  renderSupportReplyEmail,
  renderSupportTicketCreatedEmail,
} from "@/lib/email-policy";
import { APP_URL } from "@/lib/brand";
import { requireAdmin } from "@/lib/server/access-control";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/admin/email-preview", async () => {
    const access = await requireAdmin();
    if (!access.ok) return access.response;
    const contacts = emailContactsFromEnv(process.env);
    const expiresAt = new Date("2026-05-05T12:00:00.000Z");
    return NextResponse.json({
      ok: true,
      previews: {
        alert: renderOperationalAlertEmail({
          contacts,
          eventType: "health:deep",
          message: "Deep health check returned a warning.",
          metadata: { component: "scanner", status: "warn" },
          severity: "warning",
          status: "warn",
        }),
        billing: renderBillingLifecycleEmail({
          contacts,
          message: "Your TradeVeto Premium subscription is now active.",
          title: "Premium activated",
        }),
        password_reset: renderPasswordResetEmail({
          contacts,
          expiresAt,
          resetUrl: `${APP_URL}/reset-password?token=REDACTED_SAMPLE_TOKEN`,
        }),
        support: renderSupportReplyEmail({
          contacts,
          message: "We can help explain how TradeVeto works. We cannot provide personalized buy/sell recommendations.",
          subject: "How do I read WAIT?",
          ticketId: "preview-ticket",
        }),
        support_created: renderSupportTicketCreatedEmail({
          category: "scanner",
          contacts,
          message: "The scanner refresh status is unclear.",
          status: "open",
          subject: "How do I read WAIT?",
          ticketId: "preview-ticket",
        }),
        verification: renderEmailVerificationEmail({
          contacts,
          expiresAt,
          verificationUrl: `${APP_URL}/api/auth/verify-email?token=REDACTED_SAMPLE_TOKEN`,
        }),
      },
    });
  });
}
