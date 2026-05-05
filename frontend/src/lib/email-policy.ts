export type EmailCategory = "alert" | "billing" | "password_reset" | "support" | "system" | "verification";

export type EmailContacts = {
  billingEmail: string;
  from: string;
  supportEmail: string;
};

export type RenderedEmail = {
  category: EmailCategory;
  deliveryCategory?: string;
  from: string;
  html: string;
  replyTo: string;
  subject: string;
  text: string;
};

export type SmtpEnvironment = Record<string, string | undefined> & {
  BILLING_EMAIL?: string;
  EMAIL_FROM?: string;
  SMTP_HOST?: string;
  SMTP_PASS?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SUPPORT_EMAIL?: string;
};

export type SmtpSettings = EmailContacts & {
  host: string;
  pass: string;
  port: number;
  secure: boolean;
  user: string;
};

const DEFAULT_FROM = "Market Alpha Scanner <noreply@marketalpha.co>";
const DEFAULT_SUPPORT_EMAIL = "support@marketalpha.co";
const DEFAULT_BILLING_EMAIL = "billing@marketalpha.co";
const BRAND_COLOR = "#67e8f9";
const TEXT_COLOR = "#0f172a";
const MUTED_COLOR = "#475569";

export function smtpSettingsFromEnv(env: SmtpEnvironment): SmtpSettings | null {
  const host = env.SMTP_HOST?.trim();
  const port = Number(env.SMTP_PORT ?? 587);
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS?.trim();
  const contacts = emailContactsFromEnv(env);

  if (!host || !Number.isFinite(port) || port <= 0 || !user || !pass || !contacts.from) {
    return null;
  }

  return {
    ...contacts,
    host,
    pass,
    port,
    secure: smtpSecure(env.SMTP_SECURE, port),
    user,
  };
}

export function emailContactsFromEnv(env: SmtpEnvironment): EmailContacts {
  return {
    billingEmail: normalizeEmail(env.BILLING_EMAIL) ?? DEFAULT_BILLING_EMAIL,
    from: env.EMAIL_FROM?.trim() || DEFAULT_FROM,
    supportEmail: normalizeEmail(env.SUPPORT_EMAIL) ?? DEFAULT_SUPPORT_EMAIL,
  };
}

export function renderEmailVerificationEmail(input: { contacts: EmailContacts; expiresAt: Date; verificationUrl: string }): RenderedEmail {
  const title = "Verify your Market Alpha Scanner email";
  const intro = "Confirm this email address before upgrading your Market Alpha account.";
  return actionEmail({
    actionLabel: "Verify email",
    actionUrl: input.verificationUrl,
    category: "verification",
    contacts: input.contacts,
    detail: `This link expires at ${formatDateTime(input.expiresAt)}. If you did not request this, you can ignore this email.`,
    intro,
    replyTo: input.contacts.supportEmail,
    subject: title,
    title,
  });
}

export function renderPasswordResetEmail(input: { contacts: EmailContacts; expiresAt: Date; resetUrl: string }): RenderedEmail {
  const title = "Reset your Market Alpha Scanner password";
  const intro = "We received a request to reset the password for your Market Alpha account.";
  return actionEmail({
    actionLabel: "Reset password",
    actionUrl: input.resetUrl,
    category: "password_reset",
    contacts: input.contacts,
    detail: `This link expires at ${formatDateTime(input.expiresAt)}. If you did not request this, you can ignore this email.`,
    intro,
    replyTo: input.contacts.supportEmail,
    subject: title,
    title,
  });
}

export function renderSupportTicketCreatedEmail(input: { category?: string; contacts: EmailContacts; message?: string; status?: string; subject: string; ticketId: string }): RenderedEmail {
  const title = "We received your support request";
  const safeSubject = cleanInline(input.subject, 180);
  const category = cleanInline(input.category || "support", 80);
  const status = cleanInline(input.status || "open", 40);
  const message = cleanBlock(input.message || "", 700);
  return basicEmail({
    category: "support",
    contacts: input.contacts,
    deliveryCategory: "support_ticket_created",
    paragraphs: [
      `Ticket ${input.ticketId} is ${status}.`,
      `Subject: ${safeSubject}`,
      `Category: ${category}`,
      message ? `Message: ${message}` : "",
      "A Market Alpha support reply will come from this thread. Market Alpha Scanner is research software and does not provide financial advice.",
    ].filter(Boolean),
    replyTo: input.contacts.supportEmail,
    subject: "We received your support request",
    title,
  });
}

export function renderSupportReplyEmail(input: { contacts: EmailContacts; message: string; subject: string; ticketId: string }): RenderedEmail {
  const title = "Market Alpha support replied";
  return basicEmail({
    category: "support",
    contacts: input.contacts,
    deliveryCategory: "support_ticket_reply",
    paragraphs: [
      `Ticket ${input.ticketId}: ${cleanInline(input.subject, 180)}`,
      cleanBlock(input.message, 4000),
      "For trading questions, we can explain how the product works, but we cannot provide personalized buy/sell recommendations.",
    ],
    replyTo: input.contacts.supportEmail,
    subject: `Support reply: ${cleanInline(input.subject, 120)}`,
    title,
  });
}

