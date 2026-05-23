import assert from "node:assert/strict";
import test from "node:test";
import { buildVisibleTrustStates, certificationGateStatusFromEvent, classifyProviderOperationalState } from "./production-trust-status";

test("provider operational state reflects stale, limited, fallback, and active evidence", () => {
  assert.equal(classifyProviderOperationalState({ providerCount: 1, providerFallbackCount: 0, scannerAgeMinutes: 8, scannerStatus: "fresh" }), "active");
  assert.equal(classifyProviderOperationalState({ providerCount: 0, providerFallbackCount: 0, scannerAgeMinutes: 8, scannerStatus: "fresh" }), "limited");
  assert.equal(classifyProviderOperationalState({ providerCount: 1, providerFallbackCount: 3, scannerAgeMinutes: 8, scannerStatus: "fresh" }), "partial-outage");
  assert.equal(classifyProviderOperationalState({ providerCount: 1, providerFallbackCount: 0, scannerAgeMinutes: 180, scannerStatus: "stale" }), "stale");
  assert.equal(classifyProviderOperationalState({ providerCount: 1, providerFallbackCount: 0, scannerAgeMinutes: null, scannerStatus: "missing" }), "outage");
});

test("visible trust states activate stale, delayed, provider, and degraded disclosures honestly", () => {
  const states = buildVisibleTrustStates({
    backupStatus: "failed",
    dbStatus: "ok",
    incidentCount: 2,
    providerCount: 1,
    providerFallbackCount: 4,
    scannerAgeMinutes: 130,
    scannerStatus: "stale",
  });

  assert.equal(states.find((state) => state.key === "stale_intelligence")?.status, "active");
  assert.equal(states.find((state) => state.key === "delayed_data")?.status, "active");
  assert.equal(states.find((state) => state.key === "provider_outage")?.status, "active");
  assert.equal(states.find((state) => state.key === "degraded_mode")?.status, "active");
});

test("certification gate status refuses proof without events and maps partial/certified events", () => {
  assert.equal(certificationGateStatusFromEvent({ eventStatus: null, hasEvidence: false }), "unknown");
  assert.equal(certificationGateStatusFromEvent({ eventStatus: "ok", hasEvidence: true }), "certified");
  assert.equal(certificationGateStatusFromEvent({ eventStatus: "warning", hasEvidence: true }), "partial");
  assert.equal(certificationGateStatusFromEvent({ eventStatus: "failed", hasEvidence: true }), "blocked");
});
