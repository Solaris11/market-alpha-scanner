export type RetentionCohortSegmentKey = "founding_members" | "free_research_preview" | "legacy_users" | "anonymous_users" | "bot_or_noise_filtered";

export type RetentionCohortCertificationStatus = "ready" | "strong_partial" | "not_ready";

export type RetentionCohortFirstUsefulActions = {
  alert: number;
  chartSave: number;
  morningBriefing: number;
  replay: number;
  scanner: number;
  watchlist: number;
};

export type RetentionCohortSegmentInput = {
  activeDayUsers: number;
  actors: number;
  alertReturnUsers: number;
  alertTriggerUsers: number;
  eligibleD2Users: number;
  eligibleD7Users: number;
  firstUsefulActions: RetentionCohortFirstUsefulActions;
  notificationFeedbackTotal: number;
  notificationUsefulFeedback: number;
  retainedD2Users: number;
  retainedD7Users: number;
  segment: string;
  twoPlusActiveDayUsers: number;
};

export type RetentionCohortSegment = RetentionCohortSegmentInput & {
  alertReturnConversionPct: number | null;
  d2RetentionRatePct: number | null;
  d7RetentionRatePct: number | null;
  label: string;
  notificationUsefulRatioPct: number | null;
  segment: RetentionCohortSegmentKey;
  twoPlusActiveDayRatePct: number | null;
};

export type RetentionCohortTargets = {
  alertReturnConversionPct: number;
  d2RetentionRatePct: number;
  d7RetentionRatePct: number;
  notificationUsefulRatioPct: number;
  twoPlusActiveDayRatePct: number;
};

export type PaidUserCohortCertification = {
  blockers: string[];
  elapsedOnly: true;
  generatedFrom: "production_analytics_events";
  paidSegment: RetentionCohortSegment;
  proofBoundary: string;
  sampleSize: {
    botOrNoiseActors: number;
    foundingMemberActors: number;
    totalActors: number;
  };
  segments: RetentionCohortSegment[];
  status: RetentionCohortCertificationStatus;
  targets: RetentionCohortTargets;
  verdictLabel: string;
};

export const RETENTION_COHORT_TARGETS: RetentionCohortTargets = {
  alertReturnConversionPct: 12,
  d2RetentionRatePct: 8,
  d7RetentionRatePct: 4,
  notificationUsefulRatioPct: 55,
  twoPlusActiveDayRatePct: 10,
};

const SEGMENT_LABELS: Record<RetentionCohortSegmentKey, string> = {
  anonymous_users: "Anonymous Users",
  bot_or_noise_filtered: "Bot / Noise Filtered",
  founding_members: "Founding Members",
  free_research_preview: "Free Research Preview",
  legacy_users: "Legacy Users",
};

const SEGMENT_ORDER: RetentionCohortSegmentKey[] = [
  "founding_members",
  "free_research_preview",
  "legacy_users",
  "anonymous_users",
  "bot_or_noise_filtered",
];

export function normalizeRetentionCohortSegment(value: string): RetentionCohortSegmentKey {
  if (value === "founding_members") return "founding_members";
  if (value === "free_research_preview") return "free_research_preview";
  if (value === "legacy_users") return "legacy_users";
  if (value === "bot_or_noise_filtered") return "bot_or_noise_filtered";
  return "anonymous_users";
}

export function buildPaidUserCohortCertification(inputs: RetentionCohortSegmentInput[]): PaidUserCohortCertification {
  const segments = SEGMENT_ORDER.map((segment) => buildSegment(segment, inputs.find((input) => normalizeRetentionCohortSegment(input.segment) === segment)));
  const paidSegment = segments.find((segment) => segment.segment === "founding_members") ?? buildSegment("founding_members");
  const blockers = buildBlockers(paidSegment);
  const totalActors = segments.reduce((total, segment) => total + segment.actors, 0);
  const status: RetentionCohortCertificationStatus = blockers.length ? (totalActors > 0 ? "strong_partial" : "not_ready") : "ready";

  return {
    blockers,
    elapsedOnly: true,
    generatedFrom: "production_analytics_events",
    paidSegment,
    proofBoundary: "Only elapsed production cohorts count. Same-day data, probe users, and synthetic events cannot satisfy D2, D7, active-day, alert-return, or notification-usefulness targets.",
    sampleSize: {
      botOrNoiseActors: segments.find((segment) => segment.segment === "bot_or_noise_filtered")?.actors ?? 0,
      foundingMemberActors: paidSegment.actors,
      totalActors,
    },
    segments,
    status,
    targets: RETENTION_COHORT_TARGETS,
    verdictLabel: status === "ready" ? "Paid retention targets met" : status === "strong_partial" ? "Implementation shipped; elapsed cohort proof incomplete" : "Paid retention cohort proof unavailable",
  };
}

