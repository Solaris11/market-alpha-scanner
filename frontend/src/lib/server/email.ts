import "server-only";

import nodemailer from "nodemailer";
import {
  emailContactsFromEnv,
  renderBillingLifecycleEmail,
  renderEmailVerificationEmail,
  renderPasswordResetEmail,
  renderSupportReplyEmail,
  renderSupportTicketCreatedEmail,
  smtpSettingsFromEnv,
  type RenderedEmail,
  type SmtpSettings,
} from "@/lib/email-policy";
import { EMAIL_MAX_ATTEMPTS, emailRetryDelayMs, shouldRetryEmailSend } from "@/lib/email-retry-policy";
import type { SubscriptionNotificationIntent } from "@/lib/security/subscription-notifications";
import { dbQuery } from "./db";
import { recordMonitoringEvent } from "./monitoring";

export type EmailDeliveryResult =
  | { ok: true; providerId: string | null }
  | { ok: false; reason: "not_configured" | "send_failed" };

export async function sendPasswordResetEmail(input: { expiresAt: Date; resetUrl: string; to: string }): Promise<EmailDeliveryResult> {
  const config = smtpConfig();
  if (!config) {
    console.warn("[auth] Password reset email provider is not configured.");
    return { ok: false, reason: "not_configured" };
  }

  try {
    return await sendRenderedEmail(config, input.to, renderPasswordResetEmail({ contacts: config, expiresAt: input.expiresAt, resetUrl: input.resetUrl }));
  } catch {
    console.warn("[auth] Password reset email delivery failed.");
    return { ok: false, reason: "send_failed" };
  }
}

export async function sendEmailVerificationEmail(input: { expiresAt: Date; to: string; verificationUrl: string }): Promise<EmailDeliveryResult> {
  const config = smtpConfig();
  if (!config) {
    console.warn("[auth] Email verification provider is not configured.");
    return { ok: false, reason: "not_configured" };
  }

  try {
    return await sendRenderedEmail(config, input.to, renderEmailVerificationEmail({ contacts: config, expiresAt: input.expiresAt, verificationUrl: input.verificationUrl }));
  } catch {
    console.warn("[auth] Email verification delivery failed.");
    return { ok: false, reason: "send_failed" };
  }
}

export async function sendSupportTicketCreatedEmail(input: { subject: string; ticketId: string; to: string }): Promise<EmailDeliveryResult> {
  const config = smtpConfig();
  if (!config) return { ok: false, reason: "not_configured" };
  try {
    return await sendRenderedEmail(config, input.to, renderSupportTicketCreatedEmail({ contacts: config, subject: input.subject, ticketId: input.ticketId }));
  } catch {
    console.warn("[support] Ticket confirmation email delivery failed.");
    return { ok: false, reason: "send_failed" };
  }
}

export async function sendSupportReplyEmail(input: { message: string; subject: string; ticketId: string; to: string }): Promise<EmailDeliveryResult> {
  const config = smtpConfig();
  if (!config) return { ok: false, reason: "not_configured" };
  try {
    return await sendRenderedEmail(config, input.to, renderSupportReplyEmail({ contacts: config, message: input.message, subject: input.subject, ticketId: input.ticketId }));
  } catch {
    console.warn("[support] Ticket reply email delivery failed.");
    return { ok: false, reason: "send_failed" };
  }
}

export async function sendBillingLifecycleEmailToUser(userId: string, intent: SubscriptionNotificationIntent): Promise<EmailDeliveryResult> {
  const config = smtpConfig();
  if (!config) return { ok: false, reason: "not_configured" };
  const result = await dbQuery<{ email: string }>("SELECT email FROM users WHERE id = $1 LIMIT 1", [userId]);
  const email = result.rows[0]?.email;
  if (!email) return { ok: false, reason: "send_failed" };
  try {
    return await sendRenderedEmail(config, email, renderBillingLifecycleEmail({ contacts: config, message: intent.message, title: intent.title }));
  } catch {
    console.warn("[billing] Billing lifecycle email delivery failed.");
    return { ok: false, reason: "send_failed" };
  }
}

export function emailProviderConfigured(): boolean {
  return Boolean(smtpConfig());
}

function smtpConfig(): SmtpSettings | null {
  return smtpSettingsFromEnv(process.env);
}

async function sendRenderedEmail(config: SmtpSettings, to: string, email: RenderedEmail): Promise<EmailDeliveryResult> {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < EMAIL_MAX_ATTEMPTS) {
    attempt += 1;
    try {
      const result = await createSmtpTransport(config).sendMail({
        from: email.from || config.from || emailContactsFromEnv(process.env).from,
        html: email.html,
        replyTo: email.replyTo,
        subject: email.subject,
        text: email.text,
        to,
      });
      return { ok: true, providerId: result.messageId ?? null };
    } catch (error) {
      lastError = error;
      if (!shouldRetryEmailSend(attempt)) break;
      await sleep(emailRetryDelayMs(attempt));
    }
  }

  await recordEmailFailure(email.category, to, config.host, attempt, lastError);
  throw lastError instanceof Error ? lastError : new Error("SMTP email delivery failed.");
}

function createSmtpTransport(config: SmtpSettings) {
  return nodemailer.createTransport({
    auth: {
      pass: config.pass,
      user: config.user,
    },
    host: config.host,
    port: config.port,
    secure: config.secure,
  });
}

async function recordEmailFailure(category: string, to: string, smtpHost: string, attempts: number, error: unknown): Promise<void> {
  await recordMonitoringEvent({
    eventType: "email:delivery_failed",
    message: "SMTP email delivery failed after retries.",
    metadata: {
      attempts,
      category,
      error: safeEmailError(error),
      recipientDomain: recipientDomain(to),
      smtpHost,
    },
    severity: "warning",
    status: "fail",
  }).catch((monitoringError: unknown) => {
    console.warn("[email] monitoring failure event write failed", monitoringError instanceof Error ? monitoringError.message : monitoringError);
  });
}

function recipientDomain(email: string): string | null {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain && /^[a-z0-9.-]+$/.test(domain) ? domain.slice(0, 120) : null;
}

function safeEmailError(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown";
  return message.replace(/(Bearer\s+[A-Za-z0-9._~+/-]+=*|sk_(?:live|test)_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_]+|[A-Za-z0-9_-]{32,})/g, "[redacted]").slice(0, 160);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
