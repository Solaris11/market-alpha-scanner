import "server-only";

import type { QueryResultRow } from "pg";
import { dbQuery } from "@/lib/server/db";
import {
  buildUserPersonalizationProfile,
  defaultPersonalizationProfile,
  type BehaviorLearningSummary,
  type UserPersonalizationProfile,
} from "@/lib/trading/personalized-intelligence";
import { normalizePersonalityProfile, normalizePreferenceLevel, normalizeRiskProfile, type UserRiskProfile } from "@/lib/trading/risk-veto";

type RiskProfilePersonalizationRow = QueryResultRow & {
  allow_override: boolean;
  asymmetry_preference: string | number | null;
  continuation_preference: string | number | null;
  drawdown_tolerance: string | number | null;
  event_preference: string | number | null;
  max_daily_loss: string | number | null;
  max_risk_per_trade_percent: string | number;
  max_sector_positions: string | number;
  momentum_preference: string | number | null;
  personality_confidence: string | number | null;
  personality_profile: string | null;
  preferred_reward_level: string | null;
  preferred_risk_level: string | null;
  pullback_preference: string | number | null;
  volatility_tolerance: string | number | null;
};

type BehaviorRow = QueryResultRow & {
  alert_engagement: string | number;
  ignored_opportunity_count: string | number;
  last_updated: string | null;
  repeated_symbol_views: string | number;
  top_symbols: string | null;
  watchlist_count: string | number;
};

export async function getPersonalizationProfileForUser(userId: string | null | undefined): Promise<UserPersonalizationProfile> {
  if (!userId) return defaultPersonalizationProfile();
  const [profileRow, behavior] = await Promise.all([
    readRiskProfile(userId).catch(() => null),
    readBehaviorSummary(userId).catch(() => null),
  ]);
  return buildUserPersonalizationProfile({
    behavior,
    profile: profileRow,
    source: profileRow ? "hybrid" : behavior ? "behavioral" : "default",
  });
}

async function readRiskProfile(userId: string): Promise<UserRiskProfile | null> {
  const result = await dbQuery<RiskProfilePersonalizationRow>(
    `
      SELECT
        max_risk_per_trade_percent,
        max_daily_loss,
        max_sector_positions,
        allow_override,
        personality_profile,
        preferred_risk_level,
        preferred_reward_level,
        volatility_tolerance,
        drawdown_tolerance,
        momentum_preference,
        pullback_preference,
        asymmetry_preference,
        event_preference,
        continuation_preference,
        personality_confidence
      FROM user_risk_profile
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return normalizeRiskProfile({
    allowOverride: row.allow_override,
    asymmetryPreference: numberValue(row.asymmetry_preference),
    continuationPreference: numberValue(row.continuation_preference),
    drawdownTolerance: numberValue(row.drawdown_tolerance),
    eventPreference: numberValue(row.event_preference),
    maxDailyLoss: nullableNumber(row.max_daily_loss),
    maxPositionSizePercent: null,
    maxRiskPerTradePercent: numberValue(row.max_risk_per_trade_percent),
    maxSectorExposure: numberValue(row.max_sector_positions),
    momentumPreference: numberValue(row.momentum_preference),
    personalityConfidence: numberValue(row.personality_confidence),
    personalityProfile: normalizePersonalityProfile(row.personality_profile),
    preferredRewardLevel: normalizePreferenceLevel(row.preferred_reward_level),
    preferredRiskLevel: normalizePreferenceLevel(row.preferred_risk_level),
    pullbackPreference: numberValue(row.pullback_preference),
    volatilityTolerance: numberValue(row.volatility_tolerance),
  });
}

async function readBehaviorSummary(userId: string): Promise<BehaviorLearningSummary | null> {
  const result = await dbQuery<BehaviorRow>(
    `
      WITH watchlist AS (
        SELECT count(*)::int AS watchlist_count
        FROM user_watchlist
        WHERE user_id = $1
      ),
      events AS (
        SELECT
          count(*) FILTER (WHERE event_name IN ('alert_create', 'support_prompt_click'))::int AS alert_engagement,
          count(*) FILTER (WHERE event_name = 'opportunities_open')::int AS ignored_opportunity_count,
          count(*) FILTER (WHERE event_name = 'symbol_open')::int AS repeated_symbol_views,
          max(created_at)::text AS last_updated
        FROM analytics_events
        WHERE user_id = $1
          AND created_at >= now() - interval '90 days'
      ),
      top_symbols AS (
        SELECT string_agg(symbol, ',' ORDER BY views DESC, symbol) AS top_symbols
        FROM (
          SELECT symbol, count(*) AS views
          FROM analytics_events
          WHERE user_id = $1
            AND symbol IS NOT NULL
            AND created_at >= now() - interval '90 days'
          GROUP BY symbol
          ORDER BY views DESC, symbol
          LIMIT 8
        ) ranked
      )
      SELECT
        coalesce(watchlist.watchlist_count, 0) AS watchlist_count,
        coalesce(events.alert_engagement, 0) AS alert_engagement,
        coalesce(events.ignored_opportunity_count, 0) AS ignored_opportunity_count,
        coalesce(events.repeated_symbol_views, 0) AS repeated_symbol_views,
        events.last_updated,
        top_symbols.top_symbols
      FROM watchlist, events, top_symbols
    `,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    alertEngagement: numberValue(row.alert_engagement),
    ignoredOpportunityCount: numberValue(row.ignored_opportunity_count),
    lastUpdated: row.last_updated,
    repeatedSymbolViews: numberValue(row.repeated_symbol_views),
    topSymbols: String(row.top_symbols ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8),
    watchlistCount: numberValue(row.watchlist_count),
  };
}

function numberValue(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
