export type RealUserDominanceStatus = "proven" | "developing" | "insufficient_data";

export type RealUserDominanceTone = "positive" | "warning" | "critical" | "neutral";

export type RealUserDominanceGate = {
  evidence: string;
  key: string;
  label: string;
  passed: boolean;
  target: string;
  tone: RealUserDominanceTone;
  value: string;
};

export type RealUserDominanceSignal = {
  interpretation: string;
  label: string;
  tone: RealUserDominanceTone;
  value: string;
};

export type RealUserDominanceProof = {
  blockers: string[];
  gates: RealUserDominanceGate[];
  proofScore: number;
  signals: RealUserDominanceSignal[];
  status: RealUserDominanceStatus;
  summary: string;
  verdictLabel: string;
};

export type RealUserFeatureAdoptionInput = {
  activeUsers: number;
  adoptionRatePct: number | null;
  events: number;
  feature: string;
};

export type RealUserDominanceInput = {
  activeUsers: number;
  adaptiveProofScore: number;
  averageSessionDepth: number | null;
  averageTimeToFirstUsefulActionSeconds: number | null;
  dau: number;
  failedActions: number;
  featureAdoption: RealUserFeatureAdoptionInput[];
  feedEngagement: number;
  firstUsefulActions: number;
  mobileFrictionEvents: number;
  mobileSharePct: number | null;
  modalAbandons: number;
  notificationEngagement: number;
  notificationUsefulnessRatePct: number | null;
  rageClicks: number;
  replayUsage: number;
  scannerUsage: number;
  scrollAbandons: number;
  strategyUsage: number;
  stickySessionRatePct: number | null;
  totalEvents: number;
  totalSessions: number;
  watchlistRetentionRatePct: number | null;
  watchlistUsage: number;
  wau: number;
  workflowContinuityEvents: number;
};

const MIN_ACTIVE_USERS_FOR_PROOF = 25;
const MIN_SESSIONS_FOR_PROOF = 50;
const MIN_EVENTS_FOR_PROOF = 500;

