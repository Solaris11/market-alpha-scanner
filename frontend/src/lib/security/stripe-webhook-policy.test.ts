import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationIntentForStripeWebhook, stripeStatusGrantsPremium, type StripeWebhookSyncState } from "./stripe-webhook-policy";

const baseSync: StripeWebhookSyncState = {
  cancelAtPeriodEnd: false,
  currentPeriodEnd: "2026-06-04T08:32:02.000Z",
  previousCancelAtPeriodEnd: null,
  staleEvent: false,
  status: "active",
  userId: "user_test",
};

test("Stripe premium statuses are explicit", () => {
  assert.equal(stripeStatusGrantsPremium("active"), true);
  assert.equal(stripeStatusGrantsPremium("trialing"), true);
  assert.equal(stripeStatusGrantsPremium("canceled"), false);
  assert.equal(stripeStatusGrantsPremium("incomplete"), false);
  assert.equal(stripeStatusGrantsPremium("unpaid"), false);
});

test("checkout completion creates one premium activation intent", () => {
  const intent = notificationIntentForStripeWebhook("checkout.session.completed", baseSync);
  assert.equal(intent?.title, "Premium activated");
  assert.equal(intent?.dedupe, "once");
});

test("active subscription updates do not create repeated active notifications", () => {
  assert.equal(notificationIntentForStripeWebhook("customer.subscription.updated", baseSync), null);
});

test("scheduled cancellation creates a cancellation intent only on transition", () => {
  const firstCancel = notificationIntentForStripeWebhook("customer.subscription.updated", {
    ...baseSync,
    cancelAtPeriodEnd: true,
    previousCancelAtPeriodEnd: false,
  });
  assert.equal(firstCancel?.title, "Subscription canceled");
  assert.match(firstCancel?.message ?? "", /Jun 4, 2026/);

  const duplicateState = notificationIntentForStripeWebhook("customer.subscription.updated", {
    ...baseSync,
    cancelAtPeriodEnd: true,
    previousCancelAtPeriodEnd: true,
  });
  assert.equal(duplicateState, null);
});

test("renewal restore and payment failed produce actionable intents", () => {
  assert.equal(notificationIntentForStripeWebhook("customer.subscription.updated", {
    ...baseSync,
    previousCancelAtPeriodEnd: true,
  })?.title, "Premium renewal restored");
  assert.equal(notificationIntentForStripeWebhook("invoice.payment_failed", baseSync)?.title, "Payment failed");
});

test("stale or unmapped Stripe events do not notify", () => {
  assert.equal(notificationIntentForStripeWebhook("checkout.session.completed", { ...baseSync, staleEvent: true }), null);
  assert.equal(notificationIntentForStripeWebhook("checkout.session.completed", { ...baseSync, userId: null }), null);
});
