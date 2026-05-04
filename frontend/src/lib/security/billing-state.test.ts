import test from "node:test";
import assert from "node:assert/strict";
import { billingViewState } from "./billing-state";

test("account UI state for cancel scheduled shows active-until date", () => {
  const state = billingViewState({
    isPremium: true,
    subscription: {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-06-04T08:32:02.000Z",
      status: "active",
      stripeCustomerId: "cus_test",
    },
  });

  assert.equal(state.state, "cancel_scheduled");
  assert.equal(state.statusText, "Canceled — Premium active until Jun 4, 2026");
  assert.equal(state.actionMode, "portal");
  assert.equal(state.actionLabel, "Renew Premium");
  assert.equal(state.helper, "Your subscription will not renew.");
});

test("billing portal state works with customer id even when subscription is cancel scheduled", () => {
  const state = billingViewState({
    isPremium: true,
    subscription: {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-06-04T08:32:02.000Z",
      status: "active",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
    },
  });

  assert.equal(state.actionMode, "portal");
});

test("manual premium state does not claim Stripe billing profile exists", () => {
  const state = billingViewState({
    isPremium: true,
    subscription: {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2027-05-03T00:51:04.000Z",
      status: "active",
      stripeCustomerId: null,
    },
  });

  assert.equal(state.state, "manual_premium");
  assert.equal(state.actionMode, null);
  assert.match(state.helper ?? "", /no Stripe billing profile/);
});

test("past due state asks user to update billing", () => {
  const state = billingViewState({
    isPremium: false,
    subscription: {
      status: "past_due",
      stripeCustomerId: "cus_test",
    },
  });

  assert.equal(state.state, "past_due");
  assert.equal(state.actionLabel, "Update billing");
  assert.equal(state.actionMode, "portal");
});

test("account page state tolerates null subscription fields", () => {
  const state = billingViewState({
    isPremium: false,
    subscription: {
      cancelAtPeriodEnd: null,
      currentPeriodEnd: null,
      status: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    },
  });

  assert.equal(state.state, "free");
  assert.equal(state.actionMode, "checkout");
});