export function buildRealUserDominanceProof(input: RealUserDominanceInput): RealUserDominanceProof {
  const dauWauPct = pct(input.dau, input.wau);
  const repeatSessionRatePct = pct(input.totalSessions - uniqueSessionApproximation(input), input.totalSessions);
  const firstUsefulCoveragePct = pct(input.firstUsefulActions, input.activeUsers);
  const frictionEvents = input.rageClicks + input.failedActions + input.modalAbandons + input.scrollAbandons;
  const frictionRatePct = pct(frictionEvents, input.totalSessions);
  const coreFeatureCount = input.featureAdoption.filter((feature) => feature.events > 0 && (feature.adoptionRatePct ?? 0) >= 10).length;
  const deepFeatureCount = input.featureAdoption.filter((feature) => ["Scanner", "Replay", "Strategy", "Watchlist", "Feed"].includes(feature.feature) && feature.events > 0).length;
  const continuityEvents = input.workflowContinuityEvents;
  const notificationRate = input.notificationUsefulnessRatePct;

  const gates: RealUserDominanceGate[] = [
    gate({
      evidence: `${input.activeUsers.toLocaleString()} active users, ${input.totalSessions.toLocaleString()} sessions, ${input.totalEvents.toLocaleString()} events`,
      key: "sample_depth",
      label: "Real user sample depth",
      passed: input.activeUsers >= MIN_ACTIVE_USERS_FOR_PROOF && input.totalSessions >= MIN_SESSIONS_FOR_PROOF && input.totalEvents >= MIN_EVENTS_FOR_PROOF,
      target: `${MIN_ACTIVE_USERS_FOR_PROOF}+ users, ${MIN_SESSIONS_FOR_PROOF}+ sessions, ${MIN_EVENTS_FOR_PROOF}+ events`,
      value: `${input.activeUsers.toLocaleString()} users`,
    }),
    gate({
      evidence: "DAU/WAU indicates whether users return often enough to make TradeVeto part of their market routine.",
      key: "dau_wau",
      label: "Daily habit strength",
      passed: input.wau >= 20 && (dauWauPct ?? 0) >= 20,
      target: "20%+ DAU/WAU with 20+ WAU",
      value: formatPct(dauWauPct),
    }),
    gate({
      evidence: "First useful action events prove users reached a meaningful scanner, watchlist, feed, replay, strategy, or symbol workflow.",
      key: "first_useful_action",
      label: "First useful action proof",
      passed: input.firstUsefulActions >= Math.max(8, Math.ceil(input.activeUsers * 0.35)),
      target: "35%+ of active users or 8+ actions",
      value: `${input.firstUsefulActions.toLocaleString()} actions`,
    }),
    gate({
      evidence: "Sticky sessions show users moving across scanner, symbol, feed, replay, strategy, and watchlist workflows.",
      key: "workflow_stickiness",
      label: "Workflow continuity",
      passed: (input.stickySessionRatePct ?? 0) >= 25 && continuityEvents >= 5,
      target: "25%+ sticky sessions and 5+ continuity events",
      value: `${formatPct(input.stickySessionRatePct)} / ${continuityEvents.toLocaleString()} events`,
    }),
    gate({
      evidence: "Feature adoption breadth prevents a single-route spike from masquerading as platform dominance.",
      key: "feature_breadth",
      label: "Feature adoption breadth",
      passed: coreFeatureCount >= 4 && deepFeatureCount >= 3,
      target: "4+ adopted areas, 3+ core intelligence workflows",
      value: `${coreFeatureCount} adopted / ${deepFeatureCount} core`,
    }),
    gate({
      evidence: "Watchlist retention proves users are tracking symbols over repeat visits instead of treating the product as a one-off scanner.",
      key: "watchlist_retention",
      label: "Watchlist retention",
      passed: (input.watchlistRetentionRatePct ?? 0) >= 20,
      target: "20%+ returning watchlist users",
      value: formatPct(input.watchlistRetentionRatePct),
    }),
    gate({
      evidence: "Adaptive proof combines workflow visits, continuity, personalization updates, experiments, and decision-memory actions.",
      key: "adaptive_behavior",
      label: "Adaptive intelligence behavior",
      passed: input.adaptiveProofScore >= 55,
      target: "55/100+ adaptive proof",
      value: `${input.adaptiveProofScore}/100`,
    }),
    gate({
      evidence: "Mobile engagement must show real usage without excessive mobile friction.",
      key: "mobile_engagement",
      label: "Mobile workflow proof",
      passed: (input.mobileSharePct ?? 0) >= 12 && input.mobileFrictionEvents <= Math.max(4, Math.ceil(input.totalSessions * 0.08)),
      target: "12%+ mobile share with controlled friction",
      value: `${formatPct(input.mobileSharePct)} share / ${input.mobileFrictionEvents.toLocaleString()} friction`,
    }),
    gate({
      evidence: "Notification usefulness is counted only from notification engagement and preference actions.",
      key: "notification_usefulness",
      label: "Notification usefulness",
      passed: input.notificationEngagement >= 5 && notificationRate !== null && notificationRate >= 25,
      target: "5+ notification actions and 25%+ useful interactions",
      value: `${input.notificationEngagement.toLocaleString()} actions / ${formatPct(notificationRate)}`,
    }),
    gate({
      evidence: "World-class proof requires low rage-click, failed-action, modal-abandon, and scroll-abandon pressure.",
      key: "friction_control",
      label: "Friction control",
      passed: frictionRatePct !== null && frictionRatePct <= 8,
      target: "<= 8% friction events per session",
      value: `${formatPct(frictionRatePct)} (${frictionEvents.toLocaleString()} events)`,
      warnWhenFailed: true,
    }),
  ];

  const passedCount = gates.filter((item) => item.passed).length;
  const proofScore = Math.round((passedCount / gates.length) * 100);
  const blockers = gates.filter((item) => !item.passed).map((item) => `${item.label}: ${item.value} vs ${item.target}`);
  const sampleGatePassed = gates.find((item) => item.key === "sample_depth")?.passed ?? false;
  const status = statusFromGates({ blockers, proofScore, sampleGatePassed });

  return {
    blockers,
    gates,
    proofScore,
    signals: [
      {
        interpretation: "DAU/WAU measures whether TradeVeto is forming a daily market habit.",
        label: "DAU / WAU",
        tone: toneForPct(dauWauPct, 20),
        value: `${input.dau.toLocaleString()} / ${input.wau.toLocaleString()} (${formatPct(dauWauPct)})`,
      },
      {
        interpretation: "First useful actions are activation proof, not vanity traffic.",
        label: "First useful action",
        tone: toneForPct(firstUsefulCoveragePct, 35),
        value: `${input.firstUsefulActions.toLocaleString()} (${formatPct(firstUsefulCoveragePct)} coverage)`,
      },
      {
        interpretation: "Session depth indicates whether users investigate multiple intelligence surfaces.",
        label: "Average session depth",
        tone: input.averageSessionDepth !== null && input.averageSessionDepth >= 4 ? "positive" : "warning",
        value: input.averageSessionDepth === null ? "N/A" : input.averageSessionDepth.toFixed(1),
      },
      {
        interpretation: "Repeated workflows indicate scanner, feed, watchlist, replay, and strategy continuity.",
        label: "Workflow stickiness",
        tone: toneForPct(input.stickySessionRatePct, 25),
        value: formatPct(input.stickySessionRatePct),
      },
      {
        interpretation: "Friction pressure must remain low enough that engagement is not masking broken UX.",
        label: "Friction rate",
        tone: frictionRatePct !== null && frictionRatePct <= 8 ? "positive" : "critical",
        value: `${formatPct(frictionRatePct)} (${frictionEvents.toLocaleString()} events)`,
      },
      {
        interpretation: "Notification engagement proves whether intelligence alerts are useful, not noisy.",
        label: "Notification usefulness",
        tone: toneForPct(notificationRate, 25),
        value: formatPct(notificationRate),
      },
      {
        interpretation: "Repeat sessions approximate whether users come back after initial exploration.",
        label: "Repeat session rate",
        tone: toneForPct(repeatSessionRatePct, 20),
        value: formatPct(repeatSessionRatePct),
      },
    ],
    status,
    summary: summaryForStatus(status, proofScore, blockers.length),
    verdictLabel: verdictLabelForStatus(status),
  };
}