export function renderBillingLifecycleEmail(input: { contacts: EmailContacts; message: string; title: string }): RenderedEmail {
  const title = cleanInline(input.title, 140);
  return basicEmail({
    category: "billing",
    contacts: input.contacts,
    paragraphs: [cleanBlock(input.message, 500), "Payments and subscription management are handled securely through Stripe."],
    replyTo: input.contacts.billingEmail,
    subject: `Market Alpha billing: ${title}`,
    title,
  });
}

export function renderOperationalAlertEmail(input: {
  contacts: EmailContacts;
  eventType: string;
  message: string;
  metadata: Record<string, unknown>;
  severity: string;
  status: string;
}): RenderedEmail {
  const metadata = Object.entries(input.metadata)
    .slice(0, 20)
    .map(([key, value]) => `${cleanInline(key, 80)}: ${cleanInline(JSON.stringify(value), 240)}`)
    .join("\n");
  return basicEmail({
    category: "alert",
    contacts: input.contacts,
    paragraphs: [
      `Event: ${cleanInline(input.eventType, 120)}`,
      `Severity: ${cleanInline(input.severity, 40)}`,
      `Status: ${cleanInline(input.status, 40)}`,
      cleanBlock(input.message, 500),
      metadata ? `Metadata:\n${metadata}` : "",
    ].filter(Boolean),
    replyTo: input.contacts.supportEmail,
    subject: `[Market Alpha] ${cleanInline(input.severity.toUpperCase(), 40)} ${cleanInline(input.eventType, 120)}`,
    title: "Market Alpha operational alert",
  });
}

export function emailContainsSensitiveValue(email: RenderedEmail, values: readonly string[]): boolean {
  const body = `${email.category}\n${email.from}\n${email.subject}\n${email.replyTo}\n${email.text}\n${email.html}`;
  return values.some((value) => {
    const trimmed = value.trim();
    return trimmed.length >= 8 && body.includes(trimmed);
  });
}

function actionEmail(input: {
  actionLabel: string;
  actionUrl: string;
  category: EmailCategory;
  contacts: EmailContacts;
  detail: string;
  intro: string;
  replyTo: string;
  subject: string;
  title: string;
}): RenderedEmail {
  const text = [
    input.title,
    "",
    input.intro,
    `${input.actionLabel}: ${input.actionUrl}`,
    "",
    input.detail,
    "",
    footerText(input.contacts),
  ].join("\n");
  const html = shellHtml(
    input.title,
    `
      <p>${escapeHtml(input.intro)}</p>
      <p><a href="${escapeHtml(input.actionUrl)}" style="${buttonStyle()}">${escapeHtml(input.actionLabel)}</a></p>
      <p style="${mutedStyle()}">If the button does not work, paste this link into your browser:</p>
      <p><a href="${escapeHtml(input.actionUrl)}">${escapeHtml(input.actionUrl)}</a></p>
      <p style="${mutedStyle()}">${escapeHtml(input.detail)}</p>
    `,
    input.contacts,
  );
  return { category: input.category, from: senderForCategory(input.category, input.contacts), html, replyTo: input.replyTo, subject: input.subject, text };
}

function basicEmail(input: { category: EmailCategory; contacts: EmailContacts; deliveryCategory?: string; paragraphs: string[]; replyTo: string; subject: string; title: string }): RenderedEmail {
  const paragraphs = input.paragraphs.map((paragraph) => cleanBlock(paragraph, 4000)).filter(Boolean);
  const text = [input.title, "", ...paragraphs, "", footerText(input.contacts)].join("\n\n");
  const html = shellHtml(
    input.title,
    paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`).join("\n"),
    input.contacts,
  );
  return { category: input.category, deliveryCategory: input.deliveryCategory, from: senderForCategory(input.category, input.contacts), html, replyTo: input.replyTo, subject: input.subject, text };
}

export function senderForCategory(category: EmailCategory, contacts: EmailContacts): string {
  if (category === "support") return `Market Alpha Support <${contacts.supportEmail}>`;
  if (category === "billing") return `Market Alpha Billing <${contacts.billingEmail}>`;
  return contacts.from;
}

function shellHtml(title: string, body: string, contacts: EmailContacts): string {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:${TEXT_COLOR};max-width:640px">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED_COLOR};font-weight:700">Market Alpha Scanner</div>
      <h1 style="font-size:22px;line-height:1.25;margin:8px 0 16px">${escapeHtml(title)}</h1>
      ${body}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
      <p style="${mutedStyle()}">${escapeHtml(footerText(contacts))}</p>
    </div>
  `;
}

function footerText(contacts: EmailContacts): string {
  return `Market Alpha Scanner is research and education software, not financial advice. Support: ${contacts.supportEmail}`;
}

function smtpSecure(value: string | undefined, port: number): boolean {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return port === 465;
}

function normalizeEmail(value: string | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

function cleanInline(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanBlock(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(/\r/g, "")
    .trim()
    .slice(0, maxLength);
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

function buttonStyle(): string {
  return `display:inline-block;background:${BRAND_COLOR};color:${TEXT_COLOR};padding:11px 16px;border-radius:8px;font-weight:700;text-decoration:none`;
}

function mutedStyle(): string {
  return `color:${MUTED_COLOR};font-size:13px`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
