import test from "node:test";
import assert from "node:assert/strict";
import { betaPremiumAccessEnabled, betaPremiumAccessForEmail, subscriptionGrantsPremium } from "./entitlement-policy";

test("subscription premium still requires premium active subscription with future period end", () => {
  assert.equal(subscriptionGrantsPremium({ currentPeriodEnd: "2099-01-01T00:00:00.000Z", plan: "premium", status: "active" }), true);
  assert.equal(subscriptionGrantsPremium({ currentPeriodEnd: "2099-01-01T00:00:00.000Z", plan: "free", status: "active" }), false);
  assert.equal(subscriptionGrantsPremium({ currentPeriodEnd: "2000-01-01T00:00:00.000Z", plan: "premium", status: "active" }), false);
});

test("invite-only beta mode grants retroactive beta premium without Stripe subscription state", () => {
  const result = betaPremiumAccessForEmail("member@example.com", {
    NODE_ENV: "test",
    TRADEVETO_BETA_INVITE_CODE: "configured",
    TRADEVETO_BETA_SIGNUP_MODE: "invite",
  } as NodeJS.ProcessEnv);

  assert.equal(result.active, true);
  assert.equal(result.source, "invite_beta");
  assert.equal(result.label, "Founding Early Access");
});

test("beta allowlist users receive founding beta premium label", () => {
  const result = betaPremiumAccessForEmail("founder@example.com", {
    NODE_ENV: "test",
    TRADEVETO_BETA_ALLOWED_EMAILS: " Founder@Example.com ",
    TRADEVETO_BETA_SIGNUP_MODE: "closed",
  } as NodeJS.ProcessEnv);

  assert.equal(result.active, true);
  assert.equal(result.source, "allowlist");
  assert.equal(result.label, "Founding Member");
});

test("beta premium access can be explicitly disabled", () => {
  assert.equal(
    betaPremiumAccessEnabled("member@example.com", {
      NODE_ENV: "test",
      TRADEVETO_BETA_INVITE_CODE: "configured",
      TRADEVETO_BETA_PREMIUM_ACCESS: "false",
      TRADEVETO_BETA_SIGNUP_MODE: "invite",
    } as NodeJS.ProcessEnv),
    false,
  );
});

test("open signup mode does not grant broad beta premium access", () => {
  assert.equal(
    betaPremiumAccessEnabled("member@example.com", {
      NODE_ENV: "test",
      TRADEVETO_BETA_INVITE_CODE: "configured",
      TRADEVETO_BETA_SIGNUP_MODE: "open",
    } as NodeJS.ProcessEnv),
    false,
  );
});
