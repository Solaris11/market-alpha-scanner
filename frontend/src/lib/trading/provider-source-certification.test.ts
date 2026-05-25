import assert from "node:assert/strict";
import test from "node:test";
import type {
  DailyEventDomainTimeline,
  DailyProviderCoverageDomain,
  DailyProviderStrategyAudit,
  DailySourceTrustSummary,
} from "./daily-market-command";
import { buildProviderFreshnessCertification, type ProviderCertificationEventCard } from "./provider-source-certification";

const requiredDomains: DailyProviderCoverageDomain[] = [
  "macro",
  "rates",
  "inflation",
  "earnings",
  "economic-calendar",
  "analyst-actions",
  "dividends",
  "geopolitical-events",
  "company-events",
  "sector-events",
  "crypto-events",
];

function sourceTrust(overrides: Partial<DailySourceTrustSummary> = {}): DailySourceTrustSummary {
  return {
    completeCardCount: 1,
    completenessPct: 100,
    contextCompleteCardCount: 1,
    contextCompletenessPct: 100,
    disclosure: "1 of 1 displayed source-linked event cards disclose required fields.",
    displayedCardCount: 1,
    incompleteCardCount: 0,
    missingFieldCounts: {
      affectedSymbols: 0,
      freshness: 0,
      provider: 0,
      providerState: 0,
      sourceUrl: 0,
      timestamp: 0,
      uncertainty: 0,
      watchlistImpact: 0,
    },
    requiredFields: ["sourceUrl", "provider", "timestamp", "freshness", "providerState", "uncertainty"],
    status: "pass",
    targetCompletenessPct: 99,
    ...overrides,
  };
}

function eventCard(overrides: Partial<ProviderCertificationEventCard> = {}): ProviderCertificationEventCard {
  return {
    confidence: "High source-linked relevance; research-only and still uncertain.",
    freshness: "Fresh · 12m old",
    freshnessSla: "Freshness SLA within 360m · 12m old",
    headline: "Source-linked event",
    provider: "Verified market source · Reuters",
    providerState: "active",
    providerStateLabel: "Provider active",
    sourceCompleteness: "Source complete: provider, URL, timestamp, freshness, state, uncertainty",
    sourceUrl: "https://www.reuters.com/markets/source-linked-event",
    timestamp: "2026-05-24T12:00:00.000Z",
    uncertainty: "High relevance, research-only interpretation",
    ...overrides,
  };
}

function audit(domain: DailyProviderCoverageDomain, overrides: Partial<DailyProviderStrategyAudit> = {}): DailyProviderStrategyAudit {
  return {
    coverage: "active",
    disclosure: `${domain} has current source-linked provider rows in this scanner packet.`,
    domain,
    freshness: "Fresh · 12m old",
    freshnessMinutes: 12,
    freshnessSlaDisclosure: `${domain} source-linked provider row is 12m old against a 360m freshness SLA.`,
    freshnessSlaMinutes: 360,
    freshnessSlaStatus: "within-sla",
    itemCount: 1,
    latency: "Provider timestamp captured; ingestion latency not instrumented",
    latestTimestamp: "2026-05-24T12:00:00.000Z",
    limitations: ["Coverage depends on configured source-linked provider rows in the current scanner packet."],
    operationalState: "active",
    provider: "Reuters",
    sourceTransparency: "Source-linked rows: Reuters.",
    tone: "emerald",
    ...overrides,
  };
}

function timeline(domain: DailyProviderCoverageDomain): DailyEventDomainTimeline {
  return {
    activeSourceCount: 1,
    calendarCount: 0,
    domain,
    itemCount: 1,
    items: [{
      affectedSymbols: ["AMD"],
      category: "Macro",
      date: "2026-05-24T12:00:00.000Z",
      detail: "Source-linked event. Why it matters.",
      freshnessLabel: "Fresh · 12m old · Freshness SLA within 360m · 12m old",
      id: `development:${domain}:1`,
      providerState: "active",
      source: "Verified market source · Reuters",
      sourceUrl: "https://www.reuters.com/markets/source-linked-event",
      tone: "emerald",
      watchlistImpact: true,
    }],
    label: domain,
    providerStateSummary: "active",
    tone: "emerald",
  };
}

