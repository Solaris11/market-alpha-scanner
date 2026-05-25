import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildPaidUserCohortCertification, type RetentionCohortSegmentInput } from "./retention-cohort-certification";

const baseFoundingSegment: RetentionCohortSegmentInput = {
  activeDayUsers: 20,
  actors: 20,
  alertReturnUsers: 4,
  alertTriggerUsers: 20,
  eligibleD2Users: 18,
  eligibleD7Users: 14,
  firstUsefulActions: {
    alert: 8,
    chartSave: 7,
    morningBriefing: 9,
    replay: 6,
    scanner: 12,
    watchlist: 11,
  },
  notificationFeedbackTotal: 10,
  notificationUsefulFeedback: 7,
  retainedD2Users: 3,
  retainedD7Users: 1,
  segment: "founding_members",
  twoPlusActiveDayUsers: 4,
};

describe("paid user retention cohort certification", () => {
  test("passes only when elapsed founding cohorts meet all targets", () => {
    const proof = buildPaidUserCohortCertification([baseFoundingSegment]);

    assert.equal(proof.status, "ready");
    assert.equal(proof.blockers.length, 0);
    assert.equal(proof.paidSegment.d2RetentionRatePct, 16.666666666666664);
    assert.equal(proof.paidSegment.d7RetentionRatePct, 7.142857142857142);
    assert.equal(proof.paidSegment.alertReturnConversionPct, 20);
    assert.equal(proof.paidSegment.notificationUsefulRatioPct, 70);
  });

  test("does not claim success when paid cohorts have not aged to D7", () => {
    const proof = buildPaidUserCohortCertification([
      {
        ...baseFoundingSegment,
        eligibleD7Users: 0,
        retainedD7Users: 0,
      },
    ]);

    assert.equal(proof.status, "strong_partial");
    assert.ok(proof.blockers.some((blocker) => blocker.includes("D7 retention proof")));
    assert.match(proof.proofBoundary, /Same-day data/);
  });

  test("separates free, legacy, anonymous, and bot/noise segments without letting them satisfy paid gates", () => {
    const proof = buildPaidUserCohortCertification([
      { ...baseFoundingSegment, actors: 0, eligibleD2Users: 0, eligibleD7Users: 0, notificationFeedbackTotal: 0, segment: "founding_members" },
      { ...baseFoundingSegment, actors: 15, segment: "free_research_preview" },
      { ...baseFoundingSegment, actors: 7, segment: "legacy_users" },
      { ...baseFoundingSegment, actors: 40, segment: "anonymous_users" },
      { ...baseFoundingSegment, actors: 3, segment: "bot_or_noise_filtered" },
    ]);

    assert.equal(proof.status, "strong_partial");
    assert.equal(proof.sampleSize.foundingMemberActors, 0);
    assert.equal(proof.sampleSize.botOrNoiseActors, 3);
    assert.ok(proof.blockers.some((blocker) => blocker.includes("No founding member")));
  });
});
