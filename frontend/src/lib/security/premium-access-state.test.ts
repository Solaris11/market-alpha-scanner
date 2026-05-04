import test from "node:test";
import assert from "node:assert/strict";
import { premiumAccessCopy, premiumAccessState } from "./premium-access-state";

test("premium CTA state only allows sign in for anonymous users", () => {
  assert.equal(premiumAccessState({ authenticated: false }), "unauthenticated");
  assert.match(premiumAccessCopy("unauthenticated").helper, /Sign in/);
});

test("premium CTA state shows upgrade state for authenticated free users", () => {
  const state = premiumAccessState({ authenticated: true, isPremium: false, plan: "free" });

  assert.equal(state, "authenticated_free");
  assert.match(premiumAccessCopy(state).helper, /Upgrade/);
});

test("premium CTA state suppresses sign in and upgrade CTAs for premium users", () => {
  const state = premiumAccessState({ authenticated: true, isPremium: true, plan: "premium" });
  const copy = premiumAccessCopy(state);

  assert.equal(state, "authenticated_premium");
  assert.equal(copy.statusLabel, "Premium active");
  assert.doesNotMatch(copy.helper, /Sign in|Upgrade/);
});
