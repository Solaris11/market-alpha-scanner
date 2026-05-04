import test from "node:test";
import assert from "node:assert/strict";
import { paymentFailedNotification, premiumActivatedNotification, subscriptionCanceledNotification } from "./subscription-notifications";

test("Stripe active webhook notification is deduped and points to account", () => {
  const notification = premiumActivatedNotification();

  assert.equal(notification.type, "subscription");
  assert.equal(notification.title, "Premium activated");
  assert.equal(notification.message, "Your Market Alpha Premium subscription is now active.");
  assert.equal(notification.actionUrl, "/account");
  assert.equal(notification.dedupe, "once");
});

test("Stripe cancellation notification includes access end date when available", () => {
  const notification = subscriptionCanceledNotification("2026-06-15T12:00:00.000Z");

  assert.equal(notification.type, "subscription");
  assert.equal(notification.title, "Subscription canceled");
  assert.match(notification.message, /Jun 15, 2026/);
  assert.equal(notification.actionUrl, "/account");
  assert.equal(notification.dedupe, "once");
});

test("Stripe cancellation notification handles missing period end", () => {
  const notification = subscriptionCanceledNotification(null);

  assert.equal(notification.title, "Subscription canceled");
  assert.equal(notification.message, "Your Premium subscription was canceled. Renew anytime to keep full access.");
});

test("Stripe payment failure notification prompts billing update", () => {
  const notification = paymentFailedNotification();

  assert.equal(notification.type, "subscription");
  assert.equal(notification.title, "Payment failed");
  assert.match(notification.message, /Update your billing details/);
  assert.equal(notification.actionUrl, "/account");
  assert.equal(notification.dedupe, "always");
});
