import assert from "node:assert/strict";
import test from "node:test";
import {
  getLiveIntelligenceStreamHealthSnapshot,
  recordLiveIntelligenceStreamClose,
  recordLiveIntelligenceStreamError,
  recordLiveIntelligenceStreamEvent,
  recordLiveIntelligenceStreamOpen,
  resetLiveIntelligenceStreamHealthForTests,
} from "./live-intelligence-stream-health";

test("live intelligence stream health tracks opens, events, errors, and closes", () => {
  resetLiveIntelligenceStreamHealthForTests();
  const streamId = recordLiveIntelligenceStreamOpen(30_000);
  recordLiveIntelligenceStreamEvent(42);
  recordLiveIntelligenceStreamEvent(58);
  recordLiveIntelligenceStreamError(90);

  let snapshot = getLiveIntelligenceStreamHealthSnapshot();
  assert.equal(snapshot.activeStreams, 1);
  assert.equal(snapshot.openedStreamsLastHour, 1);
  assert.equal(snapshot.eventsLastHour, 2);
  assert.equal(snapshot.errorsLastHour, 1);
  assert.equal(snapshot.averageEventBuildMs, 50);
  assert.equal(snapshot.errorRatePct, 33);

  recordLiveIntelligenceStreamClose(streamId);
  snapshot = getLiveIntelligenceStreamHealthSnapshot();
  assert.equal(snapshot.activeStreams, 0);
  assert.equal(snapshot.closedStreamsLastHour, 1);
});

test("live intelligence stream health flags reconnect pressure from repeated errors", () => {
  resetLiveIntelligenceStreamHealthForTests();
  for (let index = 0; index < 5; index += 1) recordLiveIntelligenceStreamError(12);

  const snapshot = getLiveIntelligenceStreamHealthSnapshot();
  assert.equal(snapshot.reconnectPressure, "elevated");
});
