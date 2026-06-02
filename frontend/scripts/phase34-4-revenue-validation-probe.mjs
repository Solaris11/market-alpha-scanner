#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const artifactRoot = process.env.TRADEVETO_PHASE34_REVENUE_ARTIFACT_ROOT
  ?? join(process.cwd(), "../docs/ops/artifacts/phase-34-4-revenue-validation");
const outputPath = process.env.TRADEVETO_PHASE34_REVENUE_OUTPUT ?? join(artifactRoot, "monetization-proof.json");
const lookbackDays = positiveInteger(process.env.TRADEVETO_PHASE34_REVENUE_LOOKBACK_DAYS, 90);
const startedAt = new Date().toISOString();

let exitCode = 0;

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for Phase 34.4 revenue validation.");

  const started = performance.now();
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const [funnel, campaigns] = await Promise.all([
      revenueFunnelCounts(pool, lookbackDays),
      revenueCampaignRows(pool, lookbackDays),
    ]);
    const campaignSpendCents = sumNullableMoney(campaigns.map((campaign) => campaign.spendCents));
    const campaignRevenueCents = sumNullableMoney(campaigns.map((campaign) => campaign.revenueCents));
    const report = buildRevenueValidationReport({
      campaigns,
      economics: {
        campaignPaidConversions: campaigns.reduce((sum, campaign) => sum + campaign.paidConversions, 0),
        campaignRevenueCents,
        campaignSpendCents,
        ltvBaselineCents: revenueEnvCents("TRADEVETO_REVENUE_LTV_BASELINE_CENTS"),
        monthlyPriceCents: revenueEnvCents("TRADEVETO_REVENUE_MONTHLY_PRICE_CENTS") ?? revenueEnvCents("STRIPE_MONTHLY_PRICE_CENTS"),
        mrrCents: revenueEnvCents("TRADEVETO_REVENUE_MRR_CENTS"),
      },
      funnel,
      generatedAt: new Date().toISOString(),
      lookbackDays,
    });
    const output = {
      acquisitionCampaignExecution: "The probe reads real acquisition telemetry only. Product Hunt, Reddit, X, Discord, and trading community campaigns are not marked run unless their traffic/conversion/cost events exist in production analytics.",
      durationMs: Math.round(performance.now() - started),
      report,
      startedAt,
      successCriteria: {
        arpuBaseline: "ARPU requires live MRR or a trusted monthly price amount plus live paid customers.",
        firstPaidCustomers: "At least one live-mode active Stripe subscription with premium plan and a current period end in the future.",
        freeToPaidEvidence: "Live checkout completion or paid conversion telemetry tied to a user.",
        ltvBaseline: "Retained paid renewal/churn evidence or an explicitly provided baseline from real billing data.",
        trialToPaidEvidence: "Explicit trial-to-paid telemetry only; generic invoice success is not relabeled as trial conversion.",
      },
    };
    await writeJson(outputPath, output);
    console.log(JSON.stringify(output, null, 2));
    if (report.status !== "ready") exitCode = 1;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function revenueFunnelCounts(pool, days) {
  const result = await pool.query(
    `
      WITH real_users AS (
        SELECT u.id, u.created_at
        FROM users u
        WHERE COALESCE(u.role, '') <> 'admin'
          AND lower(COALESCE(u.email, '')) NOT LIKE '%@tradeveto-probe.local'
      ),
      real_events AS (
        SELECT
          ae.user_id,
          COALESCE(ae.user_id::text, ae.anonymous_id_hash, ae.session_id_hash, ae.id::text) AS actor_key,
          ae.event_name,
          ae.occurred_at
        FROM analytics_events ae
        LEFT JOIN users u ON u.id = ae.user_id
        WHERE ae.occurred_at >= now() - ($1::int * interval '1 day')
          AND COALESCE(u.role, '') <> 'admin'
          AND lower(COALESCE(u.email, '')) NOT LIKE '%@tradeveto-probe.local'
          AND COALESCE(ae.source, '') NOT ILIKE '%probe%'
      ),
      live_subscriptions AS (
        SELECT s.*
        FROM user_subscriptions s
        JOIN real_users u ON u.id = s.user_id
        WHERE COALESCE(s.stripe_mode, 'live') = 'live'
      ),
      paid_subscriptions AS (
        SELECT *
        FROM live_subscriptions
        WHERE status = 'active'
          AND plan = 'premium'
          AND current_period_end > now()
          AND stripe_subscription_id IS NOT NULL
      ),
      trial_subscriptions AS (
        SELECT *
        FROM live_subscriptions
        WHERE status = 'trialing'
          AND plan = 'premium'
          AND current_period_end > now()
          AND stripe_subscription_id IS NOT NULL
      ),
      live_billing_events AS (
        SELECT be.*
        FROM billing_events be
        LEFT JOIN users u ON u.id = be.user_id
        WHERE COALESCE(be.stripe_mode, 'live') = 'live'
          AND COALESCE(u.role, '') <> 'admin'
          AND lower(COALESCE(u.email, '')) NOT LIKE '%@tradeveto-probe.local'
      )
      SELECT
        (SELECT count(DISTINCT actor_key) FROM real_events WHERE event_name IN ('page_view', 'landing_open', 'organic_search_visit', 'organic_growth_visit', 'search_landing_open', 'invite_opened', 'share_asset_opened')) AS visitor_actors,
        (SELECT count(*) FROM real_users WHERE created_at >= now() - ($1::int * interval '1 day')) AS signups,
        (SELECT count(DISTINCT user_id) FROM real_events WHERE user_id IS NOT NULL AND event_name IN ('activation_milestone', 'activation_score_update', 'onboarding_complete', 'first_useful_action')) AS activated_users,
        (SELECT count(*) FROM real_users u WHERE NOT EXISTS (SELECT 1 FROM paid_subscriptions p WHERE p.user_id = u.id)) AS free_users,
        (SELECT count(*) FROM trial_subscriptions) AS trial_users,
        (SELECT count(*) FROM paid_subscriptions) AS paid_users,
        (
          SELECT count(*)
          FROM paid_subscriptions p
          WHERE EXISTS (
            SELECT 1
            FROM real_events e
            WHERE e.user_id = p.user_id
              AND e.occurred_at::date >= p.created_at::date + 1
          )
        ) AS retained_paid_users,
        (
          SELECT count(DISTINCT user_id)
          FROM real_events
          WHERE user_id IS NOT NULL
            AND event_name = 'trial_to_paid_conversion'
        ) AS trial_to_paid_conversions,
        (
          SELECT count(DISTINCT user_id)
          FROM live_billing_events
          WHERE user_id IS NOT NULL
            AND event_type = 'checkout.session.completed'
            AND COALESCE(payload_summary->>'status', '') = 'active'
        ) + (
          SELECT count(DISTINCT user_id)
          FROM real_events
          WHERE user_id IS NOT NULL
            AND event_name IN ('free_to_paid_conversion', 'referral_paid_conversion', 'organic_paid_conversion')
        ) AS free_to_paid_conversions
    `,
    [days],
  );
  const row = result.rows[0] ?? {};
  return {
    activatedUsers: toNumber(row.activated_users),
    freeToPaidConversions: toNumber(row.free_to_paid_conversions),
    freeUsers: toNumber(row.free_users),
    paidUsers: toNumber(row.paid_users),
    retainedPaidUsers: toNumber(row.retained_paid_users),
    signups: toNumber(row.signups),
    trialToPaidConversions: toNumber(row.trial_to_paid_conversions),
    trialUsers: toNumber(row.trial_users),
    visitorActors: toNumber(row.visitor_actors),
  };
}

