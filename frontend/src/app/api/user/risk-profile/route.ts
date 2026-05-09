import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { getCurrentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { DEFAULT_USER_RISK_PROFILE, normalizePersonalityProfile, normalizePreferenceLevel, normalizeRiskProfile, type UserRiskProfile } from "@/lib/trading/risk-veto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RiskProfileRow = QueryResultRow & {
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

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ authenticated: false, profile: null });
  }

  try {
    const row = await readRiskProfileRow(user.id);
    return NextResponse.json({
      authenticated: true,
      exists: Boolean(row),
      profile: row ? profileFromRow(row) : DEFAULT_USER_RISK_PROFILE,
    });
  } catch {
    return NextResponse.json({ authenticated: true, error: "Failed to load risk profile.", profile: DEFAULT_USER_RISK_PROFILE }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const rateLimited = await rateLimitRequest(request, "risk-profile:write", { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ authenticated: false, error: "Sign in to save risk rules." }, { status: 401 });
  }

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = (await request.json().catch(() => null)) as Partial<UserRiskProfile> | null;
  const profile = normalizeRiskProfile(payload);

  try {
    const result = await dbQuery<RiskProfileRow>(
      `
        INSERT INTO user_risk_profile (
          user_id,
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
          personality_confidence,
          created_at,
          updated_at,
          profile_updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now(), now(), now())
        ON CONFLICT (user_id)
        DO UPDATE SET
          max_risk_per_trade_percent = EXCLUDED.max_risk_per_trade_percent,
          max_daily_loss = EXCLUDED.max_daily_loss,
          max_sector_positions = EXCLUDED.max_sector_positions,
          allow_override = EXCLUDED.allow_override,
          personality_profile = EXCLUDED.personality_profile,
          preferred_risk_level = EXCLUDED.preferred_risk_level,
          preferred_reward_level = EXCLUDED.preferred_reward_level,
          volatility_tolerance = EXCLUDED.volatility_tolerance,
          drawdown_tolerance = EXCLUDED.drawdown_tolerance,
          momentum_preference = EXCLUDED.momentum_preference,
          pullback_preference = EXCLUDED.pullback_preference,
          asymmetry_preference = EXCLUDED.asymmetry_preference,
          event_preference = EXCLUDED.event_preference,
          continuation_preference = EXCLUDED.continuation_preference,
          personality_confidence = EXCLUDED.personality_confidence,
          updated_at = now(),
          profile_updated_at = now()
        RETURNING
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
      `,
      [
        user.id,
        profile.maxRiskPerTradePercent,
        profile.maxDailyLoss,
        profile.maxSectorExposure,
        profile.allowOverride,
        profile.personalityProfile,
        profile.preferredRiskLevel,
        profile.preferredRewardLevel,
        profile.volatilityTolerance,
        profile.drawdownTolerance,
        profile.momentumPreference,
        profile.pullbackPreference,
        profile.asymmetryPreference,
        profile.eventPreference,
        profile.continuationPreference,
        profile.personalityConfidence,
      ],
    );
    return NextResponse.json({ authenticated: true, profile: profileFromRow(result.rows[0]) });
  } catch {
    return NextResponse.json({ authenticated: true, error: "Failed to save risk profile." }, { status: 500 });
  }
}

async function readRiskProfileRow(userId: string): Promise<RiskProfileRow | null> {
  const result = await dbQuery<RiskProfileRow>(
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
  return result.rows[0] ?? null;
}

function profileFromRow(row: RiskProfileRow | undefined): UserRiskProfile {
  if (!row) return DEFAULT_USER_RISK_PROFILE;
  return normalizeRiskProfile({
    allowOverride: row.allow_override,
    asymmetryPreference: nullableNumber(row.asymmetry_preference) ?? undefined,
    continuationPreference: nullableNumber(row.continuation_preference) ?? undefined,
    drawdownTolerance: nullableNumber(row.drawdown_tolerance) ?? undefined,
    eventPreference: nullableNumber(row.event_preference) ?? undefined,
    maxDailyLoss: nullableNumber(row.max_daily_loss),
    maxPositionSizePercent: null,
    maxRiskPerTradePercent: numberValue(row.max_risk_per_trade_percent),
    maxSectorExposure: numberValue(row.max_sector_positions),
    momentumPreference: nullableNumber(row.momentum_preference) ?? undefined,
    personalityConfidence: nullableNumber(row.personality_confidence) ?? undefined,
    personalityProfile: normalizePersonalityProfile(row.personality_profile),
    preferredRewardLevel: normalizePreferenceLevel(row.preferred_reward_level),
    preferredRiskLevel: normalizePreferenceLevel(row.preferred_risk_level),
    pullbackPreference: nullableNumber(row.pullback_preference) ?? undefined,
    volatilityTolerance: nullableNumber(row.volatility_tolerance) ?? undefined,
  });
}

function numberValue(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
