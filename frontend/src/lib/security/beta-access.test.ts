import test from "node:test";
import assert from "node:assert/strict";
import { applyBetaUserCap, betaSignupDecision, parseAllowedBetaEmails, parseBetaSignupMode, parseBetaUserCap } from "./beta-access";

test("beta signup defaults to open for safe backwards compatibility", () => {
  assert.equal(parseBetaSignupMode(undefined), "open");
  const decision = betaSignupDecision({ email: "user@example.com" }, { allowedEmails: [], inviteCode: null, mode: "open" });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "open");
});

test("invite mode accepts only configured invite code or allowlisted email", () => {
  const config = { allowedEmails: ["allowed@example.com"], inviteCode: "CODE-123", mode: "invite" as const };
  assert.equal(betaSignupDecision({ email: "allowed@example.com" }, config).reason, "allowed_email");
  assert.equal(betaSignupDecision({ email: "new@example.com", inviteCode: "CODE-123" }, config).reason, "invite_code");
  const blocked = betaSignupDecision({ email: "new@example.com", inviteCode: "wrong" }, config);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "invite_required");
});

test("closed mode blocks new users unless allowlisted", () => {
  const config = { allowedEmails: ["founder@example.com"], inviteCode: "IGNORED", mode: "closed" as const };
  assert.equal(betaSignupDecision({ email: "founder@example.com" }, config).allowed, true);
  assert.equal(betaSignupDecision({ email: "new@example.com", inviteCode: "IGNORED" }, config).allowed, false);
});

test("allowed beta emails are normalized from comma and newline lists", () => {
  assert.deepEqual(parseAllowedBetaEmails(" A@Example.com,invalid\nb@example.com "), ["a@example.com", "b@example.com"]);
});

test("beta user cap blocks new cohort signups once full", () => {
  const openDecision = betaSignupDecision({ email: "new@example.com" }, { allowedEmails: [], inviteCode: null, mode: "open" });
  const blocked = applyBetaUserCap(openDecision, { cap: 25, currentUsers: 25 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "cohort_full");
  assert.match(blocked.message ?? "", /25-member early-access cohort/);
});

test("beta user cap still allows operators and existing users", () => {
  const allowedEmail = betaSignupDecision({ email: "founder@example.com" }, { allowedEmails: ["founder@example.com"], inviteCode: null, mode: "open" });
  assert.equal(applyBetaUserCap(allowedEmail, { cap: 25, currentUsers: 25 }).allowed, true);

  const existingUser = { allowed: true, message: null, reason: "existing_user" as const };
  assert.equal(applyBetaUserCap(existingUser, { cap: 25, currentUsers: 25 }).allowed, true);
});

test("beta user cap parser defaults to 25 and supports explicit disable", () => {
  assert.equal(parseBetaUserCap(undefined), 25);
  assert.equal(parseBetaUserCap(""), 25);
  assert.equal(parseBetaUserCap("0"), 0);
  assert.equal(parseBetaUserCap("12"), 12);
  assert.equal(parseBetaUserCap("not-a-number"), 25);
});
