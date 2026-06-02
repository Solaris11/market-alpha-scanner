export type RetentionCrisisStatus = "ready" | "strong_partial" | "not_ready";

export type RetentionWorkflowKey = "watchlist" | "alert" | "chart" | "scanner" | "copilot" | "symbol" | "replay" | "morningBriefing";

export type RetentionActorForensicsInput = {
  activationScore: number;
  activeDays: number;
  actorKey: string;
  alertReturn: boolean;
  alertTriggered: boolean;
  eligibleD1: boolean;
  eligibleD2: boolean;
  eligibleD7: boolean;
  eligibleD30: boolean;
  exitSurface: string | null;
  firstUsefulActions: number;
  notificationFeedbackTotal: number;
  notificationUsefulFeedback: number;
  retainedD1: boolean;
  retainedD2: boolean;
  retainedD7: boolean;
  retainedD30: boolean;
  segment: string;
  signupDate: string;
  workflows: Record<RetentionWorkflowKey, boolean>;
};

export type RetentionCrisisTargets = {
  d1RetentionPct: number;
  d7RetentionPct: number;
  d30RetentionPct: number;
  twoPlusActiveDayPct: number;
};

export type RetentionCrisisRateSet = {
  actors: number;
  d1RetentionPct: number | null;
  d2RetentionPct: number | null;
  d7RetentionPct: number | null;
  d30RetentionPct: number | null;
  eligibleD1Actors: number;
  eligibleD2Actors: number;
  eligibleD7Actors: number;
  eligibleD30Actors: number;
  retainedD1Actors: number;
  retainedD2Actors: number;
  retainedD7Actors: number;
  retainedD30Actors: number;
  twoPlusActiveDayActors: number;
  twoPlusActiveDayPct: number | null;
};

export type RetentionSignupDateCohort = RetentionCrisisRateSet & {
  signupDate: string;
};

export type RetentionActivationCohort = RetentionCrisisRateSet & {
  activationTier: "0" | "1-24" | "25-49" | "50-74" | "75+";
  averageActivationScore: number;
};

export type RetentionWorkflowCohort = RetentionCrisisRateSet & {
  cohort: "used" | "not_used";
  workflow: RetentionWorkflowKey;
};

export type RetentionWorkflowForensics = {
  failingWorkflows: Array<{
    reason: string;
    retainedD7Pct: number | null;
    users: number;
    workflow: RetentionWorkflowKey;
  }>;
  returnCreatingWorkflows: Array<{
    retainedD7Pct: number | null;
    retainedD30Pct: number | null;
    users: number;
    workflow: RetentionWorkflowKey;
  }>;
};

export type RetentionExitForensics = {
  exitSurface: string;
  exits: number;
  firstUsefulActionFailurePct: number | null;
  lowActivationActors: number;
};

export type RetentionReturnTrigger = {
  evidenceEvents: number;
  name: string;
  readiness: "ready_to_test" | "needs_instrumentation" | "blocked_by_no_sample";
  triggerKey: "watchlist_changes" | "new_opportunities" | "ai_confidence_changes" | "macro_changes" | "portfolio_risk_changes" | "alert_opportunities";
};

export type RetentionExperimentDefinition = {
  experimentKey: string;
  hypothesis: string;
  primaryMetric: "D1" | "D7" | "D30" | "first_useful_action" | "alert_return" | "notification_usefulness";
  variants: string[];
};

export type RetentionCrisisCertification = {
  activationCohorts: RetentionActivationCohort[];
  behavioralFindings: string[];
  blockers: string[];
  elapsedOnly: true;
  experiments: RetentionExperimentDefinition[];
  proofBoundary: string;
  rateSummary: RetentionCrisisRateSet;
  returnTriggers: RetentionReturnTrigger[];
  sampleSize: {
    actors: number;
    probeOrNoiseFilteredActors: number;
    realActors: number;
  };
  signupDateCohorts: RetentionSignupDateCohort[];
  status: RetentionCrisisStatus;
  targets: RetentionCrisisTargets;
  verdictLabel: string;
  workflowCohorts: RetentionWorkflowCohort[];
  workflowForensics: RetentionWorkflowForensics;
  exitForensics: RetentionExitForensics[];
};

