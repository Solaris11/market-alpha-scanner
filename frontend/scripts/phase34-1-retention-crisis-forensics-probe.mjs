#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const artifactRoot = process.env.TRADEVETO_PHASE34_RETENTION_ARTIFACT_ROOT
  ?? join(process.cwd(), "../docs/ops/artifacts/phase-34-1-retention-crisis");
const outputPath = process.env.TRADEVETO_PHASE34_RETENTION_OUTPUT ?? join(artifactRoot, "retention-crisis-forensics-proof.json");
const lookbackDays = positiveInteger(process.env.TRADEVETO_PHASE34_RETENTION_LOOKBACK_DAYS, 120);
const startedAt = new Date().toISOString();

const targets = {
  d1RetentionPct: 20,
  d7RetentionPct: 10,
  d30RetentionPct: 5,
  twoPlusActiveDayPct: 15,
};

const workflowKeys = ["watchlist", "alert", "chart", "scanner", "copilot", "symbol", "replay", "morningBriefing"];

let exitCode = 0;

async function main() {
  const started = performance.now();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for Phase 34.1 retention forensics.");
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const { rows } = await pool.query(actorForensicsSql(), [lookbackDays]);
    const actors = rows.map(actorFromRow);
    const report = buildReport(actors, Math.round(performance.now() - started));
    await writeJson(outputPath, report);
    console.log(JSON.stringify(report, null, 2));
    if (report.status === "not_ready") exitCode = 1;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

function buildReport(actors, queryLatencyMs) {
  const realActors = actors.filter((actor) => !isFilteredSegment(actor.segment));
  const rateSummary = buildRateSet(realActors);
  const signupDateCohorts = buildSignupDateCohorts(realActors);
  const activationCohorts = buildActivationCohorts(realActors);
  const workflowCohorts = buildWorkflowCohorts(realActors);
  const workflowForensics = buildWorkflowForensics(workflowCohorts);
  const exitForensics = buildExitForensics(realActors);
  const returnTriggers = buildReturnTriggers(realActors);
  const blockers = buildBlockers(rateSummary, realActors.length);
  const behavioralFindings = buildBehavioralFindings({ activationCohorts, exitForensics, rateSummary, returnTriggers, workflowForensics });
  const status = blockers.length === 0 ? "ready" : realActors.length > 0 ? "strong_partial" : "not_ready";
  return {
    behavioralAnalysis: {
      behavioralFindings,
      exitForensics,
      returnCreatingWorkflows: workflowForensics.returnCreatingWorkflows,
      workflowFailures: workflowForensics.failingWorkflows,
    },
    blockers,
    cohortAnalysis: {
      activationCohorts,
      signupDateCohorts: signupDateCohorts.slice(-45),
      workflowCohorts,
    },
    elapsedOnly: true,
    experiments: retentionExperimentCatalog(),
    finalRetentionProof: {
      rateSummary,
      successCriteria: targets,
      verdict: status === "ready" ? "retention_crisis_eliminated" : status === "strong_partial" ? "forensics_ready_targets_not_met" : "retention_proof_unavailable",
    },
    generatedAt: new Date().toISOString(),
    lookbackDays,
    noSyntheticCohortDataCreated: true,
    proofBoundary: "This probe reads production analytics only. It does not create users, create events, backfill cohorts, count probe/admin actors, or convert same-day activity into elapsed D1/D7/D30 retention.",
    queryLatencyMs,
    returnTriggers,
    sampleSize: {
      actors: actors.length,
      filteredActors: actors.length - realActors.length,
      realActors: realActors.length,
      segments: segmentCounts(actors),
    },
    startedAt,
    status,
    targets,
  };
}

function actorForensicsSql() {
  return `
    WITH paid_users AS (
      SELECT
        user_id,
        bool_or(status IN ('active', 'trialing') AND plan = 'premium') AS paid
      FROM user_subscriptions
      GROUP BY 1
    ),
    events AS (
      SELECT
        COALESCE(ae.user_id::text, ae.anonymous_id_hash, ae.session_id_hash, ae.id::text) AS actor_key,
        ae.user_id::text AS user_id,
        lower(COALESCE(u.email, '')) AS user_email,
        COALESCE(u.role, '') AS user_role,
        COALESCE(ae.plan, CASE WHEN ae.user_id IS NULL THEN 'anonymous' ELSE 'free' END) AS plan,
        COALESCE(pu.paid, false) AS paid_subscription,
        COALESCE(u.created_at, ae.occurred_at) AS signup_at,
        ae.occurred_at,
        ae.occurred_at::date AS active_day,
        ae.event_name,
        COALESCE(ae.page_path, '') AS page_path,
        COALESCE(ae.source, '') AS source,
        ae.metadata
      FROM analytics_events ae
      LEFT JOIN users u ON u.id = ae.user_id
      LEFT JOIN paid_users pu ON pu.user_id = ae.user_id
      WHERE ae.occurred_at >= now() - ($1::int * interval '1 day')
    ),
    ranked_pages AS (
      SELECT
        actor_key,
        page_path,
        row_number() OVER (PARTITION BY actor_key ORDER BY occurred_at DESC) AS page_rank
      FROM events
      WHERE event_name = 'page_view'
    ),
    actor_profile AS (
      SELECT
        actor_key,
        min(signup_at)::date AS signup_date,
        min(active_day) AS first_active_day,
        max(active_day) AS last_active_day,
        count(*) AS total_events,
        count(DISTINCT active_day) AS active_days,
        max(
          CASE
            WHEN event_name = 'activation_score_update' AND metadata->>'score' ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (metadata->>'score')::float
            ELSE NULL
          END
        ) AS activation_score_event,
        count(*) FILTER (WHERE event_name = 'first_useful_action') AS first_useful_actions,
        bool_or(
          event_name IN ('watch_add', 'watchlist_add', 'watchlist_usage', 'watchlist_return', 'watchlist_retention')
          OR (event_name = 'first_useful_action' AND COALESCE(metadata->>'actionKey', metadata->>'action', '') LIKE '%watchlist%')
        ) AS used_watchlist,
        bool_or(
          event_name IN ('alert_create', 'alert_return', 'notification_engagement', 'notification_usefulness_feedback')
          OR (event_name = 'first_useful_action' AND COALESCE(metadata->>'actionKey', metadata->>'action', '') LIKE '%alert%')
        ) AS used_alert,
        bool_or(
          event_name IN ('chart_interaction', 'chart_expand', 'chart_return', 'chart_indicator_template_save', 'chart_indicator_template_apply')
          OR (event_name = 'first_useful_action' AND COALESCE(metadata->>'actionKey', metadata->>'action', '') LIKE '%chart%')
        ) AS used_chart,
        bool_or(
          event_name IN ('discover_open', 'scanner_open', 'scanner_run', 'scanner_usage', 'scanner_return', 'scanner_habit_loop', 'opportunities_open', 'signal_drilldown')
          OR (event_name = 'first_useful_action' AND COALESCE(metadata->>'actionKey', metadata->>'action', '') LIKE '%scanner%')
        ) AS used_scanner,
        bool_or(
          event_name = 'copilot_question'
          OR source ILIKE '%copilot%'
          OR COALESCE(metadata->>'surface', '') ILIKE '%copilot%'
        ) AS used_copilot,
        bool_or(
          event_name IN ('symbol_open', 'symbol_return')
          OR page_path LIKE '/symbol/%'
          OR (event_name = 'first_useful_action' AND COALESCE(metadata->>'actionKey', metadata->>'action', '') LIKE '%symbol%')
        ) AS used_symbol,
        bool_or(
          event_name IN ('replay_open', 'replay_usage', 'replay_return', 'history_open', 'history_return')
          OR (event_name = 'first_useful_action' AND COALESCE(metadata->>'actionKey', metadata->>'action', '') LIKE '%replay%')
          OR (event_name = 'first_useful_action' AND COALESCE(metadata->>'actionKey', metadata->>'action', '') LIKE '%history%')
        ) AS used_replay,
        bool_or(
          event_name IN ('morning_workflow_start', 'morning_workflow_complete', 'briefing_return')
          OR (event_name = 'first_useful_action' AND COALESCE(metadata->>'actionKey', metadata->>'action', '') LIKE '%morning%')
        ) AS used_morning,
        bool_or(event_name IN ('alert_create', 'notification_engagement')) AS alert_triggered,
        bool_or(event_name = 'alert_return') AS alert_return,
        count(*) FILTER (
          WHERE event_name = 'notification_usefulness_feedback'
            AND COALESCE(metadata->>'action', '') = 'useful_feedback'
        ) AS notification_useful_feedback,
        count(*) FILTER (
          WHERE event_name = 'notification_usefulness_feedback'
            AND COALESCE(metadata->>'action', '') IN ('useful_feedback', 'not_useful_feedback')
        ) AS notification_feedback_total,
        bool_or(user_email LIKE '%@tradeveto-probe.local' OR source ILIKE '%probe%' OR user_email LIKE 'phase%-%@tradeveto-probe.local') AS probe_user,
        bool_or(user_role = 'admin') AS admin_user,
        bool_or(paid_subscription OR plan = 'premium') AS paid_user,
        bool_or(user_id IS NOT NULL) AS authenticated_user
      FROM events
      GROUP BY actor_key
    )
    SELECT
      ap.*,
      COALESCE(rp.page_path, 'unknown') AS exit_surface,
      (current_date - ap.signup_date) >= 1 AS eligible_d1,
      (current_date - ap.signup_date) >= 2 AS eligible_d2,
      (current_date - ap.signup_date) >= 7 AS eligible_d7,
      (current_date - ap.signup_date) >= 30 AS eligible_d30,
      EXISTS (
        SELECT 1 FROM events e
        WHERE e.actor_key = ap.actor_key AND e.active_day >= ap.signup_date + 1
      ) AS retained_d1,
      EXISTS (
        SELECT 1 FROM events e
        WHERE e.actor_key = ap.actor_key AND e.active_day >= ap.signup_date + 2
      ) AS retained_d2,
      EXISTS (
        SELECT 1 FROM events e
        WHERE e.actor_key = ap.actor_key AND e.active_day >= ap.signup_date + 7
      ) AS retained_d7,
      EXISTS (
        SELECT 1 FROM events e
        WHERE e.actor_key = ap.actor_key AND e.active_day >= ap.signup_date + 30
      ) AS retained_d30
    FROM actor_profile ap
    LEFT JOIN ranked_pages rp ON rp.actor_key = ap.actor_key AND rp.page_rank = 1
    ORDER BY ap.signup_date ASC, ap.actor_key ASC
  `;
}

function actorFromRow(row) {
  const workflows = {
    alert: Boolean(row.used_alert),
    chart: Boolean(row.used_chart),
    copilot: Boolean(row.used_copilot),
    morningBriefing: Boolean(row.used_morning),
    replay: Boolean(row.used_replay),
    scanner: Boolean(row.used_scanner),
    symbol: Boolean(row.used_symbol),
    watchlist: Boolean(row.used_watchlist),
  };
  const activationScore = numberOrNull(row.activation_score_event) ?? computedActivationScore(workflows);
  return {
    activationScore,
    activeDays: integer(row.active_days),
    actorKey: String(row.actor_key ?? "unknown"),
    alertReturn: Boolean(row.alert_return),
    alertTriggered: Boolean(row.alert_triggered),
    eligibleD1: Boolean(row.eligible_d1),
    eligibleD2: Boolean(row.eligible_d2),
    eligibleD7: Boolean(row.eligible_d7),
    eligibleD30: Boolean(row.eligible_d30),
    exitSurface: surfaceFromPath(row.exit_surface),
    firstUsefulActions: integer(row.first_useful_actions),
    notificationFeedbackTotal: integer(row.notification_feedback_total),
    notificationUsefulFeedback: integer(row.notification_useful_feedback),
    retainedD1: Boolean(row.retained_d1),
    retainedD2: Boolean(row.retained_d2),
    retainedD7: Boolean(row.retained_d7),
    retainedD30: Boolean(row.retained_d30),
    segment: segmentForRow(row),
    signupDate: isoDate(row.signup_date),
    workflows,
  };
}

function buildRateSet(actors) {
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

function buildSignupDateCohorts(actors) {
  return Array.from(groupBy(actors, (actor) => actor.signupDate).entries())
    .map(([signupDate, cohortActors]) => ({ ...buildRateSet(cohortActors), signupDate }))
    .sort((left, right) => left.signupDate.localeCompare(right.signupDate));
}

function buildActivationCohorts(actors) {
  const groups = groupBy(actors, (actor) => activationTierForScore(actor.activationScore));
  return ["0", "1-24", "25-49", "50-74", "75+"].map((activationTier) => {
    const cohortActors = groups.get(activationTier) ?? [];
    return {
      ...buildRateSet(cohortActors),
      activationTier,
      averageActivationScore: cohortActors.length ? cohortActors.reduce((total, actor) => total + actor.activationScore, 0) / cohortActors.length : 0,
    };
  });
}

function buildWorkflowCohorts(actors) {
  return workflowKeys.flatMap((workflow) => {
    const usedActors = actors.filter((actor) => actor.workflows[workflow]);
    const unusedActors = actors.filter((actor) => !actor.workflows[workflow]);
    return [
      { ...buildRateSet(usedActors), cohort: "used", workflow },
      { ...buildRateSet(unusedActors), cohort: "not_used", workflow },
    ];
  });
}

function buildWorkflowForensics(workflowCohorts) {
  const usedCohorts = workflowCohorts.filter((cohort) => cohort.cohort === "used");
  return {
    failingWorkflows: usedCohorts
      .filter((cohort) => cohort.actors > 0 && (cohort.d7RetentionPct === null || cohort.d7RetentionPct < targets.d7RetentionPct))
      .map((cohort) => ({
        reason: `${workflowLabel(cohort.workflow)} users are not returning at D7 target levels.`,
        retainedD7Pct: cohort.d7RetentionPct,
        users: cohort.actors,
        workflow: cohort.workflow,
      }))
      .sort((left, right) => right.users - left.users),
    returnCreatingWorkflows: usedCohorts
      .filter((cohort) => cohort.actors > 0 && (cohort.d7RetentionPct ?? 0) >= targets.d7RetentionPct)
      .map((cohort) => ({
        retainedD7Pct: cohort.d7RetentionPct,
        retainedD30Pct: cohort.d30RetentionPct,
        users: cohort.actors,
        workflow: cohort.workflow,
      }))
      .sort((left, right) => (right.retainedD7Pct ?? 0) - (left.retainedD7Pct ?? 0)),
  };
}

function buildExitForensics(actors) {
  return Array.from(groupBy(actors, (actor) => actor.exitSurface || "unknown").entries())
    .map(([exitSurface, cohortActors]) => ({
      exitSurface,
      exits: cohortActors.length,
      firstUsefulActionFailurePct: pctOrNull(cohortActors.filter((actor) => actor.firstUsefulActions <= 0).length, cohortActors.length),
      lowActivationActors: cohortActors.filter((actor) => actor.activationScore < 25).length,
    }))
    .sort((left, right) => right.exits - left.exits)
    .slice(0, 12);
}

function buildReturnTriggers(actors) {
  const triggers = [
    { count: actors.filter((actor) => actor.workflows.watchlist).length, name: "Watchlist changes", triggerKey: "watchlist_changes" },
    { count: actors.filter((actor) => actor.workflows.scanner).length, name: "New scanner opportunities", triggerKey: "new_opportunities" },
    { count: actors.filter((actor) => actor.workflows.copilot).length, name: "AI confidence changes", triggerKey: "ai_confidence_changes" },
    { count: actors.filter((actor) => actor.workflows.morningBriefing).length, name: "Macro changes", triggerKey: "macro_changes" },
    { count: actors.filter((actor) => actor.workflows.chart || actor.workflows.symbol).length, name: "Portfolio risk changes", triggerKey: "portfolio_risk_changes" },
    { count: actors.filter((actor) => actor.alertTriggered).length, name: "Alert opportunities", triggerKey: "alert_opportunities" },
  ];
  return triggers.map((trigger) => ({
    evidenceEvents: trigger.count,
    name: trigger.name,
    readiness: trigger.count > 0 ? "ready_to_test" : actors.length > 0 ? "blocked_by_no_sample" : "needs_instrumentation",
    triggerKey: trigger.triggerKey,
  }));
}

function buildBlockers(rateSummary, realActorCount) {
  const blockers = [];
  if (realActorCount <= 0) {
    blockers.push("No real production actors remain after probe/noise filtering.");
    return blockers;
  }
  if (rateSummary.eligibleD1Actors <= 0) blockers.push("No elapsed D1 cohort is available.");
  if (rateSummary.d1RetentionPct === null || rateSummary.d1RetentionPct < targets.d1RetentionPct) blockers.push(`D1 retention is ${formatPct(rateSummary.d1RetentionPct)}, below ${targets.d1RetentionPct}%.`);
  if (rateSummary.eligibleD7Actors <= 0) blockers.push("No elapsed D7 cohort is available.");
  if (rateSummary.d7RetentionPct === null || rateSummary.d7RetentionPct < targets.d7RetentionPct) blockers.push(`D7 retention is ${formatPct(rateSummary.d7RetentionPct)}, below ${targets.d7RetentionPct}%.`);
  if (rateSummary.eligibleD30Actors <= 0) blockers.push("No elapsed D30 cohort is available.");
  if (rateSummary.d30RetentionPct === null || rateSummary.d30RetentionPct < targets.d30RetentionPct) blockers.push(`D30 retention is ${formatPct(rateSummary.d30RetentionPct)}, below ${targets.d30RetentionPct}%.`);
  if (rateSummary.twoPlusActiveDayPct === null || rateSummary.twoPlusActiveDayPct < targets.twoPlusActiveDayPct) blockers.push(`2+ active-day rate is ${formatPct(rateSummary.twoPlusActiveDayPct)}, below ${targets.twoPlusActiveDayPct}%.`);
  return blockers;
}

function buildBehavioralFindings({ activationCohorts, exitForensics, rateSummary, returnTriggers, workflowForensics }) {
  const findings = [];
  const lowActivationActors = activationCohorts
    .filter((cohort) => cohort.activationTier === "0" || cohort.activationTier === "1-24")
    .reduce((total, cohort) => total + cohort.actors, 0);
  if (lowActivationActors > 0) findings.push(`${lowActivationActors} actors are in activation score tiers below 25; first-session durable actions are not consistently happening.`);
  if (exitForensics[0]) findings.push(`Top exit surface is ${exitForensics[0].exitSurface}; ${formatPct(exitForensics[0].firstUsefulActionFailurePct)} of those actors have no first useful action.`);
  const blockedTriggers = returnTriggers.filter((trigger) => trigger.readiness === "blocked_by_no_sample");
  if (blockedTriggers.length) findings.push(`${blockedTriggers.length} return trigger categories have no usable sample yet.`);
  if (workflowForensics.failingWorkflows[0]) findings.push(`${workflowLabel(workflowForensics.failingWorkflows[0].workflow)} is the largest measured workflow missing D7 return behavior.`);
  if (rateSummary.twoPlusActiveDayActors <= 0) findings.push("No measured real actor reached 2+ active days.");
  return findings;
}

function retentionExperimentCatalog() {
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

function segmentForRow(row) {
  if (Boolean(row.probe_user)) return "probe_noise_filtered";
  if (Boolean(row.admin_user)) return "admin_internal_filtered";
  if (Boolean(row.paid_user)) return "founding_paid";
  if (Boolean(row.authenticated_user)) return "free_authenticated";
  return "anonymous_users";
}

function segmentCounts(actors) {
  return Object.fromEntries(Array.from(groupBy(actors, (actor) => actor.segment).entries()).map(([segment, segmentActors]) => [segment, segmentActors.length]));
}

function computedActivationScore(workflows) {
  const score = [
    workflows.scanner ? 16 : 0,
    workflows.watchlist ? 16 : 0,
    workflows.symbol ? 14 : 0,
    workflows.alert ? 13 : 0,
    workflows.chart ? 12 : 0,
    workflows.morningBriefing ? 11 : 0,
    workflows.copilot ? 8 : 0,
    workflows.replay ? 6 : 0,
  ].reduce((total, value) => total + value, 0);
  return Math.min(100, score);
}

function activationTierForScore(score) {
  if (score <= 0) return "0";
  if (score < 25) return "1-24";
  if (score < 50) return "25-49";
  if (score < 75) return "50-74";
  return "75+";
}

function surfaceFromPath(path) {
  const text = String(path ?? "").split("?")[0] || "unknown";
  if (text === "/") return "landing";
  if (text.startsWith("/symbol/")) return "symbol";
  const first = text.replace(/^\/+/, "").split("/")[0];
  return first || "unknown";
}

function isFilteredSegment(segment) {
  return segment === "probe_noise_filtered" || segment === "admin_internal_filtered" || segment === "bot_or_noise_filtered";
}

function groupBy(items, selector) {
  const groups = new Map();
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

function pctOrNull(numerator, denominator) {
  if (denominator <= 0) return null;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function formatPct(value) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${Number.isInteger(value) ? value : value.toFixed(3)}%`;
}

function workflowLabel(workflow) {
  if (workflow === "morningBriefing") return "Morning briefing";
  return `${workflow.slice(0, 1).toUpperCase()}${workflow.slice(1)}`;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function integer(value) {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "unknown").slice(0, 10);
}

async function writeJson(path, payload) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

try {
  await main();
} catch (error) {
  exitCode = 1;
  const failure = {
    error: error instanceof Error ? error.message : "Phase 34.1 retention crisis forensics failed",
    generatedAt: new Date().toISOString(),
    noSyntheticCohortDataCreated: true,
    proofBoundary: "Failure occurred before any retention event writes; this probe is read-only.",
    startedAt,
    status: "not_ready",
  };
  await writeJson(outputPath, failure).catch(() => undefined);
  console.error(JSON.stringify(failure, null, 2));
} finally {
  process.exitCode = exitCode;
}
