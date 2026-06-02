import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  activationTierForScore,
  buildRetentionCrisisCertification,
  retentionExperimentCatalog,
  type RetentionActorForensicsInput,
} from "./retention-crisis-forensics";

function actor(overrides: Partial<RetentionActorForensicsInput> = {}): RetentionActorForensicsInput {
  return {
    activationScore: 0,
    activeDays: 1,
    actorKey: "actor-1",
    alertReturn: false,
    alertTriggered: false,
    eligibleD1: true,
    eligibleD2: true,
    eligibleD7: true,
    eligibleD30: true,
    exitSurface: "landing",
    firstUsefulActions: 0,
    notificationFeedbackTotal: 0,
    notificationUsefulFeedback: 0,
    retainedD1: false,
    retainedD2: false,
    retainedD7: false,
    retainedD30: false,
    segment: "anonymous_users",
    signupDate: "2026-05-01",
    workflows: {
      alert: false,
      chart: false,
      copilot: false,
      morningBriefing: false,
      replay: false,
      scanner: false,
      symbol: false,
      watchlist: false,
    },
    ...overrides,
  };
}

describe("retention crisis forensics", () => {
  test("does not certify catastrophic elapsed cohorts", () => {
    const certification = buildRetentionCrisisCertification([
      actor({ actorKey: "a", workflows: { ...actor().workflows, scanner: true } }),
      actor({ actorKey: "b", exitSurface: "scanner", workflows: { ...actor().workflows, scanner: true, symbol: true } }),
      actor({
        activeDays: 2,
        actorKey: "c",
        exitSurface: "symbol",
        firstUsefulActions: 1,
        retainedD1: true,
        workflows: { ...actor().workflows, scanner: true, watchlist: true },
      }),
    ]);

    assert.equal(certification.status, "strong_partial");
    assert.equal(certification.rateSummary.d1RetentionPct, 33.33333333333333);
    assert.equal(certification.rateSummary.d7RetentionPct, 0);
    assert.equal(certification.rateSummary.d30RetentionPct, 0);
    assert.ok(certification.blockers.some((blocker) => blocker.includes("D7 retention")));
    assert.ok(certification.blockers.some((blocker) => blocker.includes("D30 retention")));
    assert.ok(certification.behavioralFindings.some((finding) => finding.includes("activation score tiers below 25")));
    assert.ok(certification.workflowForensics.failingWorkflows.some((workflow) => workflow.workflow === "scanner"));
  });

  test("filters probe and internal admin actors from success criteria", () => {
    const certification = buildRetentionCrisisCertification([
      actor({
        activeDays: 5,
        actorKey: "probe",
        retainedD1: true,
        retainedD2: true,
        retainedD7: true,
        retainedD30: true,
        segment: "probe_noise_filtered",
      }),
    ]);

    assert.equal(certification.status, "not_ready");
    assert.equal(certification.sampleSize.actors, 1);
    assert.equal(certification.sampleSize.probeOrNoiseFilteredActors, 1);
    assert.equal(certification.sampleSize.realActors, 0);
    assert.ok(certification.blockers.includes("No real production actors remain after probe/noise filtering."));
  });

  test("certifies only when D1, D7, D30, and active-day targets pass", () => {
    const actors = Array.from({ length: 20 }, (_, index) =>
      actor({
        activationScore: 82,
        activeDays: index < 5 ? 3 : 1,
        actorKey: `paid-${index}`,
        firstUsefulActions: 2,
        retainedD1: index < 5,
        retainedD2: index < 4,
        retainedD7: index < 3,
        retainedD30: index < 2,
        segment: "founding_paid",
        workflows: { ...actor().workflows, alert: true, chart: true, scanner: true, watchlist: true },
      }),
    );
    const certification = buildRetentionCrisisCertification(actors);

    assert.equal(certification.status, "ready");
    assert.deepEqual(certification.blockers, []);
    assert.equal(certification.rateSummary.d1RetentionPct, 25);
    assert.equal(certification.rateSummary.d7RetentionPct, 15);
    assert.equal(certification.rateSummary.d30RetentionPct, 10);
    assert.equal(certification.rateSummary.twoPlusActiveDayPct, 25);
  });

  test("groups by signup date, activation score, and workflow usage", () => {
    const certification = buildRetentionCrisisCertification([
      actor({ activationScore: 0, actorKey: "zero", signupDate: "2026-05-01" }),
      actor({ activationScore: 30, actorKey: "mid", signupDate: "2026-05-02", workflows: { ...actor().workflows, watchlist: true } }),
      actor({ activationScore: 80, actorKey: "high", signupDate: "2026-05-02", workflows: { ...actor().workflows, watchlist: true, copilot: true } }),
    ]);

    assert.equal(activationTierForScore(0), "0");
    assert.equal(activationTierForScore(24), "1-24");
    assert.equal(activationTierForScore(50), "50-74");
    assert.equal(certification.signupDateCohorts.length, 2);
    assert.equal(certification.activationCohorts.find((cohort) => cohort.activationTier === "75+")?.actors, 1);
    assert.equal(certification.workflowCohorts.find((cohort) => cohort.workflow === "watchlist" && cohort.cohort === "used")?.actors, 2);
  });

  test("defines the required Phase 34.1 retention experiments", () => {
    const experiments = retentionExperimentCatalog();

    assert.equal(experiments.length, 6);
    assert.ok(experiments.some((experiment) => experiment.experimentKey === "phase34_onboarding_first_action"));
    assert.ok(experiments.some((experiment) => experiment.experimentKey === "phase34_morning_briefing"));
    assert.ok(experiments.some((experiment) => experiment.experimentKey === "phase34_copilot_prompt"));
  });
});