export const RETENTION_CRISIS_TARGETS: RetentionCrisisTargets = {
  d1RetentionPct: 20,
  d7RetentionPct: 10,
  d30RetentionPct: 5,
  twoPlusActiveDayPct: 15,
};

const WORKFLOW_KEYS: RetentionWorkflowKey[] = ["watchlist", "alert", "chart", "scanner", "copilot", "symbol", "replay", "morningBriefing"];

export function buildRetentionCrisisCertification(actors: RetentionActorForensicsInput[]): RetentionCrisisCertification {
  const realActors = actors.filter((actor) => !isProbeOrNoiseSegment(actor.segment));
  const rateSummary = buildRateSet(realActors);
  const signupDateCohorts = buildSignupDateCohorts(realActors);
  const activationCohorts = buildActivationCohorts(realActors);
  const workflowCohorts = buildWorkflowCohorts(realActors);
  const workflowForensics = buildWorkflowForensics(workflowCohorts);
  const exitForensics = buildExitForensics(realActors);
  const returnTriggers = buildReturnTriggers(realActors);
  const blockers = buildBlockers(rateSummary, realActors.length);
  const status: RetentionCrisisStatus = blockers.length === 0 ? "ready" : realActors.length > 0 ? "strong_partial" : "not_ready";

  return {
    activationCohorts,
    behavioralFindings: buildBehavioralFindings({ activationCohorts, exitForensics, rateSummary, returnTriggers, workflowForensics }),
    blockers,
    elapsedOnly: true,
    experiments: retentionExperimentCatalog(),
    proofBoundary: "Only elapsed production cohorts count. Probe accounts, synthetic sessions, admin test users, same-day activity, and generated events cannot satisfy D1, D7, D30, 2+ active-day, alert-return, or notification-usefulness proof.",
    rateSummary,
    returnTriggers,
    sampleSize: {
      actors: actors.length,
      probeOrNoiseFilteredActors: actors.length - realActors.length,
      realActors: realActors.length,
    },
    signupDateCohorts,
    status,
    targets: RETENTION_CRISIS_TARGETS,
    verdictLabel: status === "ready" ? "Retention crisis eliminated by elapsed production cohorts" : status === "strong_partial" ? "Retention forensics and experiments ready; elapsed cohort targets still failing" : "Retention proof unavailable",
    workflowCohorts,
    workflowForensics,
    exitForensics,
  };
}

export function activationTierForScore(score: number): RetentionActivationCohort["activationTier"] {
  if (score <= 0) return "0";
  if (score < 25) return "1-24";
  if (score < 50) return "25-49";
  if (score < 75) return "50-74";
  return "75+";
}

export function retentionExperimentCatalog(): RetentionExperimentDefinition[] {
  return [
    {
      experimentKey: "phase34_onboarding_first_action",
      hypothesis: "A Start Here path that pushes one durable action inside 60 seconds increases first useful action and D1 retention.",
      primaryMetric: "first_useful_action",
      variants: ["control", "start_here_scanner", "start_here_watchlist"],
    },
    {
      experimentKey: "phase34_daily_setup_card",
      hypothesis: "A daily setup card with concrete return reasons increases D7 retention.",
      primaryMetric: "D7",
      variants: ["control", "compact_return_reasons", "task_ladder"],
    },
    {
      experimentKey: "phase34_watchlist_nudge",
      hypothesis: "A watchlist nudge tied to changed-since-last-session improves watchlist adoption and D7 retention.",
      primaryMetric: "D7",
      variants: ["control", "first_watchlist_prompt", "changed_since_last_session"],
    },
    {
      experimentKey: "phase34_alert_nudge",
      hypothesis: "Source-linked alert templates improve alert-return conversion.",
      primaryMetric: "alert_return",
      variants: ["control", "reasoned_alert_cta", "scanner_row_alert_template"],
    },
    {
      experimentKey: "phase34_morning_briefing",
      hypothesis: "Making the morning briefing the default return surface improves D1 and D7 retention.",
      primaryMetric: "D1",
      variants: ["control", "default_morning_command", "briefing_completion_prompt"],
    },
    {
      experimentKey: "phase34_copilot_prompt",
      hypothesis: "A traceable copilot prompt converts exploration into a repeat research workflow.",
      primaryMetric: "D7",
      variants: ["control", "explain_this_symbol", "next_research_question"],
    },
  ];
}

