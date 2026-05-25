import {
  SOURCE_TRUST_TARGET_PCT,
  type DailyEventDomainTimeline,
  type DailyProviderCoverageDomain,
  type DailyProviderOperationalState,
  type DailyProviderStrategyAudit,
  type DailySourceTrustSummary,
} from "./daily-market-command";

export type ProviderCertificationEventCard = {
  confidence: string;
  freshness: string;
  freshnessSla: string;
  headline: string;
  provider: string;
  providerState: DailyProviderOperationalState;
  providerStateLabel: string;
  sourceCompleteness: string;
  sourceUrl: string;
  timestamp: string;
  uncertainty: string;
};

export type ProviderCertificationOutageSimulation = {
  enabled: boolean;
  fallbackVisible: boolean;
  recoveryVisible: boolean;
};

export type ProviderFreshnessCertification = {
  activeFreshnessDomains: DailyProviderCoverageDomain[];
  blockers: string[];
  breachedFreshnessDomains: DailyProviderCoverageDomain[];
  contextCompletenessPct: number;
  disclosure: string;
  displayedCardCount: number;
  fakeLiveLabelCount: number;
  freshnessSlaPass: boolean;
  hiddenStaleStateCount: number;
  limitedDomains: DailyProviderCoverageDomain[];
  missingDomains: DailyProviderCoverageDomain[];
  noFabricationDisclosure: string;
  noFakeLiveLabelsPass: boolean;
  noHiddenStaleStatePass: boolean;
  outageSimulationPass: boolean | null;
  requiredDomainCoveragePass: boolean;
  requiredDomains: DailyProviderCoverageDomain[];
  sourceCompletenessPct: number;
  sourceCompletenessPass: boolean;
  status: "not-ready" | "ready" | "strong-partial";
  targetSourceCompletenessPct: number;
  timelineCoveragePass: boolean;
  timelineMissingDomains: DailyProviderCoverageDomain[];
  unmeasuredFreshnessDomains: DailyProviderCoverageDomain[];
};

