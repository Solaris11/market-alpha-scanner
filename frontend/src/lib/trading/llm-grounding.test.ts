import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateLlmGrounding,
  groundingPacketFromStructuredData,
  safeLlmFallbackLanguage,
} from "./llm-grounding";

const basePacket = {
  dataFreshness: {
    lastUpdated: "2026-05-08T20:00:00.000Z",
    status: "fresh",
  },
  decision: {
    conviction: 76,
    finalDecision: "Watch",
    finalScore: 82,
    fragility: 58,
  },
  event: {
    available: true,
    recentEventTitles: ["BLS reports inflation pressure remains elevated"],
    reasonLabels: ["Inflation pressure"],
    riskScore: 68,
  },
  shock: {
    chaseRiskLabel: "Elevated chase risk",
    reliabilityScore: 61,
    upsideShockScore: 72,
  },
  symbol: "AMD",
};

test("llm grounding accepts schema-valid output grounded in structured packet", () => {
  const metrics = evaluateLlmGrounding({
    output: {
      answer: "AMD remains a Watch because final score 82, conviction 76, and fragility 58 are mixed with BLS reports inflation pressure remains elevated.",
      keyPoints: ["AMD score 82 is deterministic evidence.", "BLS reports inflation pressure remains elevated."],
      safetyLanguage: "Research only. Not financial advice.",
      unsupportedClaimsDetected: false,
      whatToWatch: ["Monitor whether inflation pressure eases."],
    },
    packet: groundingPacketFromStructuredData(basePacket),
    requiredFields: ["answer", "keyPoints", "safetyLanguage", "whatToWatch"],
  });

  assert.equal(metrics.schemaValidity, true);
  assert.equal(metrics.safeForUse, true);
  assert.equal(metrics.groundednessScore, 100);
});

test("llm grounding requires stale-data disclosure when packet is stale", () => {
  const metrics = evaluateLlmGrounding({
    output: {
      answer: "AMD remains a Watch based on prior scanner evidence.",
      keyPoints: ["Decision quality is mixed."],
      safetyLanguage: "Research only. Not financial advice.",
      unsupportedClaimsDetected: false,
      whatToWatch: ["Wait for fresh confirmation."],
    },
    packet: groundingPacketFromStructuredData({
      ...basePacket,
      dataFreshness: { lastUpdated: "2026-05-01T20:00:00.000Z", status: "stale" },
    }),
    requiredFields: ["answer", "keyPoints", "safetyLanguage", "whatToWatch"],
  });

  assert.equal(metrics.staleDataDisclosure, false);
  assert.equal(metrics.safeForUse, false);
  assert.ok(metrics.violations.includes("missing_stale_data_disclosure"));
});

test("llm grounding rejects deterministic score override language", () => {
  const metrics = evaluateLlmGrounding({
    output: {
      answer: "Ignore the deterministic score because AMD should buy now.",
      keyPoints: ["The scanner score is wrong."],
      safetyLanguage: "Research only. Not financial advice.",
      unsupportedClaimsDetected: false,
      whatToWatch: ["Price action."],
    },
    packet: groundingPacketFromStructuredData(basePacket),
    requiredFields: ["answer", "keyPoints", "safetyLanguage", "whatToWatch"],
  });

  assert.equal(metrics.deterministicOverrideDetected, true);
  assert.equal(metrics.forbiddenLanguageDetected, true);
  assert.equal(metrics.safeForUse, false);
});

test("llm grounding rejects invented news when event packet is missing", () => {
  const metrics = evaluateLlmGrounding({
    output: {
      answer: "Fed announced a surprise cut and AMD earnings confirmed a new upside catalyst.",
      keyPoints: ["Fresh Fed news supports the setup."],
      safetyLanguage: "Research only. Not financial advice.",
      unsupportedClaimsDetected: false,
      whatToWatch: ["Follow the news."],
    },
    packet: groundingPacketFromStructuredData({
      ...basePacket,
      event: { available: false, recentEventTitles: [], reasonLabels: [], riskScore: 50 },
    }),
    requiredFields: ["answer", "keyPoints", "safetyLanguage", "whatToWatch"],
  });

  assert.equal(metrics.inventedNewsDetected, true);
  assert.equal(metrics.unsupportedClaimsDetected, true);
  assert.equal(metrics.safeForUse, false);
});