function buildRateSet(actors: RetentionActorForensicsInput[]): RetentionCrisisRateSet {
  const eligibleD1Actors = actors.filter((actor) => actor.eligibleD1).length;
  const eligibleD2Actors = actors.filter((actor) => actor.eligibleD2).length;
  const eligibleD7Actors = actors.filter((actor) => actor.eligibleD7).length;
  const eligibleD30Actors = actors.filter((actor) => actor.eligibleD30).length;
  const retainedD1Actors = actors.filter((actor) => actor.eligibleD1 && actor.retainedD1).length;
  const retainedD2Actors = actors.filter((actor) => actor.eligibleD2 && actor.retainedD2).length;
  const retainedD7Actors = actors.filter((actor) => actor.eligibleD7 && actor.retainedD7).length;
  const retainedD30Actors = actors.filter((actor) => actor.eligibleD30 && actor.retainedD30).length;
  const twoPlusActiveDayActors = actors.filter((actor) => actor.activeDays >= 2).length;
  return {
    actors: actors.length,
    d1RetentionPct: pctOrNull(retainedD1Actors, eligibleD1Actors),
    d2RetentionPct: pctOrNull(retainedD2Actors, eligibleD2Actors),
    d7RetentionPct: pctOrNull(retainedD7Actors, eligibleD7Actors),
    d30RetentionPct: pctOrNull(retainedD30Actors, eligibleD30Actors),
    eligibleD1Actors,
    eligibleD2Actors,
    eligibleD7Actors,
    eligibleD30Actors,
    retainedD1Actors,
    retainedD2Actors,
    retainedD7Actors,
    retainedD30Actors,
    twoPlusActiveDayActors,
    twoPlusActiveDayPct: pctOrNull(twoPlusActiveDayActors, actors.length),
  };
}

function buildSignupDateCohorts(actors: RetentionActorForensicsInput[]): RetentionSignupDateCohort[] {
  const groups = groupBy(actors, (actor) => actor.signupDate);
  return Array.from(groups.entries())
    .map(([signupDate, cohortActors]) => ({ ...buildRateSet(cohortActors), signupDate }))
    .sort((left, right) => left.signupDate.localeCompare(right.signupDate));
}

function buildActivationCohorts(actors: RetentionActorForensicsInput[]): RetentionActivationCohort[] {
  const groups = groupBy(actors, (actor) => activationTierForScore(actor.activationScore));
  const tiers: RetentionActivationCohort["activationTier"][] = ["0", "1-24", "25-49", "50-74", "75+"];
  return tiers.map((activationTier) => {
    const cohortActors = groups.get(activationTier) ?? [];
    const averageActivationScore = cohortActors.length ? cohortActors.reduce((total, actor) => total + actor.activationScore, 0) / cohortActors.length : 0;
    return { ...buildRateSet(cohortActors), activationTier, averageActivationScore };
  });
}

function buildWorkflowCohorts(actors: RetentionActorForensicsInput[]): RetentionWorkflowCohort[] {
  return WORKFLOW_KEYS.flatMap((workflow) => {
    const usedActors = actors.filter((actor) => actor.workflows[workflow]);
    const unusedActors = actors.filter((actor) => !actor.workflows[workflow]);
    return [
      { ...buildRateSet(usedActors), cohort: "used" as const, workflow },
      { ...buildRateSet(unusedActors), cohort: "not_used" as const, workflow },
    ];
  });
}

