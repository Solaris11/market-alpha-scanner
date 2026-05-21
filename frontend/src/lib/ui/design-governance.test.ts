import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  COMPONENT_GOVERNANCE,
  DESIGN_GOVERNANCE_TOKENS,
  MOTION_GOVERNANCE,
  Z_INDEX_GOVERNANCE,
  designGovernanceChecklist,
  governanceClassFor,
  governedToneClass,
} from "./design-governance";

describe("design system governance", () => {
  test("defines stable motion, z-index, radius, and spacing tokens", () => {
    assert.equal(MOTION_GOVERNANCE.instant.ms < MOTION_GOVERNANCE.fast.ms, true);
    assert.equal(MOTION_GOVERNANCE.fast.ms < MOTION_GOVERNANCE.standard.ms, true);
    assert.equal(MOTION_GOVERNANCE.standard.ms < MOTION_GOVERNANCE.slow.ms, true);
    assert.equal(Z_INDEX_GOVERNANCE.overlay.value > Z_INDEX_GOVERNANCE.feedback.value, true);
    assert.equal(Z_INDEX_GOVERNANCE.criticalOverlay.value > Z_INDEX_GOVERNANCE.overlay.value, true);
    assert.equal(DESIGN_GOVERNANCE_TOKENS.radius.chip, "999px");
    assert.match(DESIGN_GOVERNANCE_TOKENS.spacing.panel, /rem$/);
  });

  test("publishes canonical component contracts for high-risk interaction surfaces", () => {
    for (const key of ["panel", "chart", "overlay", "button", "scannerRow", "bottomSheet"] as const) {
      const contract = COMPONENT_GOVERNANCE[key];
      assert.equal(contract.className.startsWith("tv-governed-"), true);
      assert.equal(contract.requirements.length >= 3, true);
      assert.equal(governanceClassFor(key), contract.className);
    }
  });

  test("governance checklist covers accessibility, overlays, charts, scanner rows, and reduced motion", () => {
    const checklist = designGovernanceChecklist().join(" ").toLowerCase();
    for (const term of ["overlay", "chart", "scanner", "reduced-motion", "scroll position", "focus"]) {
      assert.equal(checklist.includes(term), true, `${term} should be part of governance`);
    }
  });

  test("tone classes are stable and avoid advice language", () => {
    const classes = [
      governedToneClass("neutral"),
      governedToneClass("constructive"),
      governedToneClass("caution"),
      governedToneClass("dangerous"),
      governedToneClass("intelligence"),
    ];

    assert.equal(new Set(classes).size, classes.length);
    assert.equal(classes.join(" ").includes("buy"), false);
    assert.equal(classes.join(" ").includes("sell"), false);
  });
});