test("provider freshness certification passes only with 99% source trust, active SLAs, timelines, and outage recovery proof", () => {
  const result = buildProviderFreshnessCertification({
    eventCards: [eventCard()],
    eventDomainTimelines: requiredDomains.map(timeline),
    outageSimulation: { enabled: true, fallbackVisible: true, recoveryVisible: true },
    outageSimulationRequired: true,
    providerCoverageMatrix: requiredDomains.map((domain) => audit(domain)),
    requiredDomains,
    sourceTrust: sourceTrust(),
  });

  assert.equal(result.status, "ready");
  assert.equal(result.targetSourceCompletenessPct, 99);
  assert.equal(result.sourceCompletenessPass, true);
  assert.equal(result.requiredDomainCoveragePass, true);
  assert.equal(result.freshnessSlaPass, true);
  assert.equal(result.timelineCoveragePass, true);
  assert.equal(result.outageSimulationPass, true);
  assert.deepEqual(result.blockers, []);
});

test("provider freshness certification exposes limited domains, stale disclosures, and fake live labels as blockers", () => {
  const result = buildProviderFreshnessCertification({
    eventCards: [eventCard({
      confidence: "Live confidence",
      freshness: "Freshness unavailable",
      freshnessSla: "Freshness SLA breached · 5000m old against 360m",
      providerState: "stale",
      providerStateLabel: "Provider stale",
    })],
    eventDomainTimelines: requiredDomains.slice(0, -1).map(timeline),
    outageSimulation: { enabled: false, fallbackVisible: false, recoveryVisible: false },
    outageSimulationRequired: true,
    providerCoverageMatrix: requiredDomains.map((domain) => domain === "crypto-events"
      ? audit(domain, {
        coverage: "limited",
        freshnessMinutes: null,
        freshnessSlaStatus: "not-measured",
        operationalState: "limited",
        provider: "Provider not configured",
      })
      : audit(domain)),
    requiredDomains,
    sourceTrust: sourceTrust(),
  });

  assert.equal(result.status, "not-ready");
  assert.equal(result.limitedDomains.includes("crypto-events"), true);
  assert.equal(result.unmeasuredFreshnessDomains.includes("crypto-events"), true);
  assert.equal(result.fakeLiveLabelCount, 1);
  assert.equal(result.noFakeLiveLabelsPass, false);
  assert.equal(result.outageSimulationPass, false);
  assert.ok(result.blockers.some((blocker) => /limited provider domains/.test(blocker)));
});

test("provider freshness certification does not treat no-live guardrail text as a fake live label", () => {
  const result = buildProviderFreshnessCertification({
    eventCards: [eventCard({
      confidence: "Freshness-limited confidence; timestamp remains visible and no live label is implied.",
      freshness: "Aging · 2d old",
      freshnessSla: "Freshness SLA breached · 2880m old against 360m; this must not be labeled live.",
      providerState: "delayed",
      providerStateLabel: "Provider delayed",
    })],
    eventDomainTimelines: requiredDomains.map(timeline),
    outageSimulationRequired: false,
    providerCoverageMatrix: requiredDomains.map((domain) => audit(domain, domain === "rates" ? {
      freshnessMinutes: 2880,
      freshnessSlaStatus: "breached",
      operationalState: "delayed",
    } : {})),
    requiredDomains,
    sourceTrust: sourceTrust(),
  });

  assert.equal(result.fakeLiveLabelCount, 0);
  assert.equal(result.noFakeLiveLabelsPass, true);
  assert.ok(result.blockers.some((blocker) => /freshness SLA breached/.test(blocker)));
});