function buildWorkflowForensics(workflowCohorts: RetentionWorkflowCohort[]): RetentionWorkflowForensics {
  const usedCohorts = workflowCohorts.filter((cohort) => cohort.cohort === "used");
  const failingWorkflows = usedCohorts
    .filter((cohort) => cohort.actors > 0 && (cohort.d7RetentionPct === null || cohort.d7RetentionPct < RETENTION_CRISIS_TARGETS.d7RetentionPct))
    .map((cohort) => ({
      reason: `${workflowLabel(cohort.workflow)} users are not returning at D7 target levels.`,
      retainedD7Pct: cohort.d7RetentionPct,
      users: cohort.actors,
      workflow: cohort.workflow,
    }))
    .sort((left, right) => right.users - left.users);
  const returnCreatingWorkflows = usedCohorts
    .filter((cohort) => cohort.actors > 0 && (cohort.d7RetentionPct ?? 0) >= RETENTION_CRISIS_TARGETS.d7RetentionPct)
    .map((cohort) => ({
      retainedD7Pct: cohort.d7RetentionPct,
      retainedD30Pct: cohort.d30RetentionPct,
      users: cohort.actors,
      workflow: cohort.workflow,
    }))
    .sort((left, right) => (right.retainedD7Pct ?? 0) - (left.retainedD7Pct ?? 0));
  return { failingWorkflows, returnCreatingWorkflows };
}

function buildExitForensics(actors: RetentionActorForensicsInput[]): RetentionExitForensics[] {
  const groups = groupBy(actors, (actor) => actor.exitSurface || "unknown");
  return Array.from(groups.entries())
    .map(([exitSurface, cohortActors]) => {
      const lowActivationActors = cohortActors.filter((actor) => actor.activationScore < 25).length;
      const firstUsefulActionFailures = cohortActors.filter((actor) => actor.firstUsefulActions <= 0).length;
      return {
        exitSurface,
        exits: cohortActors.length,
        firstUsefulActionFailurePct: pctOrNull(firstUsefulActionFailures, cohortActors.length),
        lowActivationActors,
      };
    })
    .sort((left, right) => right.exits - left.exits)
    .slice(0, 12);
}

function buildReturnTriggers(actors: RetentionActorForensicsInput[]): RetentionReturnTrigger[] {
  const triggerInputs: Array<{ key: RetentionReturnTrigger["triggerKey"]; name: string; count: number }> = [
    { key: "watchlist_changes", name: "Watchlist changes", count: actors.filter((actor) => actor.workflows.watchlist).length },
    { key: "new_opportunities", name: "New scanner opportunities", count: actors.filter((actor) => actor.workflows.scanner).length },
    { key: "ai_confidence_changes", name: "AI confidence changes", count: actors.filter((actor) => actor.workflows.copilot).length },
    { key: "macro_changes", name: "Macro changes", count: actors.filter((actor) => actor.workflows.morningBriefing).length },
    { key: "portfolio_risk_changes", name: "Portfolio risk changes", count: actors.filter((actor) => actor.workflows.chart || actor.workflows.symbol).length },
    { key: "alert_opportunities", name: "Alert opportunities", count: actors.filter((actor) => actor.alertTriggered).length },
  ];
  return triggerInputs.map((trigger) => ({
    evidenceEvents: trigger.count,
    name: trigger.name,
    readiness: trigger.count > 0 ? "ready_to_test" : actors.length > 0 ? "blocked_by_no_sample" : "needs_instrumentation",
    triggerKey: trigger.key,
  }));
}

