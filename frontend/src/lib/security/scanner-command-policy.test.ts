import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAST_SCAN_SYMBOLS, fastScanSymbolArg, scannerCommandStatusFromOutput } from "./scanner-command-policy";

describe("scanner command policy", () => {
  it("detects already-running scanner output", () => {
    assert.equal(scannerCommandStatusFromOutput("[scanner] another run in progress, skipping", ""), "already_running");
    assert.equal(scannerCommandStatusFromOutput("", "Scanner is already running."), "already_running");
  });

  it("keeps the operator refresh scan constrained to the fast validation set", () => {
    assert.equal(FAST_SCAN_SYMBOLS.includes("BTC-USD"), true);
    assert.equal(FAST_SCAN_SYMBOLS.length, 13);
    assert.equal(fastScanSymbolArg().split(",").length, 13);
  });
});
