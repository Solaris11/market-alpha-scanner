import assert from "node:assert/strict";
import test from "node:test";
import { checkoutBlockReason } from "./billing-readiness";
import { emailVerificationTokenIsUsable, hashEmailVerificationToken } from "./email-verification";

test("checkout requires latest legal acceptance", () => {
  assert.equal(checkoutBlockReason({ emailVerified: true, legalAccepted: false }), "legal_not_accepted");
});

test("checkout requires verified email after legal acceptance", () => {
  assert.equal(checkoutBlockReason({ emailVerified: false, legalAccepted: true }), "email_not_verified");
});

test("checkout is allowed after legal acceptance and email verification", () => {
  assert.equal(checkoutBlockReason({ emailVerified: true, legalAccepted: true }), null);
});

test("email verification token hash does not store the raw token", () => {
  const rawToken = "browser-email-verification-token";
  const hashed = hashEmailVerificationToken(rawToken);

  assert.notEqual(hashed, rawToken);
  assert.equal(hashed.length, 64);
});

test("expired email verification token is rejected", () => {
  const now = new Date("2026-05-04T12:00:00.000Z");

  assert.equal(emailVerificationTokenIsUsable({ expiresAt: "2026-05-04T11:59:00.000Z", usedAt: null }, now), false);
});

test("used email verification token is rejected", () => {
  const now = new Date("2026-05-04T12:00:00.000Z");

  assert.equal(emailVerificationTokenIsUsable({ expiresAt: "2026-05-04T13:00:00.000Z", usedAt: "2026-05-04T11:00:00.000Z" }, now), false);
});