async function revenueCampaignRows(pool, days) {
  const result = await pool.query(
    `
      WITH campaign_events AS (
        SELECT
          COALESCE(NULLIF(ae.metadata->>'utmSource', ''), NULLIF(ae.metadata->>'source', ''), NULLIF(ae.source, ''), 'unknown') AS source,
          COALESCE(NULLIF(ae.metadata->>'utmCampaign', ''), NULLIF(ae.metadata->>'campaign', ''), NULLIF(ae.metadata->>'referralCode', ''), NULLIF(ae.metadata->>'organicSource', ''), 'unknown') AS campaign,
          COALESCE(ae.user_id::text, ae.anonymous_id_hash, ae.session_id_hash, ae.id::text) AS actor_key,
          ae.user_id,
          ae.event_name,
          ae.metadata
        FROM analytics_events ae
        LEFT JOIN users u ON u.id = ae.user_id
        WHERE ae.occurred_at >= now() - ($1::int * interval '1 day')
          AND COALESCE(u.role, '') <> 'admin'
          AND lower(COALESCE(u.email, '')) NOT LIKE '%@tradeveto-probe.local'
          AND COALESCE(ae.source, '') NOT ILIKE '%probe%'
          AND (
            ae.event_name IN (
              'organic_growth_visit',
              'organic_search_visit',
              'search_landing_open',
              'invite_opened',
              'invite_sent',
              'referral_signup',
              'organic_signup',
              'referral_paid_conversion',
              'organic_paid_conversion',
              'share_asset_opened',
              'share_asset_click',
              'founding_checkout_start'
            )
            OR ae.metadata ? 'utmSource'
            OR ae.metadata ? 'utmCampaign'
            OR ae.metadata ? 'campaignSpendCents'
            OR ae.metadata ? 'campaignRevenueCents'
          )
      )
      SELECT
        source,
        campaign,
        count(DISTINCT actor_key) FILTER (WHERE event_name IN ('organic_growth_visit', 'organic_search_visit', 'search_landing_open', 'invite_opened', 'share_asset_opened', 'share_asset_click')) AS visitors,
        count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL AND event_name IN ('referral_signup', 'organic_signup', 'early_access_signup_complete')) AS signups,
        count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL AND event_name IN ('referral_paid_conversion', 'organic_paid_conversion', 'free_to_paid_conversion')) AS paid_conversions,
        sum(CASE WHEN metadata ? 'campaignSpendCents' AND metadata->>'campaignSpendCents' ~ '^[0-9]+$' THEN (metadata->>'campaignSpendCents')::bigint ELSE NULL END) AS spend_cents,
        sum(CASE WHEN metadata ? 'campaignRevenueCents' AND metadata->>'campaignRevenueCents' ~ '^[0-9]+$' THEN (metadata->>'campaignRevenueCents')::bigint ELSE NULL END) AS revenue_cents
      FROM campaign_events
      GROUP BY source, campaign
      ORDER BY paid_conversions DESC, signups DESC, visitors DESC
      LIMIT 25
    `,
    [days],
  );
  return result.rows.map((row) => ({
    campaign: row.campaign ?? "unknown",
    paidConversions: toNumber(row.paid_conversions),
    revenueCents: toNullableNumber(row.revenue_cents),
    signups: toNumber(row.signups),
    source: row.source ?? "unknown",
    spendCents: toNullableNumber(row.spend_cents),
    visitors: toNumber(row.visitors),
  }));
}

