import "server-only";

import nodemailer from "nodemailer";

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
    const result = await createSmtpTransport(config).sendMail({
      from: config.from,
      html: passwordResetHtml(input.resetUrl, input.expiresAt),
      subject: "Reset your Market Alpha Scanner password",
      text: passwordResetText(input.resetUrl, input.expiresAt),
      to: input.to,
    });
    return { ok: true, providerId: result.messageId ?? null };
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
    const result = await createSmtpTransport(config).sendMail({
      from: config.from,
      html: emailVerificationHtml(input.verificationUrl, input.expiresAt),
      subject: "Verify your Market Alpha Scanner email",
      text: emailVerificationText(input.verificationUrl, input.expiresAt),
      to: input.to,
    });
    return { ok: true, providerId: result.messageId ?? null };
  } catch {
    console.warn("[auth] Email verification delivery failed.");
    return { ok: false, reason: "send_failed" };
  }
}

export function emailProviderConfigured(): boolean {
  return Boolean(smtpConfig());
}

function passwordResetText(resetUrl: string, expiresAt: Date): string {
  return [
    "Reset your Market Alpha Scanner password",
    "",
    "We received a request to reset the password for your Market Alpha Scanner account.",
    `Open this secure reset link: ${resetUrl}`,
    "",
    `This link expires at ${expiresAt.toISOString()}. If you did not request this, you can ignore this email.`,
  ].join("\n");
}

function passwordResetHtml(resetUrl: string, expiresAt: Date): string {
  const escapedUrl = escapeHtml(resetUrl);
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h1 style="font-size:20px">Reset your Market Alpha Scanner password</h1>
      <p>We received a request to reset the password for your Market Alpha Scanner account.</p>
      <p><a href="${escapedUrl}" style="display:inline-block;background:#67e8f9;color:#0f172a;padding:10px 14px;border-radius:8px;font-weight:700;text-decoration:none">Reset password</a></p>
      <p>If the button does not work, paste this link into your browser:</p>
      <p><a href="${escapedUrl}">${escapedUrl}</a></p>
      <p>This link expires at ${escapeHtml(expiresAt.toISOString())}. If you did not request this, you can ignore this email.</p>
    </div>
  `;
}

function emailVerificationText(verificationUrl: string, expiresAt: Date): string {
  return [
    "Verify your Market Alpha Scanner email",
    "",
    "Confirm this email address before upgrading your Market Alpha Scanner account.",
    `Open this secure verification link: ${verificationUrl}`,
    "",
    `This link expires at ${expiresAt.toISOString()}. If you did not request this, you can ignore this email.`,
  ].join("\n");
}

function emailVerificationHtml(verificationUrl: string, expiresAt: Date): string {
  const escapedUrl = escapeHtml(verificationUrl);
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h1 style="font-size:20px">Verify your Market Alpha Scanner email</h1>
      <p>Confirm this email address before upgrading your Market Alpha Scanner account.</p>
      <p><a href="${escapedUrl}" style="display:inline-block;background:#67e8f9;color:#0f172a;padding:10px 14px;border-radius:8px;font-weight:700;text-decoration:none">Verify email</a></p>
      <p>If the button does not work, paste this link into your browser:</p>
      <p><a href="${escapedUrl}">${escapedUrl}</a></p>
      <p>This link expires at ${escapeHtml(expiresAt.toISOString())}. If you did not request this, you can ignore this email.</p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function smtpConfig(): { from: string; host: string; pass: string; port: number; user: string } | null {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim() || process.env.SMTP_PASSWORD?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!host || !Number.isFinite(port) || port <= 0 || !user || !pass || !from) {
    return null;
  }

  return { from, host, pass, port, user };
}

function createSmtpTransport(config: { host: string; pass: string; port: number; user: string }) {
  return nodemailer.createTransport({
    auth: {
      pass: config.pass,
      user: config.user,
    },
    host: config.host,
    port: config.port,
    secure: config.port === 465,
  });
}
