import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildCompetitiveLeadershipCertification,
  competitiveCapabilities,
  competitivePlatforms,
  type CategoryLeadershipType,
} from "./competitive-leadership";

describe("competitive leadership certification", () => {
  test("covers every required competitor and capability", () => {
    const certification = buildCompetitiveLeadershipCertification();
    const expectedRows = competitivePlatforms.length * competitiveCapabilities.length;

    assert.equal(competitivePlatforms.length, 8);
    assert.equal(competitiveCapabilities.length, 11);
    assert.equal(certification.matrix.length, expectedRows);
    for (const platform of competitivePlatforms) {
      assert.ok(certification.sources.some((source) => source.platform === platform.id && source.url.startsWith("https://")));
      for (const capability of competitiveCapabilities) {
        assert.ok(certification.matrix.some((row) => row.platform === platform.id && row.capability === capability));
      }
    }
  });

  test("documents every behind ranking without treating non-target parity gaps as critical", () => {
    const certification = buildCompetitiveLeadershipCertification();
    const behindRows = certification.matrix.filter((row) => row.rank === "behind");

    assert.ok(behindRows.length > 0);
    assert.equal(certification.criticalGapCount, 0);
    for (const row of behindRows) {
      assert.notEqual(row.gap, "critical");
      assert.match(row.closurePlan, /Bounded closure|Close/i);
      assert.match(row.verification, /Documented/i);
    }
  });

  test("meets category leadership target counts without unsupported parity claims", () => {
    const certification = buildCompetitiveLeadershipCertification();
    const expectedMinimums: Record<CategoryLeadershipType, number> = { ai: 1, intelligence: 3, workflow: 2 };

    assert.equal(certification.overallStatus, "achieved");
    assert.equal(certification.finalVerdict, "TRADEVETO CATEGORY LEADER STATUS ACHIEVED");
    assert.equal(certification.noUnsupportedParityClaims, true);
    assert.ok(certification.proofBoundary.includes("does not claim full charting"));
    for (const [type, minimum] of Object.entries(expectedMinimums) as Array<[CategoryLeadershipType, number]>) {
      assert.ok(certification.leadershipCounts[type] >= minimum, `${type} count below target`);
    }
    assert.doesNotMatch(JSON.stringify(certification), /guaranteed|full TradingView parity|best in every category|broker execution/i);
  });
});