function buildBlockers(rateSummary: RetentionCrisisRateSet, realActorCount: number): string[] {
  const blockers: string[] = [];
  if (realActorCount <= 0) {
    blockers.push("No real production actors remain after probe/noise filtering.");
    return blockers;
  }
  if (rateSummary.eligibleD1Actors <= 0) blockers.push("No elapsed D1 cohort is available.");
  if (rateSummary.d1RetentionPct === null || rateSummary.d1RetentionPct < RETENTION_CRISIS_TARGETS.d1RetentionPct) {
    blockers.push(`D1 retention is ${formatPct(rateSummary.d1RetentionPct)}, below ${RETENTION_CRISIS_TARGETS.d1RetentionPct}%.`);
  }
  if (rateSummary.eligibleD7Actors <= 0) blockers.push("No elapsed D7 cohort is available.");
  if (rateSummary.d7RetentionPct === null || rateSummary.d7RetentionPct < RETENTION_CRISIS_TARGETS.d7RetentionPct) {
    blockers.push(`D7 retention is ${formatPct(rateSummary.d7RetentionPct)}, below ${RETENTION_CRISIS_TARGETS.d7RetentionPct}%.`);
  }
  if (rateSummary.eligibleD30Actors <= 0) blockers.push("No elapsed D30 cohort is available.");
  if (rateSummary.d30RetentionPct === null || rateSummary.d30RetentionPct < RETENTION_CRISIS_TARGETS.d30RetentionPct) {
    blockers.push(`D30 retention is ${formatPct(rateSummary.d30RetentionPct)}, below ${RETENTION_CRISIS_TARGETS.d30RetentionPct}%.`);
  }
  if (rateSummary.twoPlusActiveDayPct === null || rateSummary.twoPlusActiveDayPct < RETENTION_CRISIS_TARGETS.twoPlusActiveDayPct) {
    blockers.push(`2+ active-day rate is ${formatPct(rateSummary.twoPlusActiveDayPct)}, below ${RETENTION_CRISIS_TARGETS.twoPlusActiveDayPct}%.`);
  }
  return blockers;
}

function buildBehavioralFindings(input: {
  activationCohorts: RetentionActivationCohort[];
  exitForensics: RetentionExitForensics[];
  rateSummary: RetentionCrisisRateSet;
  returnTriggers: RetentionReturnTrigger[];
  workflowForensics: RetentionWorkflowForensics;
}): string[] {
  const findings: string[] = [];
  const zeroOrLowActivation = input.activationCohorts
    .filter((cohort) => cohort.activationTier === "0" || cohort.activationTier === "1-24")
    .reduce((total, cohort) => total + cohort.actors, 0);
  if (zeroOrLowActivation > 0) findings.push(`${zeroOrLowActivation} actors are in activation score tiers below 25, indicating first-useful-action failure.`);
  const topExit = input.exitForensics[0];
  if (topExit) findings.push(`Top exit surface is ${topExit.exitSurface} with ${topExit.exits} actor exits and ${formatPct(topExit.firstUsefulActionFailurePct)} first-useful-action failure.`);
  const blockedTriggers = input.returnTriggers.filter((trigger) => trigger.readiness === "blocked_by_no_sample");
  if (blockedTriggers.length) findings.push(`${blockedTriggers.length} return trigger categories have no usable production sample.`);
  const failing = input.workflowForensics.failingWorkflows[0];
  if (failing) findings.push(`${workflowLabel(failing.workflow)} is the largest measured workflow that still misses D7 return behavior.`);
  if (input.rateSummary.twoPlusActiveDayActors <= 0) findings.push("No measured actor reached 2+ active days.");
  return findings;
}

function isProbeOrNoiseSegment(segment: string): boolean {
  return segment === "bot_or_noise_filtered" || segment === "probe_noise_filtered" || segment === "admin_internal_filtered";
}

function workflowLabel(workflow: RetentionWorkflowKey): string {
  if (workflow === "morningBriefing") return "Morning briefing";
  return `${workflow.slice(0, 1).toUpperCase()}${workflow.slice(1)}`;
}

function groupBy<TItem, TKey>(items: TItem[], selector: (item: TItem) => TKey): Map<TKey, TItem[]> {
  const groups = new Map<TKey, TItem[]>();
  for (const item of items) {
    const key = selector(item);
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

function pctOrNull(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${Number.isInteger(value) ? value : value.toFixed(3)}%`;
}