test("llm grounding rejects invented prices and probabilities", () => {
  const metrics = evaluateLlmGrounding({
    output: {
      answer: "AMD has a 73% probability of continuation and a target price of $150.",
      keyPoints: ["The odds are high."],
      safetyLanguage: "Research only. Not financial advice.",
      unsupportedClaimsDetected: false,
      whatToWatch: ["Continuation."],
    },
    packet: groundingPacketFromStructuredData(basePacket),
    requiredFields: ["answer", "keyPoints", "safetyLanguage", "whatToWatch"],
  });

  assert.equal(metrics.inventedProbabilityDetected, true);
  assert.equal(metrics.inventedPriceDetected, true);
  assert.equal(metrics.safeForUse, false);
});

test("llm grounding allows high-risk shock explanation when it stays non-advisory", () => {
  const metrics = evaluateLlmGrounding({
    output: {
      answer: "AMD is a high-volatility watch, not a core buy signal. Upside shock score 72 and reliability score 61 are deterministic context.",
      keyPoints: ["Chase risk is elevated.", "Shock evidence is probabilistic."],
      safetyLanguage: "Speculative research only. Not financial advice.",
      unsupportedClaimsDetected: false,
      whatToWatch: ["Watch whether entry quality improves."],
    },
    packet: groundingPacketFromStructuredData(basePacket),
    requiredFields: ["answer", "keyPoints", "safetyLanguage", "whatToWatch"],
  });

  assert.equal(metrics.safeForUse, true);
  assert.equal(metrics.unsupportedClaimsDetected, false);
});

test("llm grounding supports AMD vs MU comparison with allowed deterministic numbers", () => {
  const packet = {
    symbols: [
      { conviction: 76, finalScore: 82, fragility: 58, symbol: "AMD" },
      { conviction: 61, finalScore: 70, fragility: 69, symbol: "MU" },
    ],
  };
  const metrics = evaluateLlmGrounding({
    output: {
      answer: "AMD ranks above MU because AMD final score 82 and conviction 76 are stronger than MU final score 70 and conviction 61.",
      keyPoints: ["MU fragility 69 is the main offset."],
      safetyLanguage: "Research comparison only. Not financial advice.",
      symbolComparisons: ["AMD has stronger deterministic ranking context than MU."],
      unsupportedClaimsDetected: false,
      whatToWatch: ["Whether MU fragility improves."],
    },
    packet: groundingPacketFromStructuredData(packet),
    requiredFields: ["answer", "keyPoints", "safetyLanguage", "whatToWatch"],
  });

  assert.equal(metrics.safeForUse, true);
});

test("llm grounding rejects unsupported macro certainty", () => {
  const metrics = evaluateLlmGrounding({
    output: {
      answer: "Fed will cut rates, so QQQ will rally.",
      keyPoints: ["Rates will be supportive."],
      safetyLanguage: "Research only. Not financial advice.",
      unsupportedClaimsDetected: false,
      whatToWatch: ["Macro data."],
    },
    packet: groundingPacketFromStructuredData(basePacket),
    requiredFields: ["answer", "keyPoints", "safetyLanguage", "whatToWatch"],
  });

  assert.equal(metrics.unsupportedMacroClaimsDetected, true);
  assert.equal(metrics.safeForUse, false);
});

test("safe fallback language remains non-advisory", () => {
  const fallback = safeLlmFallbackLanguage("Copilot");

  assert.match(fallback, /Deterministic TradeVeto reasoning/);
  assert.match(fallback, /not financial advice/i);
  assert.doesNotMatch(fallback, /buy now|sell now|guaranteed/i);
});
