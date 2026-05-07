import assert from "node:assert/strict";
import test from "node:test";
import { buildAlertEnvelope, configuredAlertChannels } from "./external-alerts";

test("external alert configuration detects safe channels without secret values", () => {
  assert.deepEqual(configuredAlertChannels({ SLACK_WEBHOOK_URL: "https://hooks.slack.test/abc" } as unknown as NodeJS.ProcessEnv), ["slack"]);
  assert.deepEqual(configuredAlertChannels({ TELEGRAM_BOT_TOKEN: "token", TELEGRAM_CHAT_ID: "chat" } as unknown as NodeJS.ProcessEnv), ["telegram"]);
  assert.deepEqual(
    configuredAlertChannels({
      EMAIL_FROM: "alerts@tradeveto.com",
      SMTP_HOST: "smtp.example.com",
      SMTP_PASS: "pass",
      SMTP_USER: "user",
    } as unknown as NodeJS.ProcessEnv),
    ["email"],
  );
});

test("external alert envelope redacts sensitive metadata and values", () => {
  const envelope = buildAlertEnvelope({
    eventType: "stripe:webhook_failure",
    message: "failed with Bearer abcdefghijklmnopqrstuvwxyz0123456789",
    metadata: {
      Authorization: "Bearer secret-token",
      nested: { stripeSignature: "t=1,v1=secret", safe: "ok" },
      token: "secret",
      url: "https://tradeveto.com/api/health",
      webhook: "whsec_1234567890abcdef",
    },
    severity: "critical",
    status: "fail",
  });
  const serialized = JSON.stringify(envelope);
  assert.doesNotMatch(serialized, /secret-token|whsec_1234567890abcdef|abcdefghijklmnopqrstuvwxyz0123456789|Authorization/);
  assert.match(serialized, /redacted|ok/);
});
