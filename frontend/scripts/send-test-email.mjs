import nodemailer from "nodemailer";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (value.startsWith("--")) {
    args.set(value.slice(2), process.argv[index + 1] && !process.argv[index + 1].startsWith("--") ? process.argv[++index] : "true");
  }
}

const to = args.get("to") || process.env.SUPPORT_EMAIL || "support@tradeveto.com";
const category = normalizeCategory(args.get("category") || "system");
const supportEmail = process.env.SUPPORT_EMAIL || "support@tradeveto.com";
const billingEmail = process.env.BILLING_EMAIL || "billing@tradeveto.com";
const systemFrom = process.env.EMAIL_FROM || "TradeVeto <noreply@tradeveto.com>";
const from =
  category === "support"
    ? `TradeVeto Support <${supportEmail}>`
    : category === "billing"
      ? `TradeVeto Billing <${billingEmail}>`
      : systemFrom;
const replyTo = category === "billing" ? billingEmail : supportEmail;
const config = {
  from,
  host: process.env.SMTP_HOST,
  pass: process.env.SMTP_PASS,
  port: Number(process.env.SMTP_PORT || 587),
  replyTo,
  secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
  user: process.env.SMTP_USER,
};
const smoke = smokeContent(category);

const missing = Object.entries(config)
  .filter(([key, value]) => ["host", "pass", "user"].includes(key) && !String(value || "").trim())
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Email test not configured: missing ${missing.join(", ")}.`);
  process.exit(2);
}

const result = await nodemailer
  .createTransport({
    auth: { pass: config.pass, user: config.user },
    host: config.host,
    port: config.port,
    secure: config.secure,
  })
  .sendMail({
    from: config.from,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#475569;font-weight:700">TradeVeto</div>
        <h1 style="font-size:20px">${escapeHtml(smoke.title)}</h1>
        <p>${escapeHtml(smoke.message)}</p>
        <p>${escapeHtml(smoke.expectedAction)}</p>
        <p>TradeVeto is research and education software, not financial advice.</p>
      </div>
    `,
    replyTo: config.replyTo,
    subject: smoke.subject,
    text: [
      smoke.title,
      "",
      smoke.message,
      smoke.expectedAction,
      "TradeVeto is research and education software, not financial advice.",
    ].join("\n"),
    to,
  });

console.log(JSON.stringify({ category, ok: Boolean(result.messageId), to }));

function normalizeCategory(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  const allowed = new Set(["system", "verification", "password_reset", "support", "billing", "alert", "strategy", "replay", "onboarding"]);
  return allowed.has(normalized) ? normalized : "system";
}

function smokeContent(value) {
  const content = {
    alert: {
      expectedAction: "Expected result: operational alert delivery reaches the inbox without exposing internal secrets.",
      message: "This verifies alert notification delivery for TradeVeto operations.",
      subject: "TradeVeto alert email test",
      title: "TradeVeto alert email test",
    },
    billing: {
      expectedAction: "Expected result: billing mail uses the billing sender and replies route to billing support.",
      message: "This verifies billing lifecycle email delivery for TradeVeto.",
      subject: "TradeVeto billing email test",
      title: "TradeVeto billing email test",
    },
    onboarding: {
      expectedAction: "Expected result: onboarding mail uses TradeVeto branding and working tradeveto.com links.",
      message: "This verifies onboarding-style email delivery for TradeVeto.",
      subject: "TradeVeto onboarding email test",
      title: "TradeVeto onboarding email test",
    },
    password_reset: {
      expectedAction: "Expected result: password reset mail reaches the inbox and links point to tradeveto.com.",
      message: "This verifies password-reset-style email delivery for TradeVeto.",
      subject: "TradeVeto password reset email test",
      title: "TradeVeto password reset email test",
    },
    replay: {
      expectedAction: "Expected result: replay notification mail is clearly labeled and non-advisory.",
      message: "This verifies strategy/replay notification email delivery for TradeVeto.",
      subject: "TradeVeto replay email test",
      title: "TradeVeto replay email test",
    },
    strategy: {
      expectedAction: "Expected result: strategy notification mail is clearly labeled as research-only.",
      message: "This verifies strategy lab notification email delivery for TradeVeto.",
      subject: "TradeVeto strategy email test",
      title: "TradeVeto strategy email test",
    },
    support: {
      expectedAction: "Expected result: support mail uses the support sender and replies route to support.",
      message: "This verifies support email delivery for TradeVeto.",
      subject: "TradeVeto support email test",
      title: "TradeVeto support email test",
    },
    system: {
      expectedAction: "Expected result: system mail uses the noreply sender and support reply-to.",
      message: "This verifies Google Workspace SMTP delivery for TradeVeto.",
      subject: "TradeVeto SMTP test",
      title: "TradeVeto email test",
    },
    verification: {
      expectedAction: "Expected result: verification mail reaches the inbox and links point to tradeveto.com.",
      message: "This verifies email-verification-style delivery for TradeVeto.",
      subject: "TradeVeto verification email test",
      title: "TradeVeto verification email test",
    },
  };
  return content[value] || content.system;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
