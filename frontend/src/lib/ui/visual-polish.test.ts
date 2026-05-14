import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SEMANTIC_TONES, semanticToneClass, semanticToneForStatus, shouldEnablePresentationMode } from "./visual-polish";

describe("visual polish policy", () => {
  test("enables presentation mode only through explicit operator query flags", () => {
    assert.equal(shouldEnablePresentationMode("?presentation=1"), true);
    assert.equal(shouldEnablePresentationMode("demo=true"), true);
    assert.equal(shouldEnablePresentationMode("?present=yes"), true);
    assert.equal(shouldEnablePresentationMode("?presentation=0"), false);
    assert.equal(shouldEnablePresentationMode("?mode=demo"), false);
  });

  test("maps status language to non-advisory semantic tones", () => {
    assert.equal(semanticToneForStatus("Setup improving"), "constructive");
    assert.equal(semanticToneForStatus("WAIT for confirmation"), "caution");
    assert.equal(semanticToneForStatus("Elevated risk pressure"), "elevated");
    assert.equal(semanticToneForStatus("Dangerous now"), "dangerous");
    assert.equal(semanticToneForStatus("Replay intelligence"), "intelligence");
    assert.equal(semanticToneForStatus("System context"), "neutral");
  });

  test("semantic tone classes are stable and avoid buy/sell advice wording", () => {
    const labels = Object.values(SEMANTIC_TONES).map((tone) => tone.label.toLowerCase()).join(" ");
    assert.equal(labels.includes("buy"), false);
    assert.equal(labels.includes("sell"), false);
    assert.equal(semanticToneClass("High risk warning"), "tv-status-elevated");
  });
});

