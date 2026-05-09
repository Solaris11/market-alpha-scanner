import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkflowEvolution, maturityStateFor, snapshotFromWorkflowRow, type WorkflowSignalSnapshot } from "./workflow-evolution";
import type { RankingRow } from "../types";

function row(overrides: Partial<RankingRow> = {}): RankingRow {
  return {
    symbol: "AMD",
    entry_distance_pct: 2.2,
    event_risk_score: 48,
    event_shock_pressure_score: 54,
    final_decision: "WATCH",
    final_score: 70,
    fragility_score: 45,
    macro_alignment_score: 65,
    price: 100,
    return_1d: 1.2,
    sector: "Semiconductors",
    setup_type: "PULLBACK",
    ...overrides,
  };
}

function previous(overrides: Partial<WorkflowSignalSnapshot> = {}): WorkflowSignalSnapshot {
  return {
    capturedAt: "2026-05-08T20:00:00.000Z",
    convictionScore: 58,
    entryDistancePct: 5,
    eventPressureScore: 44,
    finalDecision: "WAIT",
    finalScore: 61,
    fragilityScore: 42,
    macroAlignmentScore: 68,
    maturityState: "Early Formation",
    metadata: {},
    return1d: 0.5,
    setupType: "PULLBACK",
    shockPressureScore: 50,
    symbol: "AMD",
    ...overrides,
  };
}

test("opportunity maturity labels trigger proximity and chase risk", () => {
  assert.equal(maturityStateFor({ entryDistancePct: 1.1, finalDecision: "WATCH", finalScore: 72, fragilityScore: 45, return1d: 1, setupType: "PULLBACK" }), "Trigger Approaching");
  assert.equal(maturityStateFor({ entryDistancePct: 8, finalDecision: "WATCH", finalScore: 80, fragilityScore: 78, return1d: 8, setupType: "BREAKOUT" }), "High Chase Risk");
  assert.equal(maturityStateFor({ entryDistancePct: 4, finalDecision: "AVOID", finalScore: 49, fragilityScore: 55, return1d: -1, setupType: "BREAKOUT" }), "Decaying");
});

test("workflow evolution detects improving setups and trigger monitors since last visit", () => {
  const summary = buildWorkflowEvolution(
    [
      row({
        entry_distance_pct: 1.4,
        event_shock_pressure_score: 68,
        final_score: 72,
        macro_alignment_score: 66,
        symbol: "AMD",
      }),
    ],
    {
      lastSeenAt: "2026-05-08T20:00:00.000Z",
      previousSnapshots: [previous({ finalScore: 60, shockPressureScore: 52 })],
      watchlistSymbols: ["AMD"],
    },
  );

  assert.ok(summary.whatChanged.some((item) => item.changeType === "improving"));
  assert.ok(summary.watchlistEvolution.some((item) => item.symbol === "AMD"));
  assert.ok(summary.triggerMonitors.some((item) => item.symbol === "AMD"));
  assert.ok(summary.dailyBrief.some((item) => item.toLowerCase().includes("improved") || item.toLowerCase().includes("trigger")));
});

test("workflow evolution detects fragility and macro deterioration without direct advice", () => {
  const summary = buildWorkflowEvolution(
    [
      row({
        entry_distance_pct: 7,
        final_score: 70,
        fragility_score: 82,
        macro_alignment_score: 48,
        return_1d: 7,
        symbol: "DDOG",
      }),
    ],
    {
      previousSnapshots: [previous({ fragilityScore: 60, macroAlignmentScore: 70, symbol: "DDOG" })],
    },
  );
  const combined = summary.whatChanged.map((item) => `${item.title} ${item.detail}`).join(" ");

  assert.ok(summary.whatChanged.some((item) => item.changeType === "fragility_rising"));
  assert.ok(summary.whatChanged.some((item) => item.changeType === "macro_shift"));
  assert.doesNotMatch(combined, /buy now|guaranteed|sure profit/i);
});

test("workflow baseline starts honestly when no prior snapshot exists", () => {
  const summary = buildWorkflowEvolution([row({ symbol: "TSM" })], { previousSnapshots: [] });

  assert.equal(summary.whatChanged[0]?.changeType, "memory_starting");
  assert.equal(summary.snapshotRows[0]?.symbol, "TSM");
  assert.ok(summary.dailyBrief[0]?.toLowerCase().includes("future sessions"));
});

test("workflow snapshot stores bounded structured market context", () => {
  const snapshot = snapshotFromWorkflowRow(row({ company_name: "Advanced Micro Devices", macro_context_label: "Macro Aligned", symbol: "amd" }));

  assert.equal(snapshot?.symbol, "AMD");
  assert.equal(snapshot?.finalScore, 70);
  assert.equal(snapshot?.metadata["companyName"], "Advanced Micro Devices");
  assert.equal(snapshot?.metadata["macroContext"], "Macro Aligned");
});