function buildRevenueValidationReport(input) {
  const funnel = normalizeFunnel(input.funnel);
  const monthlyPriceCents = normalizeNullableMoney(input.economics.monthlyPriceCents);
  const explicitMrrCents = normalizeNullableMoney(input.economics.mrrCents);
  const mrrCents = explicitMrrCents ?? (monthlyPriceCents === null ? null : monthlyPriceCents * funnel.paidUsers);
  const arpuCents = mrrCents === null || funnel.paidUsers <= 0 ? null : Math.round(mrrCents / funnel.paidUsers);
  const arrCents = mrrCents === null ? null : mrrCents * 12;
  const campaignSpendCents = normalizeNullableMoney(input.economics.campaignSpendCents);
  const campaignRevenueCents = normalizeNullableMoney(input.economics.campaignRevenueCents);
  const campaignPaidConversions = Math.max(0, Math.trunc(input.economics.campaignPaidConversions));
  const cacCents = campaignSpendCents === null || campaignPaidConversions <= 0 ? null : Math.round(campaignSpendCents / campaignPaidConversions);
  const ltvBaselineCents = normalizeNullableMoney(input.economics.ltvBaselineCents);
  const campaigns = input.campaigns.map(normalizeCampaign);
  const rates = {
    freeToPaidPct: percent(funnel.freeToPaidConversions, funnel.freeUsers),
    paidRetentionPct: percent(funnel.retainedPaidUsers, funnel.paidUsers),
    signupToActivatedPct: percent(funnel.activatedUsers, funnel.signups),
    trialToPaidPct: percent(funnel.trialToPaidConversions, funnel.trialUsers),
    visitorToSignupPct: percent(funnel.signups, funnel.visitorActors),
  };
  const gates = {
    arpuBaseline: arpuCents !== null,
    firstPaidCustomers: funnel.paidUsers > 0,
    freeToPaidEvidence: funnel.freeToPaidConversions > 0,
    ltvBaseline: ltvBaselineCents !== null,
    realAcquisitionCampaignEvidence: campaigns.some((campaign) => campaign.visitors > 0 || campaign.signups > 0 || campaign.paidConversions > 0 || (campaign.spendCents ?? 0) > 0),
    trialToPaidEvidence: funnel.trialToPaidConversions > 0,
  };
  const economics = {
    arpuCents,
    arrCents,
    cacCents,
    campaignRevenueCents,
    campaignSpendCents,
    ltvBaselineCents,
    monthlyPriceCents,
    mrrCents,
  };
  const blockers = revenueBlockers(gates, economics);
  return {
    blockers,
    campaigns,
    economics,
    funnel,
    generatedAt: input.generatedAt,
    gates,
    lookbackDays: Math.max(1, Math.trunc(input.lookbackDays)),
    noSyntheticRevenueDataCreated: true,
    proofBoundary: "Revenue validation reads first-party analytics, live-mode Stripe subscription state, billing lifecycle events, and explicit campaign metadata only. It does not create customers, backfill conversions, infer paid users from test-mode subscriptions, or fabricate campaign spend.",
    rates,
    status: blockers.length === 0 ? "ready" : hasPartialRevenueEvidence(funnel, campaigns) ? "strong_partial" : "not_ready",
  };
}

