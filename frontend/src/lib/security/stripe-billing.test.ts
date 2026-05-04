import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { stripeSubscriptionAccessEnd, stripeSubscriptionCancelScheduled } from "./stripe-subscription-state";

test("Stripe webhook verification rejects a bad signature", () => {
  const stripe = new Stripe(["sk", "test", "placeholder"].join("_"));
  const secret = ["webhook", "test", "secret"].join("_");
  const payload = JSON.stringify({
    data: { object: {} },
    id: "evt_test",
    object: "event",
    type: "checkout.session.completed",
  });
  const validSignature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });

  assert.doesNotThrow(() => stripe.webhooks.constructEvent(payload, validSignature, secret));
  assert.throws(() => stripe.webhooks.constructEvent(payload, "bad_signature", secret));
});

test("Stripe cancel_at marks an active subscription as scheduled cancellation", () => {
  const subscription = {
    cancel_at: 1780561922,
    cancel_at_period_end: false,
    items: {
      data: [{ current_period_end: 1780561922 }],
    },
    status: "active",
    trial_end: null,
  };

  assert.equal(stripeSubscriptionCancelScheduled(subscription), true);
  assert.equal(stripeSubscriptionAccessEnd(subscription)?.toISOString(), "2026-06-04T08:32:02.000Z");
});

test("Stripe active subscription without cancel_at remains renewing", () => {
  const subscription = {
    cancel_at: null,
    cancel_at_period_end: false,
    items: {
      data: [{ current_period_end: 1783153922 }],
    },
    status: "active",
    trial_end: null,
  };

  assert.equal(stripeSubscriptionCancelScheduled(subscription), false);
  assert.equal(stripeSubscriptionAccessEnd(subscription)?.toISOString(), "2026-07-04T08:32:02.000Z");
});
