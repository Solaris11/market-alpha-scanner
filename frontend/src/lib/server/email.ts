import "server-only";

type ResendEmailResponse = {
  id?: string;
};

export type EmailDeliveryResult =
  | { ok: true; providerId: string | null }
  | { ok: false; reason: "not_configured" | "send_failed" };

export async function sendPasswordResetEmail(input: { expiresAt: Date; resetUrl: string; to: string }): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    console.warn("[auth] Password reset email provider is not configured.");
    return { ok: false, reason: "not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from,
      to: input.to,
      subject: "Reset your Market Alpha Scanner password",
      html: passwordResetHtml(input.resetUrl, input.expiresAt),
      text: passwordResetText(input.resetUrl, input.expiresAt),
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    console.warn("[auth] Password reset email delivery failed.", { status: response.status });
    return { ok: false, reason: "send_failed" };
  }

  const payload = (await response.json().catch(() => null)) as ResendEmailResponse | null;
  return { ok: true, providerId: payload?.id ?? null };
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
