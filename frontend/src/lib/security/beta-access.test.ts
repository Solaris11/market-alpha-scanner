import test from "node:test";
import assert from "node:assert/strict";
import { betaSignupDecision, parseAllowedBetaEmails, parseBetaSignupMode } from "./beta-access";

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
