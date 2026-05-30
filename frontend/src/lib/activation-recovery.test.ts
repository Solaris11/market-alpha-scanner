import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  activationActionFromFirstUsefulAction,
  activationActionFromMilestone,
  buildActivationScoreModel,
} from "./activation-recovery";

describe("activation recovery model", () => {
  test("prioritizes watchlist, scanner, and symbol investigation for cold users", () => {
    const model = buildActivationScoreModel({});

    assert.equal(model.score, 0);
    assert.equal(model.level, "at_risk");
    assert.deepEqual(model.prompts.map((prompt) => prompt.action), ["watchlist", "scanner", "symbolInvestigation"]);
    assert.ok(model.summary.includes("high abandonment risk"));
  });

  test("scores durable activation anchors without requiring every workflow", () => {
    const model = buildActivationScoreModel({
      alert: true,
      chartSave: true,
      morningBriefing: true,
      scanner: true,
      symbolInvestigation: true,
      watchlist: true,
    });

    assert.equal(model.score, 82);
    assert.equal(model.level, "activated");
    assert.deepEqual(model.completedActions, ["scanner", "watchlist", "symbolInvestigation", "alert", "chartSave", "morningBriefing"]);
    assert.deepEqual(model.prompts.map((prompt) => prompt.action), ["compare", "history", "replay"]);
  });

  test("maps existing first-useful-action names into activation actions", () => {
    assert.equal(activationActionFromFirstUsefulAction("watchlist_add"), "watchlist");
    assert.equal(activationActionFromFirstUsefulAction("scanner_saved_scan"), "scanner");
    assert.equal(activationActionFromFirstUsefulAction("first_alert_creation"), "alert");
    assert.equal(activationActionFromFirstUsefulAction("chart_workspace_save"), "chartSave");
    assert.equal(activationActionFromFirstUsefulAction("symbol_research_start"), "symbolInvestigation");
    assert.equal(activationActionFromFirstUsefulAction("morning_briefing_complete"), "morningBriefing");
    assert.equal(activationActionFromFirstUsefulAction("unknown"), null);
  });

  test("maps activation milestones into activation actions", () => {
    assert.equal(activationActionFromMilestone("watchlist"), "watchlist");
    assert.equal(activationActionFromMilestone("scanner"), "scanner");
    assert.equal(activationActionFromMilestone("symbol_investigation"), "symbolInvestigation");
    assert.equal(activationActionFromMilestone("morning_command"), "morningBriefing");
    assert.equal(activationActionFromMilestone("chart"), null);
    assert.equal(activationActionFromMilestone("strategy"), null);
  });
});
