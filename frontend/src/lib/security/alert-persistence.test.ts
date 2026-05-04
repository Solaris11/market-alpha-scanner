import test from "node:test";
import assert from "node:assert/strict";
import { ALERT_STORAGE_BACKEND, alertAccessState, alertReadIsUserScoped, alertRulePayload } from "./alert-persistence";

test("alerts use postgres as the production persistence backend", () => {
  assert.equal(ALERT_STORAGE_BACKEND, "postgres");
});

test("alert access policy blocks anonymous and free users from premium alert automation", () => {
  assert.equal(alertAccessState({ authenticated: false, isPremium: false }), "anonymous");
  assert.equal(alertAccessState({ authenticated: true, isPremium: false }), "free");
  assert.equal(alertAccessState({ authenticated: true, isPremium: true }), "premium");
});

test("alert rule payload preserves existing API shape without filesystem paths", () => {
  const payload = alertRulePayload({
    allowed_actions: ["BUY"],
    channels: ["email"],
    cooldown_minutes: 30,
    entry_filter: "good_only",
    max_alerts_per_run: 2,
    min_rating: "TOP",
    min_risk_reward: 1.5,
    min_score: 80,
    source: "user",
  });

  assert.deepEqual(payload, {
    allowed_actions: ["BUY"],
    channels: ["email"],
    cooldown_minutes: 30,
    entry_filter: "good_only",
    max_alerts_per_run: 2,
    min_rating: "TOP",
    min_risk_reward: 1.5,
    min_score: 80,
    source: "user",
  });
  assert.equal(JSON.stringify(payload).includes("scanner_output"), false);
});

test("alert repository read queries must include user ownership scope", () => {
  assert.equal(alertReadIsUserScoped("SELECT * FROM alert_rules WHERE user_id = $1 ORDER BY created_at"), true);
  assert.equal(alertReadIsUserScoped("SELECT * FROM alert_rules ORDER BY created_at"), false);
});
