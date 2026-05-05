import nodemailer from "nodemailer";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (value.startsWith("--")) {
    args.set(value.slice(2), process.argv[index + 1] && !process.argv[index + 1].startsWith("--") ? process.argv[++index] : "true");
  }
}

const to = args.get("to") || process.env.SUPPORT_EMAIL || "support@marketalpha.co";
const category = args.get("category") || "system";
const supportEmail = process.env.SUPPORT_EMAIL || "support@marketalpha.co";
const billingEmail = process.env.BILLING_EMAIL || "billing@marketalpha.co";
const systemFrom = process.env.EMAIL_FROM || "Market Alpha Scanner <noreply@marketalpha.co>";
const from =
  category === "support"
    ? `Market Alpha Support <${supportEmail}>`
    : category === "billing"
      ? `Market Alpha Billing <${billingEmail}>`
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
        <h1 style="font-size:20px">Market Alpha email test</h1>
        <p>This verifies Google Workspace SMTP delivery for Market Alpha Scanner.</p>
        <p>Market Alpha Scanner is research and education software, not financial advice.</p>
      </div>
    `,
    replyTo: config.replyTo,
    subject: "Market Alpha SMTP test",
    text: [
      "Market Alpha email test",
      "",
      "This verifies Google Workspace SMTP delivery for Market Alpha Scanner.",
      "Market Alpha Scanner is research and education software, not financial advice.",
    ].join("\n"),
    to,
  });

console.log(JSON.stringify({ category, ok: Boolean(result.messageId), to }));