function uniqueSessionApproximation(input: RealUserDominanceInput): number {
  if (input.totalSessions <= 0) return 0;
  return Math.min(input.totalSessions, Math.max(input.activeUsers, input.totalSessions - Math.max(0, input.totalSessions - input.activeUsers)));
}

function gate(input: {
  evidence: string;
  key: string;
  label: string;
  passed: boolean;
  target: string;
  value: string;
  warnWhenFailed?: boolean;
}): RealUserDominanceGate {
  return {
    evidence: input.evidence,
    key: input.key,
    label: input.label,
    passed: input.passed,
    target: input.target,
    tone: input.passed ? "positive" : input.warnWhenFailed ? "critical" : "warning",
    value: input.value,
  };
}

function statusFromGates(input: { blockers: string[]; proofScore: number; sampleGatePassed: boolean }): RealUserDominanceStatus {
  if (!input.sampleGatePassed) return "insufficient_data";
  if (input.blockers.length === 0 && input.proofScore >= 95) return "proven";
  return "developing";
}

function summaryForStatus(status: RealUserDominanceStatus, proofScore: number, blockerCount: number): string {
  if (status === "proven") return `Real-user dominance is proven by telemetry. Proof score ${proofScore}/100.`;
  if (status === "insufficient_data") return `Real-user dominance is not proven yet because production sample depth is insufficient. Proof score ${proofScore}/100.`;
  return `Real-user dominance is developing but not proven. ${blockerCount} proof gates remain below target. Proof score ${proofScore}/100.`;
}

function verdictLabelForStatus(status: RealUserDominanceStatus): string {
  if (status === "proven") return "Dominance proven";
  if (status === "insufficient_data") return "Insufficient real-user sample";
  return "Dominance not yet proven";
}

function toneForPct(value: number | null, target: number): RealUserDominanceTone {
  if (value === null) return "neutral";
  if (value >= target) return "positive";
  if (value >= target * 0.5) return "warning";
  return "critical";
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${Math.round(value)}%`;
}
