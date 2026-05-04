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
  assert.equal(state.isPremium, true);
  assert.equal(state.isCanceled, true);
  assert.equal(state.willRenew, false);
  assert.equal(state.currentPeriodEnd?.toISOString(), "2026-06-04T08:32:02.000Z");
  assert.equal(state.statusText, "Subscription canceled");
  assert.equal(state.accessText, "Premium access active until Jun 4, 2026");
  assert.doesNotMatch(`${state.statusText} ${state.accessText} ${state.helper}`, /Renews on/);
  assert.equal(state.actionMode, "portal");
  assert.equal(state.actionLabel, "Renew Subscription");
  assert.equal(state.helper, "Your premium access will continue until Jun 4, 2026. Your subscription will not renew.");
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
  assert.equal(state.isPremium, true);
  assert.equal(state.isCanceled, true);
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
  assert.equal(state.isPremium, true);
  assert.equal(state.willRenew, false);
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
  assert.equal(state.isPremium, false);
  assert.equal(state.actionLabel, "Update billing");
  assert.equal(state.actionMode, "portal");
});

test("active billing state exposes renewal date and renewal flag", () => {
  const state = billingViewState({
    isPremium: true,
    subscription: {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2026-07-04T08:32:02.000Z",
      status: "active",
      stripeCustomerId: "cus_test",
    },
  });

  assert.equal(state.state, "active");
  assert.equal(state.isPremium, true);
  assert.equal(state.isCanceled, false);
  assert.equal(state.willRenew, true);
  assert.equal(state.accessText, "Renews on Jul 4, 2026");
});

test("canceled subscription does not render premium active renewal copy", () => {
  const state = billingViewState({
    isPremium: false,
    subscription: {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2026-06-04T08:32:02.000Z",
      status: "canceled",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
    },
  });

  assert.equal(state.state, "free");
  assert.equal(state.isPremium, false);
  assert.equal(state.willRenew, false);
  assert.equal(state.actionLabel, "Upgrade to Premium");
  assert.equal(state.actionMode, "checkout");
  assert.equal(state.statusText, "No active subscription");
  assert.doesNotMatch(`${state.statusText} ${state.accessText} ${state.helper}`, /Premium active|Renews on/);
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
  assert.equal(state.isPremium, false);
  assert.equal(state.actionMode, "checkout");
});
