import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DEFAULT_WORKSPACE_MODULE_ORDER,
  DEFAULT_WORKSPACE_PREFERENCES,
  applyWorkspaceMode,
  normalizeWorkspacePreferences,
} from "./workspace-preferences";

describe("workspace preferences", () => {
  test("normalizes unknown payloads to safe defaults", () => {
    assert.deepEqual(normalizeWorkspacePreferences(null), DEFAULT_WORKSPACE_PREFERENCES);
    assert.deepEqual(normalizeWorkspacePreferences({ moduleOrder: ["bad"], preferredRiskStyle: "wild" }).moduleOrder, DEFAULT_WORKSPACE_MODULE_ORDER);
    assert.equal(normalizeWorkspacePreferences({ workspaceMode: "not-real" }).workspaceMode, "balanced");
  });

  test("deduplicates modules, symbols, and timeframes", () => {
    const preferences = normalizeWorkspacePreferences({
      favoriteSymbols: ["amd", " AMD ", "NVDA", "$$$"],
      moduleOrder: ["watchlist", "watchlist", "macro", "bad", "best_setups"],
      preferredTimeframes: ["1D", "1D", "5Y", "bad"],
    });
    assert.deepEqual(preferences.favoriteSymbols, ["AMD", "NVDA"]);
    assert.deepEqual(preferences.moduleOrder, ["watchlist", "macro", "best_setups"]);
    assert.deepEqual(preferences.preferredTimeframes, ["1D", "5Y"]);
  });

  test("normalizes persisted chart workspaces for account sync", () => {
    const preferences = normalizeWorkspacePreferences({
      chart_workspaces: {
        amd: {
          drawingTool: "edit",
          fullscreenOpen: true,
          indicators: ["ema20", "bad"],
          period: "1y",
        },
      },
    });

    assert.equal(preferences.chartWorkspaces.AMD?.drawingTool, "edit");
    assert.equal(preferences.chartWorkspaces.AMD?.fullscreenOpen, true);
    assert.equal(preferences.chartWorkspaces.AMD?.period, "1y");
    assert.deepEqual(preferences.chartWorkspaces.AMD?.indicators, ["ema20"]);
  });

  test("applies workflow mode presets without touching unrelated choices", () => {
    const preferences = applyWorkspaceMode(
      normalizeWorkspacePreferences({
        favoriteSymbols: ["TSM"],
        preferredRiskStyle: "conservative",
      }),
      "watchlist_first",
    );
    assert.equal(preferences.workspaceMode, "watchlist_first");
    assert.equal(preferences.watchlistFirstMode, true);
    assert.equal(preferences.macroFirstMode, false);
    assert.equal(preferences.moduleOrder[0], "watchlist");
    assert.deepEqual(preferences.favoriteSymbols, ["TSM"]);
    assert.equal(preferences.preferredRiskStyle, "conservative");
  });
});
