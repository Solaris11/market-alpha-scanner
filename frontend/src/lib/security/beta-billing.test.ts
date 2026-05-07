import test from "node:test";
import assert from "node:assert/strict";
import { betaBillingCopy, parseBooleanFlag, parseTrialDays } from "./beta-billing";

test("trial days are bounded for clear beta billing", () => {
  assert.equal(parseTrialDays("14"), 14);
  assert.equal(parseTrialDays("0"), null);
  assert.equal(parseTrialDays("31"), null);
  assert.equal(parseTrialDays("abc"), null);
});

test("boolean flags accept explicit operator values", () => {
  assert.equal(parseBooleanFlag("true"), true);
  assert.equal(parseBooleanFlag("1"), true);
  assert.equal(parseBooleanFlag("yes"), true);
  assert.equal(parseBooleanFlag("false"), false);
});

test("beta billing copy is transparent about trials and promo codes", () => {
  const copy = betaBillingCopy({ allowPromotionCodes: true, trialDays: 14 });
  assert.match(copy, /14-day trial/);
  assert.match(copy, /promo codes/);
  assert.match(copy, /renewal price/);
});
