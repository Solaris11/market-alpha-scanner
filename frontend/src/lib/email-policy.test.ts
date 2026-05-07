import assert from "node:assert/strict";
import test from "node:test";
import {
  emailContainsSensitiveValue,
  renderBillingLifecycleEmail,
  renderEmailVerificationEmail,
  renderOperationalAlertEmail,
  renderPasswordResetEmail,
  renderSupportInternalNotificationEmail,
  renderSupportReplyEmail,
  renderSupportTicketCreatedEmail,
  smtpSettingsFromEnv,
  supportInternalNotificationRecipient,
  type EmailContacts,
} from "./email-policy";
import { EMAIL_MAX_ATTEMPTS, emailRetryDelayMs, shouldRetryEmailSend } from "./email-retry-policy";

const contacts: EmailContacts = {
  billingEmail: "billing@tradeveto.com",
  from: "TradeVeto <noreply@tradeveto.com>",
  supportEmail: "support@tradeveto.com",
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
  const verification = renderEmailVerificationEmail({ contacts, expiresAt: new Date("2026-05-05T12:00:00Z"), verificationUrl: "https://tradeveto.com/api/auth/verify-email?token=test" });
  const passwordReset = renderPasswordResetEmail({ contacts, expiresAt: new Date("2026-05-05T12:00:00Z"), resetUrl: "https://tradeveto.com/reset-password?token=test" });
  const supportCreated = renderSupportTicketCreatedEmail({ category: "technical", contacts, message: "Refresh controls show unavailable.", status: "open", subject: "Help", ticketId: "ticket_1" });
  const supportInternal = renderSupportInternalNotificationEmail({
    adminUrl: "https://tradeveto.com/admin/support/ticket_1",
    category: "technical",
    contacts,
    createdAt: "2026-05-05T13:00:00Z",
    message: "Refresh controls show unavailable.",
    replyTo: "user@example.com",
    subject: "Help",
    ticketId: "ticket_1",
    userEmail: "user@example.com",
    userName: "Test User",
  });
  const supportReply = renderSupportReplyEmail({ contacts, message: "We can help explain the product.", subject: "Help", ticketId: "ticket_1" });
  const billing = renderBillingLifecycleEmail({ contacts, message: "Your Premium subscription is now active.", title: "Premium activated" });
  const alert = renderOperationalAlertEmail({ contacts, eventType: "health", message: "Deep health degraded.", metadata: {}, severity: "warning", status: "warn" });

  assert.equal(verification.replyTo, contacts.supportEmail);
  assert.equal(verification.category, "verification");
  assert.equal(verification.from, contacts.from);
  assert.equal(passwordReset.replyTo, contacts.supportEmail);
  assert.equal(passwordReset.category, "password_reset");
  assert.equal(passwordReset.from, contacts.from);
  assert.equal(supportCreated.replyTo, contacts.supportEmail);
  assert.equal(supportCreated.category, "support");
  assert.equal(supportCreated.deliveryCategory, "support_ticket_created");
  assert.match(supportCreated.from, /support@tradeveto\.com/);
  assert.equal(supportCreated.subject, "We received your support request");
  assert.match(supportCreated.text, /Category: technical/);
  assert.match(supportCreated.text, /Ticket ticket_1 is open/);
  assert.match(supportCreated.text, /Refresh controls show unavailable/);
  assert.equal(supportInternal.replyTo, "user@example.com");
  assert.equal(supportInternal.category, "support");
  assert.equal(supportInternal.deliveryCategory, "support_internal_notification");
  assert.match(supportInternal.from, /support@tradeveto\.com/);
  assert.equal(supportInternal.subject, "New support ticket: Help");
  assert.match(supportInternal.text, /User email: user@example\.com/);
  assert.match(supportInternal.text, /User name: Test User/);
  assert.match(supportInternal.text, /Admin link: https:\/\/tradeveto\.com\/admin\/support\/ticket_1/);
  assert.equal(supportInternalNotificationRecipient(contacts), contacts.supportEmail);
  assert.equal(supportReply.replyTo, contacts.supportEmail);
  assert.equal(supportReply.category, "support");
  assert.equal(supportReply.deliveryCategory, "support_ticket_reply");
  assert.match(supportReply.from, /support@tradeveto\.com/);
  assert.equal(billing.replyTo, contacts.billingEmail);
  assert.equal(billing.category, "billing");
  assert.match(billing.from, /billing@tradeveto\.com/);
  assert.equal(alert.replyTo, contacts.supportEmail);
  assert.equal(alert.category, "alert");
  assert.equal(alert.from, contacts.from);
});

test("email templates do not include SMTP secrets or financial advice claims", () => {
  const secretValues = ["gmail-app-password", "SMTP_PASS_SECRET_123", "sk_live_secret"];
  const emails = [
    renderEmailVerificationEmail({ contacts, expiresAt: new Date("2026-05-05T12:00:00Z"), verificationUrl: "https://tradeveto.com/api/auth/verify-email?token=public-link-token" }),
    renderPasswordResetEmail({ contacts, expiresAt: new Date("2026-05-05T12:00:00Z"), resetUrl: "https://tradeveto.com/reset-password?token=public-link-token" }),
    renderSupportTicketCreatedEmail({ category: "scanner", contacts, message: "I need product support.", status: "open", subject: "Question", ticketId: "018f4c6b-7725-4b6a-9123-a85751000abc" }),
    renderSupportInternalNotificationEmail({ category: "scanner", contacts, message: "I need product support.", replyTo: "user@example.com", subject: "Question", ticketId: "018f4c6b-7725-4b6a-9123-a85751000abc", userEmail: "user@example.com" }),
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

test("action email links contain only short-lived token URLs, not user data", () => {
  const verification = renderEmailVerificationEmail({
    contacts,
    expiresAt: new Date("2026-05-05T12:00:00Z"),
    verificationUrl: "https://tradeveto.com/api/auth/verify-email?token=sample-token",
  });
  const reset = renderPasswordResetEmail({
    contacts,
    expiresAt: new Date("2026-05-05T12:00:00Z"),
    resetUrl: "https://tradeveto.com/reset-password?token=sample-token",
  });

  assert.match(verification.text, /token=sample-token/);
  assert.match(reset.text, /token=sample-token/);
  assert.doesNotMatch(verification.text + reset.text, /email=|user_id=|stripe|session=/i);
});
