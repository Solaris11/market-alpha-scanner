import assert from "node:assert/strict";
import test from "node:test";
import type { RankingRow } from "@/lib/types";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildOpportunityTrustModel } from "./institutional-trust";
import {
  buildTrustArchitectureFromInstitutionalModel,
  certifyTrustArchitecture,
  governConfidence,
  sourceTraceabilityFromVerifiedNews,
} from "./trust-architecture";

function rankingRow(overrides: Partial<RankingRow> = {}): RankingRow {
  return {
    company_name: "Advanced Micro Devices, Inc.",
    evidence_maturity: "limited",
    evidence_sample_size: 4,
    event_risk_score: 74,
    final_decision: "WATCH",
    final_score: 76,
    last_updated: "2026-05-08T20:00:00.000Z",
    macro_alignment_score: 42,
    momentum_score: 82,
    price: 101,
    symbol: "AMD",
    volatility_pressure: 72,
    ...overrides,
  };
}

function opportunity(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const raw = rankingRow(overrides.raw ?? {});
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: "Advanced Micro Devices, Inc.",
    confidenceLabel: "Medium",
    conviction: 54,
    dataFreshness: {
      ageMinutes: 45,
      humanAge: "Updated 45 min ago",
      label: "Stale",
      lastUpdated: "2026-05-08T20:00:00.000Z",
      message: "Stale - updated 45 min ago",
      status: "stale",
    },
    decayLabel: "Needs refresh",
    decision_reason: "Research context is interesting but risk pressure is elevated.",
    entryStatus: "watch",
    entryZoneLabel: "$98-$101",
    eventLabel: "Event Risk Elevated",
    eventRisk: 74,
    evidence: {
      analogQualityScore: 12,
      calibrationDrift: 30,
      confidenceConfidence: 20,
      confidenceReliability: 18,
      evidenceConsistency: 14,
      evidenceSampleSize: 4,
      historicalDepthDays: 2,
      label: "Limited Evidence",
      limitations: ["Only 4 comparable observations are available."],
      outcomeCoverage: 8,
      reasons: ["4 comparable observations"],
      score: 18,
      setupReliabilityHistory: 18,
      tier: "limited",
    },
    final_decision: "WATCH",
    final_score: 76,
    fragility: 78,
    fragilityLabel: "Elevated",
    macroAdjustment: -4,
    macroLabel: "Macro Mixed",
    narrative: null,
    price: 101,
    raw,
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Technology",
    shockPattern: null,
    stop_loss: 94,
    structuralLabel: "Fragile structure",
    suggested_entry: 99,
    symbol: "AMD",
    target: 118,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

test("confidence governance downgrades stale, limited, conflicting packets", () => {
  const governed = governConfidence({
    conflictCount: 2,
    evidenceScore: 18,
    freshnessStatus: "stale",
    rawConfidence: 82,
    sourceCount: 0,
  });

  assert.equal(governed.state, "stale");
  assert.equal(governed.band, "low");
  assert.ok(governed.governedConfidence < governed.rawConfidence);
  assert.ok(governed.downgradeReasons.some((item) => /stale/i.test(item)));
  assert.ok(governed.downgradeReasons.some((item) => /limited/i.test(item)));
});

test("trust architecture exposes lineage, reproducibility, audit trail, and stale warnings", () => {
  const trustModel = buildOpportunityTrustModel(opportunity(), { shownBecause: "Shown by scanner filter.", watchlisted: true });
  const packet = buildTrustArchitectureFromInstitutionalModel(trustModel);
  const certification = certifyTrustArchitecture(packet);

  assert.ok(packet.evidenceLineage.length >= 3);
  assert.ok(packet.evidenceLineage.some((item) => item.category === "freshness"));
  assert.ok(packet.reproducibility.some((item) => /freshness|decision|risk|evidence/i.test(item)));
  assert.ok(packet.auditTrail.some((item) => /scanner row|trust score/i.test(item)));
  assert.ok(packet.warnings.some((item) => /limited|stale|risk|fragility/i.test(item)));
  assert.deepEqual(certification.blockers, []);
  assert.equal(certification.passed, true);
});

test("source traceability accepts verified linked news and rejects spoofed sources", () => {
  const verified = sourceTraceabilityFromVerifiedNews({
    headline: "AMD reports earnings date",
    impactTag: "Moderate impact",
    sentimentTag: "Neutral",
    source: "Reuters",
    timestamp: "2026-05-08T20:00:00.000Z",
    url: "https://www.reuters.com/markets/example",
  });
  const rejected = sourceTraceabilityFromVerifiedNews({
    headline: "Unverified social rumor",
    impactTag: "High impact",
    sentimentTag: "Supportive",
    source: "Reuters",
    timestamp: "2026-05-08T20:00:00.000Z",
    url: "https://example.com/rumor",
  });

  assert.equal(verified.status, "verified");
  assert.equal(rejected.status, "rejected");
});

test("certification blocks forbidden certainty or direct advice language", () => {
  const trustModel = buildOpportunityTrustModel(opportunity());
  const packet = buildTrustArchitectureFromInstitutionalModel({
    ...trustModel,
    summary: `${trustModel.summary} You should buy now for guaranteed profit.`,
  });
  const certification = certifyTrustArchitecture(packet);

  assert.equal(certification.passed, false);
  assert.ok(certification.blockers.some((item) => /forbidden|financial advice/i.test(item)));
});
