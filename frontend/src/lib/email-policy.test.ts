import assert from "node:assert/strict";
import test from "node:test";
import {
  emailContainsSensitiveValue,
  renderBillingLifecycleEmail,
  renderEmailVerificationEmail,
  renderOperationalAlertEmail,
  renderPasswordResetEmail,
  renderSupportReplyEmail,
  renderSupportTicketCreatedEmail,
  smtpSettingsFromEnv,
  type EmailContacts,
} from "./email-policy";
import { EMAIL_MAX_ATTEMPTS, emailRetryDelayMs, shouldRetryEmailSend } from "./email-retry-policy";

const contacts: EmailContacts = {
  billingEmail: "billing@marketalpha.co",
  from: "Market Alpha Scanner <noreply@marketalpha.co>",
  supportEmail: "support@marketalpha.co",
};

test("Gmail SMTP env uses standardized app password variable only", () => {
  const settings = smtpSettingsFromEnv({
    EMAIL_FROM: contacts.from,
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PASS: "gmail-app-password",
    SMTP_PORT: "587",
    SMTP_SECURE: "false",
    SMTP_USER: "emrah@ondemandsre.com",
  });

  assert.equal(settings?.host, "smtp.gmail.com");
  assert.equal(settings?.port, 587);
  assert.equal(settings?.secure, false);
  assert.equal(settings?.user, "emrah@ondemandsre.com");

  assert.equal(
    smtpSettingsFromEnv({
      EMAIL_FROM: contacts.from,
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PASSWORD: "legacy-password",
      SMTP_PORT: "587",
      SMTP_USER: "emrah@ondemandsre.com",
    } as unknown as Parameters<typeof smtpSettingsFromEnv>[0]),
    null,
  );
});

test("transactional templates use correct Reply-To addresses", () => {
  assert.equal(renderEmailVerificationEmail({ contacts, expiresAt: new Date("2026-05-05T12:00:00Z"), verificationUrl: "https://app.marketalpha.co/api/auth/verify-email?token=test" }).replyTo, contacts.supportEmail);
  assert.equal(renderPasswordResetEmail({ contacts, expiresAt: new Date("2026-05-05T12:00:00Z"), resetUrl: "https://app.marketalpha.co/reset-password?token=test" }).replyTo, contacts.supportEmail);
  assert.equal(renderSupportTicketCreatedEmail({ contacts, subject: "Help", ticketId: "ticket_1" }).replyTo, contacts.supportEmail);
  assert.equal(renderSupportReplyEmail({ contacts, message: "We can help explain the product.", subject: "Help", ticketId: "ticket_1" }).replyTo, contacts.supportEmail);
  assert.equal(renderBillingLifecycleEmail({ contacts, message: "Your Premium subscription is now active.", title: "Premium activated" }).replyTo, contacts.billingEmail);
  assert.equal(renderOperationalAlertEmail({ contacts, eventType: "health", message: "Deep health degraded.", metadata: {}, severity: "warning", status: "warn" }).replyTo, contacts.supportEmail);
});

test("email templates do not include SMTP secrets or financial advice claims", () => {
  const secretValues = ["gmail-app-password", "SMTP_PASS_SECRET_123", "sk_live_secret"];
  const emails = [
    renderEmailVerificationEmail({ contacts, expiresAt: new Date("2026-05-05T12:00:00Z"), verificationUrl: "https://app.marketalpha.co/api/auth/verify-email?token=public-link-token" }),
    renderPasswordResetEmail({ contacts, expiresAt: new Date("2026-05-05T12:00:00Z"), resetUrl: "https://app.marketalpha.co/reset-password?token=public-link-token" }),
    renderSupportTicketCreatedEmail({ contacts, subject: "Question", ticketId: "018f4c6b-7725-4b6a-9123-a85751000abc" }),
    renderSupportReplyEmail({ contacts, message: "I can explain what WAIT means, but I cannot provide buy or sell recommendations.", subject: "Question", ticketId: "018f4c6b-7725-4b6a-9123-a85751000abc" }),
    renderBillingLifecycleEmail({ contacts, message: "Your Premium subscription is now active.", title: "Premium activated" }),
  ];

  for (const email of emails) {
    assert.equal(emailContainsSensitiveValue(email, secretValues), false);
    assert.doesNotMatch(`${email.subject}\n${email.text}\n${email.html}`, /guaranteed profit|you should buy|personalized recommendation/i);
  }
});

test("SMTP retry policy is bounded with exponential backoff", () => {
  assert.equal(EMAIL_MAX_ATTEMPTS, 3);
  assert.equal(emailRetryDelayMs(1), 1000);
  assert.equal(emailRetryDelayMs(2), 5000);
  assert.equal(emailRetryDelayMs(3), 30000);
  assert.equal(shouldRetryEmailSend(1), true);
  assert.equal(shouldRetryEmailSend(2), true);
  assert.equal(shouldRetryEmailSend(3), false);
});
