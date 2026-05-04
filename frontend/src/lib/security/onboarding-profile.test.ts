import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRiskExperienceLevel, normalizeTimezone, requiresAccountOnboarding } from "./onboarding-profile";

test("risk experience accepts only production onboarding levels", () => {
  assert.equal(normalizeRiskExperienceLevel("beginner"), "beginner");
  assert.equal(normalizeRiskExperienceLevel("Intermediate"), "intermediate");
  assert.equal(normalizeRiskExperienceLevel("advanced"), "advanced");
  assert.equal(normalizeRiskExperienceLevel("professional"), null);
});

test("timezone normalization requires a real timezone", () => {
  assert.equal(normalizeTimezone("America/Los_Angeles"), "America/Los_Angeles");
  assert.equal(normalizeTimezone("UTC"), "UTC");
  assert.equal(normalizeTimezone("not a timezone"), null);
});

test("account onboarding is required until fields and completion flag are saved", () => {
  assert.equal(requiresAccountOnboarding(null), false);
  assert.equal(requiresAccountOnboarding({ onboardingCompleted: false, riskExperienceLevel: "beginner", timezone: "UTC" }), true);
  assert.equal(requiresAccountOnboarding({ onboardingCompleted: true, riskExperienceLevel: null, timezone: "UTC" }), true);
  assert.equal(requiresAccountOnboarding({ onboardingCompleted: true, riskExperienceLevel: "professional", timezone: "UTC" }), true);
  assert.equal(requiresAccountOnboarding({ onboardingCompleted: true, riskExperienceLevel: "advanced", timezone: "America/New_York" }), false);
});
