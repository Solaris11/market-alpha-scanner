import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";

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
