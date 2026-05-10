import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStripeMode, scopedStripeEventId, stripeTestEmailAllowed } from "./stripe-mode";

test("Stripe mode normalization defaults to live", () => {
  assert.equal(normalizeStripeMode(null), "live");
  assert.equal(normalizeStripeMode("live"), "live");
  assert.equal(normalizeStripeMode("test"), "test");
  assert.equal(normalizeStripeMode("staging"), "live");
});

test("test webhook event ids are isolated from live event ids", () => {
  assert.equal(scopedStripeEventId("live", "evt_123"), "evt_123");
  assert.equal(scopedStripeEventId("test", "evt_123"), "test:evt_123");
});

test("Stripe test mode allowlist is exact and case-insensitive", () => {
  assert.equal(stripeTestEmailAllowed("qa@example.com", "qa@example.com, ops@example.com"), true);
  assert.equal(stripeTestEmailAllowed("QA@EXAMPLE.COM", "qa@example.com"), true);
  assert.equal(stripeTestEmailAllowed("qa+other@example.com", "qa@example.com"), false);
  assert.equal(stripeTestEmailAllowed("qa@example.com", ""), false);
});