function revenueBlockers(gates, economics) {
  const blockers = [];
  if (!gates.firstPaidCustomers) blockers.push("No live paid customers are proven.");
  if (!gates.trialToPaidEvidence) blockers.push("No trial-to-paid conversion evidence is proven.");
  if (!gates.freeToPaidEvidence) blockers.push("No free-to-paid conversion evidence is proven.");
  if (!gates.arpuBaseline) blockers.push("ARPU is unproven because no trusted live MRR or monthly price amount is available.");
  if (!gates.ltvBaseline) blockers.push("LTV baseline is unproven because no retained paid renewal/churn evidence is available.");
  if (!gates.realAcquisitionCampaignEvidence) blockers.push("No real acquisition campaign traffic, conversion, cost, or revenue evidence is present.");
  if (gates.realAcquisitionCampaignEvidence && economics.cacCents === null) blockers.push("CAC is unproven because campaign spend and paid conversion evidence are incomplete.");
  return blockers;
}

function hasPartialRevenueEvidence(funnel, campaigns) {
  return funnel.visitorActors > 0 || funnel.signups > 0 || funnel.activatedUsers > 0 || funnel.trialUsers > 0 || funnel.paidUsers > 0 || campaigns.length > 0;
}

function normalizeFunnel(funnel) {
  return {
    activatedUsers: nonNegativeInteger(funnel.activatedUsers),
    freeUsers: nonNegativeInteger(funnel.freeUsers),
    freeToPaidConversions: nonNegativeInteger(funnel.freeToPaidConversions),
    paidUsers: nonNegativeInteger(funnel.paidUsers),
    retainedPaidUsers: nonNegativeInteger(funnel.retainedPaidUsers),
    signups: nonNegativeInteger(funnel.signups),
    trialToPaidConversions: nonNegativeInteger(funnel.trialToPaidConversions),
    trialUsers: nonNegativeInteger(funnel.trialUsers),
    visitorActors: nonNegativeInteger(funnel.visitorActors),
  };
}

function normalizeCampaign(campaign) {
  return {
    campaign: boundedText(campaign.campaign, "unknown"),
    paidConversions: nonNegativeInteger(campaign.paidConversions),
    revenueCents: normalizeNullableMoney(campaign.revenueCents),
    signups: nonNegativeInteger(campaign.signups),
    source: boundedText(campaign.source, "unknown"),
    spendCents: normalizeNullableMoney(campaign.spendCents),
    visitors: nonNegativeInteger(campaign.visitors),
  };
}

function boundedText(value, fallback) {
  const text = String(value ?? "").trim().replace(/[^A-Za-z0-9._:/ -]/g, "").replace(/\s+/g, " ").slice(0, 80);
  return text || fallback;
}

function normalizeNullableMoney(value) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

function nonNegativeInteger(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function percent(numerator, denominator) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

function revenueEnvCents(name) {
  const raw = process.env[name]?.trim();
  if (!raw || !/^[0-9]+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumNullableMoney(values) {
  const measured = values.filter((value) => value !== null);
  if (!measured.length) return null;
  return measured.reduce((sum, value) => sum + value, 0);
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}

function toNumber(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toNullableNumber(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[phase34:revenue] failed: ${message}`);
    exitCode = 1;
  })
  .finally(() => {
    process.exit(exitCode);
  });
