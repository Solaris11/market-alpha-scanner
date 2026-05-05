import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampConfidence, confidenceTone } from "./confidence";

describe("confidence tone mapping", () => {
  it("maps edge scores to the expected labels and bands", () => {
    assert.equal(confidenceTone(0).label, "LOW CONFIDENCE");
    assert.equal(confidenceTone(49).band, "low");
    assert.equal(confidenceTone(50).label, "MEDIUM CONFIDENCE");
    assert.equal(confidenceTone(69).band, "medium");
    assert.equal(confidenceTone(70).label, "HIGH CONFIDENCE");
    assert.equal(confidenceTone(100).band, "high");
  });

  it("clamps invalid and out-of-range scores", () => {
    assert.equal(clampConfidence(-10), 0);
    assert.equal(clampConfidence(125), 100);
    assert.equal(clampConfidence("70"), 70);
    assert.equal(clampConfidence("not-a-score"), 0);
  });
});
