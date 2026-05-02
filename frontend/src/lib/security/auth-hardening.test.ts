import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { devConfigPremiumEnabled, productionMockPremiumEnabled, subscriptionGrantsPremium } from "./entitlement-policy";
import { hashSessionToken, sessionHashSecret } from "./session-token";

test("raw session token is not stored when hashed", () => {
  const rawToken = "browser-only-session-token";
  const secret = "test-session-secret";
  const hashed = hashSessionToken(rawToken, secret);

  assert.notEqual(hashed, rawToken);
  assert.equal(hashed, createHmac("sha256", secret).update(rawToken).digest("hex"));
});

test("session lookup hash is stable for the same raw token and secret", () => {
  const rawToken = "lookup-token";
  const secret = "lookup-secret";

  assert.equal(hashSessionToken(rawToken, secret), hashSessionToken(rawToken, secret));
  assert.notEqual(hashSessionToken(rawToken, secret), hashSessionToken(`${rawToken}-other`, secret));
});

test("production mock premium does not grant premium", () => {
  const env = {
    MARKET_ALPHA_MOCK_PREMIUM: "true",
    MARKET_ALPHA_PREMIUM_EMAILS: "paid@example.com",
    NODE_ENV: "production",
  } as NodeJS.ProcessEnv;

  assert.equal(productionMockPremiumEnabled(env), true);
  assert.equal(devConfigPremiumEnabled("paid@example.com", env), false);
});

test("expired and inactive subscriptions do not grant premium", () => {
  const now = new Date("2026-05-01T00:00:00.000Z");

  assert.equal(subscriptionGrantsPremium({ currentPeriodEnd: "2026-05-02T00:00:00.000Z", plan: "premium", status: "inactive" }, now), false);
  assert.equal(subscriptionGrantsPremium({ currentPeriodEnd: "2026-04-30T00:00:00.000Z", plan: "premium", status: "active" }, now), false);
  assert.equal(subscriptionGrantsPremium({ currentPeriodEnd: null, plan: "premium", status: "active" }, now), false);
});

test("active and trialing unexpired premium subscriptions grant premium", () => {
  const now = new Date("2026-05-01T00:00:00.000Z");

  assert.equal(subscriptionGrantsPremium({ currentPeriodEnd: "2026-05-02T00:00:00.000Z", plan: "premium", status: "active" }, now), true);
  assert.equal(subscriptionGrantsPremium({ currentPeriodEnd: "2026-05-02T00:00:00.000Z", plan: "premium", status: "trialing" }, now), true);
  assert.equal(subscriptionGrantsPremium({ currentPeriodEnd: "2026-05-02T00:00:00.000Z", plan: "free", status: "active" }, now), false);
});

test("production requires a real session hashing secret", () => {
  assert.throws(
    () => sessionHashSecret({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    /Session secret is not configured/,
  );
  assert.equal(sessionHashSecret({ MARKET_ALPHA_SESSION_SECRET: "configured", NODE_ENV: "production" } as NodeJS.ProcessEnv), "configured");
});
