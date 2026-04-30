import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { getCurrentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";
import { DEFAULT_USER_RISK_PROFILE, normalizeRiskProfile, type UserRiskProfile } from "@/lib/trading/risk-veto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RiskProfileRow = QueryResultRow & {
  allow_override: boolean;
  max_daily_loss: string | number | null;
  max_risk_per_trade_percent: string | number;
  max_sector_positions: string | number;
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
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ authenticated: false, error: "Sign in to save risk rules." }, { status: 401 });
  }

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
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, now(), now())
        ON CONFLICT (user_id)
        DO UPDATE SET
          max_risk_per_trade_percent = EXCLUDED.max_risk_per_trade_percent,
          max_daily_loss = EXCLUDED.max_daily_loss,
          max_sector_positions = EXCLUDED.max_sector_positions,
          allow_override = EXCLUDED.allow_override,
          updated_at = now()
        RETURNING max_risk_per_trade_percent, max_daily_loss, max_sector_positions, allow_override
      `,
      [user.id, profile.maxRiskPerTradePercent, profile.maxDailyLoss, profile.maxSectorExposure, profile.allowOverride],
    );
    return NextResponse.json({ authenticated: true, profile: profileFromRow(result.rows[0]) });
  } catch {
    return NextResponse.json({ authenticated: true, error: "Failed to save risk profile." }, { status: 500 });
  }
}

async function readRiskProfileRow(userId: string): Promise<RiskProfileRow | null> {
  const result = await dbQuery<RiskProfileRow>(
    `
      SELECT max_risk_per_trade_percent, max_daily_loss, max_sector_positions, allow_override
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
    maxDailyLoss: nullableNumber(row.max_daily_loss),
    maxPositionSizePercent: null,
    maxRiskPerTradePercent: numberValue(row.max_risk_per_trade_percent),
    maxSectorExposure: numberValue(row.max_sector_positions),
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