export function buildProviderFreshnessCertification(input: {
  eventCards: ProviderCertificationEventCard[];
  eventDomainTimelines: DailyEventDomainTimeline[];
  outageSimulation?: ProviderCertificationOutageSimulation | null;
  outageSimulationRequired?: boolean;
  providerCoverageMatrix: DailyProviderStrategyAudit[];
  requiredDomains: DailyProviderCoverageDomain[];
  sourceTrust: DailySourceTrustSummary;
}): ProviderFreshnessCertification {
  const coverageByDomain = new Map(input.providerCoverageMatrix.map((audit) => [audit.domain, audit]));
  const timelineDomains = new Set(input.eventDomainTimelines.map((timeline) => timeline.domain));
  const missingDomains = input.requiredDomains.filter((domain) => !coverageByDomain.has(domain));
  const limitedDomains = input.requiredDomains.filter((domain) => coverageByDomain.get(domain)?.operationalState === "limited");
  const breachedFreshnessDomains = input.requiredDomains.filter((domain) => coverageByDomain.get(domain)?.freshnessSlaStatus === "breached");
  const unmeasuredFreshnessDomains = input.requiredDomains.filter((domain) => coverageByDomain.get(domain)?.freshnessSlaStatus === "not-measured");
  const activeFreshnessDomains = input.requiredDomains.filter((domain) => coverageByDomain.get(domain)?.freshnessSlaStatus === "within-sla");
  const timelineMissingDomains = input.requiredDomains.filter((domain) => {
    const audit = coverageByDomain.get(domain);
    return Boolean(audit && audit.coverage !== "limited" && !timelineDomains.has(domain));
  });
  const hiddenStaleStateCount = input.eventCards.filter(hasHiddenStaleState).length;
  const fakeLiveLabelCount = input.eventCards.filter(hasFakeLiveLabel).length;
  const sourceCompletenessPass = input.sourceTrust.status === "pass"
    && input.sourceTrust.completenessPct >= SOURCE_TRUST_TARGET_PCT
    && input.sourceTrust.contextCompletenessPct >= SOURCE_TRUST_TARGET_PCT
    && input.sourceTrust.displayedCardCount > 0;
  const requiredDomainCoveragePass = missingDomains.length === 0 && limitedDomains.length === 0;
  const freshnessSlaPass = breachedFreshnessDomains.length === 0 && unmeasuredFreshnessDomains.length === 0;
  const timelineCoveragePass = timelineMissingDomains.length === 0;
  const noHiddenStaleStatePass = hiddenStaleStateCount === 0;
  const noFakeLiveLabelsPass = fakeLiveLabelCount === 0;
  const outageSimulationPass = input.outageSimulationRequired
    ? Boolean(input.outageSimulation?.enabled && input.outageSimulation.fallbackVisible && input.outageSimulation.recoveryVisible)
    : null;
  const blockers = [
    sourceCompletenessPass ? null : `source completeness ${input.sourceTrust.completenessPct}% / context ${input.sourceTrust.contextCompletenessPct}% below ${SOURCE_TRUST_TARGET_PCT}% target or no displayed source-linked cards`,
    missingDomains.length ? `missing required provider domains: ${missingDomains.join(", ")}` : null,
    limitedDomains.length ? `limited provider domains: ${limitedDomains.join(", ")}` : null,
    breachedFreshnessDomains.length ? `freshness SLA breached: ${breachedFreshnessDomains.join(", ")}` : null,
    unmeasuredFreshnessDomains.length ? `freshness SLA unmeasured: ${unmeasuredFreshnessDomains.join(", ")}` : null,
    timelineMissingDomains.length ? `event timelines missing for configured domains: ${timelineMissingDomains.join(", ")}` : null,
    hiddenStaleStateCount ? `${hiddenStaleStateCount} stale/delayed/outage event cards do not visibly disclose stale state` : null,
    fakeLiveLabelCount ? `${fakeLiveLabelCount} stale/delayed/outage event cards contain fake live wording` : null,
    outageSimulationPass === false ? "provider outage simulation did not expose both fallback and recovery states" : null,
  ].filter((item): item is string => item !== null);
  const fullPass = blockers.length === 0;
  const strongPartial = sourceCompletenessPass && noHiddenStaleStatePass && noFakeLiveLabelsPass && missingDomains.length === 0;
  return {
    activeFreshnessDomains,
    blockers,
    breachedFreshnessDomains,
    contextCompletenessPct: input.sourceTrust.contextCompletenessPct,
    disclosure: fullPass
      ? "Provider/event freshness certification is ready for this packet: source completeness, required domains, freshness SLAs, timelines, stale-state disclosure, and outage/recovery proof all pass."
      : "Provider/event freshness certification is partial: TradeVeto exposes source, freshness, stale/outage, and no-fabrication states, but remaining provider depth or SLA blockers are still visible.",
    displayedCardCount: input.sourceTrust.displayedCardCount,
    fakeLiveLabelCount,
    freshnessSlaPass,
    hiddenStaleStateCount,
    limitedDomains,
    missingDomains,
    noFabricationDisclosure: "TradeVeto does not fabricate events, headlines, analyst actions, geopolitical events, provider claims, or live labels when source-linked provider data is absent, delayed, stale, or unavailable.",
    noFakeLiveLabelsPass,
    noHiddenStaleStatePass,
    outageSimulationPass,
    requiredDomainCoveragePass,
    requiredDomains: input.requiredDomains,
    sourceCompletenessPct: input.sourceTrust.completenessPct,
    sourceCompletenessPass,
    status: fullPass ? "ready" : strongPartial ? "strong-partial" : "not-ready",
    targetSourceCompletenessPct: SOURCE_TRUST_TARGET_PCT,
    timelineCoveragePass,
    timelineMissingDomains,
    unmeasuredFreshnessDomains,
  };
}

function hasHiddenStaleState(card: ProviderCertificationEventCard): boolean {
  if (card.providerState === "active" || card.providerState === "calendar-only" || card.providerState === "limited") return false;
  const disclosureText = `${card.providerState} ${card.providerStateLabel} ${card.freshness} ${card.freshnessSla} ${card.sourceCompleteness}`.toLowerCase();
  return !/(stale|delayed|outage|partial outage|breach|breached)/.test(disclosureText);
}

function hasFakeLiveLabel(card: ProviderCertificationEventCard): boolean {
  if (card.providerState === "active") return false;
  const visibleText = `${card.headline} ${card.provider} ${card.providerStateLabel} ${card.freshness} ${card.freshnessSla} ${card.confidence} ${card.uncertainty}`.toLowerCase();
  return /\blive\b/.test(visibleText);
}
