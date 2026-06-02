import test from "node:test";
import assert from "node:assert/strict";
import { buildRevenueValidationReport } from "./revenue-validation";

test("revenue validation stays not ready when monetization proof is missing", () => {
  const report = buildRevenueValidationReport({
    campaigns: [],
    economics: {
      campaignPaidConversions: 0,
      campaignRevenueCents: null,
      campaignSpendCents: null,
      ltvBaselineCents: null,
      monthlyPriceCents: null,
      mrrCents: null,
    },
    funnel: {
      activatedUsers: 2,
      freeToPaidConversions: 0,
      freeUsers: 5,
      paidUsers: 0,
      retainedPaidUsers: 0,
      signups: 5,
      trialToPaidConversions: 0,
      trialUsers: 0,
      visitorActors: 20,
    },
    generatedAt: "2026-06-02T00:00:00.000Z",
    lookbackDays: 90,
  });

  assert.equal(report.status, "strong_partial");
  assert.equal(report.gates.firstPaidCustomers, false);
  assert.equal(report.economics.arpuCents, null);
  assert.match(report.blockers.join(" "), /No live paid customers/);
  assert.equal(report.noSyntheticRevenueDataCreated, true);
});

test("revenue validation computes funnel and business baselines from real evidence", () => {
  const report = buildRevenueValidationReport({
    campaigns: [
      {
        campaign: "founding-x",
        paidConversions: 2,
        revenueCents: 5800,
        signups: 8,
        source: "x",
        spendCents: 2000,
        visitors: 40,
      },
    ],
    economics: {
      campaignPaidConversions: 2,
      campaignRevenueCents: 5800,
      campaignSpendCents: 2000,
      ltvBaselineCents: 2900,
      monthlyPriceCents: 2900,
      mrrCents: null,
    },
    funnel: {
      activatedUsers: 6,
      freeToPaidConversions: 2,
      freeUsers: 10,
      paidUsers: 2,
      retainedPaidUsers: 1,
      signups: 8,
      trialToPaidConversions: 1,
      trialUsers: 2,
      visitorActors: 40,
    },
    generatedAt: "2026-06-02T00:00:00.000Z",
    lookbackDays: 90,
  });

  assert.equal(report.status, "ready");
  assert.equal(report.economics.mrrCents, 5800);
  assert.equal(report.economics.arrCents, 69600);
  assert.equal(report.economics.arpuCents, 2900);
  assert.equal(report.economics.cacCents, 1000);
  assert.equal(report.rates.visitorToSignupPct, 20);
  assert.equal(report.rates.signupToActivatedPct, 75);
  assert.equal(report.rates.paidRetentionPct, 50);
});
