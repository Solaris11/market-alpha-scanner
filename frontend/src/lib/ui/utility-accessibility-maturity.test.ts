import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  UTILITY_ACCESSIBILITY_REQUIREMENTS,
  UTILITY_SURFACE_MATURITY,
  utilityAccessibilityGateSummary,
  utilitySurfaceById,
  utilitySurfaceCapabilityCoverage,
  type UtilitySurfaceId,
} from "./utility-accessibility-maturity";

const EXPECTED_SURFACES: UtilitySurfaceId[] = ["account", "settings", "support", "alerts", "history", "performance"];

describe("utility accessibility maturity", () => {
  test("covers every low-score utility surface with a 90+ target", () => {
    assert.deepEqual(UTILITY_SURFACE_MATURITY.map((surface) => surface.id), EXPECTED_SURFACES);
    for (const surface of UTILITY_SURFACE_MATURITY) {
      assert.equal(surface.scoreTarget >= 90, true, `${surface.id} should target 90+`);
      assert.equal(surface.capabilities.length >= 4, true, `${surface.id} needs production utility capabilities`);
      assert.equal(surface.accessibilityChecks.length >= 3, true, `${surface.id} needs accessibility checks`);
      assert.equal(surface.operatingProof.length >= 3, true, `${surface.id} needs operating proof`);
      assert.equal(utilitySurfaceCapabilityCoverage(surface), 100);
    }
  });

  test("maps mandatory Phase 22.9 capabilities to the correct utility surfaces", () => {
    const requiredCapabilities: Record<UtilitySurfaceId, readonly string[]> = {
      account: ["trust center", "subscription clarity", "session/device management", "data/privacy visibility"],
      alerts: ["usefulness feedback", "fatigue controls", "return conversion", "source-linked alert reasons"],
      history: ["replay timeline", "symbol continuity", "event memory", "trade autopsy links"],
      performance: ["p50/p95/p99 dashboards", "retention dashboards", "cache/stream/provider health", "operational drilldowns"],
      settings: ["notification preferences", "chart defaults", "scanner defaults", "mobile preferences", "data freshness preferences"],
      support: ["incident status", "provider outage help", "ticket clarity", "FAQ tied to intelligence workflows"],
    };

    for (const [surfaceId, capabilities] of Object.entries(requiredCapabilities) as Array<[UtilitySurfaceId, readonly string[]]>) {
      const surface = utilitySurfaceById(surfaceId);
      for (const capability of capabilities) {
        assert.equal(surface.capabilities.includes(capability), true, `${surfaceId} should include ${capability}`);
      }
    }
  });

  test("accessibility gate explicitly includes axe, keyboard, labels, touch, reduced motion, and contrast", () => {
    const summary = utilityAccessibilityGateSummary().toLowerCase();
    for (const term of ["axe", "keyboard", "accessible names", "touch target", "reduced-motion", "color"]) {
      assert.equal(summary.includes(term), true, `${term} should be part of the utility gate`);
    }
    assert.equal(UTILITY_ACCESSIBILITY_REQUIREMENTS.length >= 6, true);
  });
});