function buildSegment(segment: RetentionCohortSegmentKey, input?: RetentionCohortSegmentInput): RetentionCohortSegment {
  const normalizedInput = input ?? {
    activeDayUsers: 0,
    actors: 0,
    alertReturnUsers: 0,
    alertTriggerUsers: 0,
    eligibleD2Users: 0,
    eligibleD7Users: 0,
    firstUsefulActions: {
      alert: 0,
      chartSave: 0,
      morningBriefing: 0,
      replay: 0,
      scanner: 0,
      watchlist: 0,
    },
    notificationFeedbackTotal: 0,
    notificationUsefulFeedback: 0,
    retainedD2Users: 0,
    retainedD7Users: 0,
    segment,
    twoPlusActiveDayUsers: 0,
  };

  return {
    ...normalizedInput,
    alertReturnConversionPct: pctOrNull(normalizedInput.alertReturnUsers, normalizedInput.alertTriggerUsers),
    d2RetentionRatePct: pctOrNull(normalizedInput.retainedD2Users, normalizedInput.eligibleD2Users),
    d7RetentionRatePct: pctOrNull(normalizedInput.retainedD7Users, normalizedInput.eligibleD7Users),
    label: SEGMENT_LABELS[segment],
    notificationUsefulRatioPct: pctOrNull(normalizedInput.notificationUsefulFeedback, normalizedInput.notificationFeedbackTotal),
    segment,
    twoPlusActiveDayRatePct: pctOrNull(normalizedInput.twoPlusActiveDayUsers, normalizedInput.activeDayUsers),
  };
}

function buildBlockers(paidSegment: RetentionCohortSegment): string[] {
  const blockers: string[] = [];
  if (paidSegment.actors <= 0) blockers.push("No founding member or paid early-access production cohort exists yet.");
  if (paidSegment.eligibleD2Users <= 0) blockers.push("No founding member cohort is old enough for D2 retention proof.");
  if (paidSegment.eligibleD7Users <= 0) blockers.push("No founding member cohort is old enough for D7 retention proof.");
  if (paidSegment.d2RetentionRatePct === null || paidSegment.d2RetentionRatePct < RETENTION_COHORT_TARGETS.d2RetentionRatePct) {
    blockers.push(`Founding member D2 retention is ${formatPct(paidSegment.d2RetentionRatePct)}, below ${RETENTION_COHORT_TARGETS.d2RetentionRatePct}%.`);
  }
  if (paidSegment.d7RetentionRatePct === null || paidSegment.d7RetentionRatePct < RETENTION_COHORT_TARGETS.d7RetentionRatePct) {
    blockers.push(`Founding member D7 retention is ${formatPct(paidSegment.d7RetentionRatePct)}, below ${RETENTION_COHORT_TARGETS.d7RetentionRatePct}%.`);
  }
  if (paidSegment.twoPlusActiveDayRatePct === null || paidSegment.twoPlusActiveDayRatePct < RETENTION_COHORT_TARGETS.twoPlusActiveDayRatePct) {
    blockers.push(`Founding member 2+ active-day retention is ${formatPct(paidSegment.twoPlusActiveDayRatePct)}, below ${RETENTION_COHORT_TARGETS.twoPlusActiveDayRatePct}%.`);
  }
  if (paidSegment.alertTriggerUsers <= 0) {
    blockers.push("No founding member alert-trigger population exists for alert-return conversion proof.");
  } else if (paidSegment.alertReturnConversionPct === null || paidSegment.alertReturnConversionPct < RETENTION_COHORT_TARGETS.alertReturnConversionPct) {
    blockers.push(`Founding member alert-return conversion is ${formatPct(paidSegment.alertReturnConversionPct)}, below ${RETENTION_COHORT_TARGETS.alertReturnConversionPct}%.`);
  }
  if (paidSegment.notificationFeedbackTotal <= 0) {
    blockers.push("No founding member notification usefulness sample exists.");
  } else if (paidSegment.notificationUsefulRatioPct === null || paidSegment.notificationUsefulRatioPct < RETENTION_COHORT_TARGETS.notificationUsefulRatioPct) {
    blockers.push(`Founding member notification useful ratio is ${formatPct(paidSegment.notificationUsefulRatioPct)}, below ${RETENTION_COHORT_TARGETS.notificationUsefulRatioPct}%.`);
  }
  return blockers;
}

function pctOrNull(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}
