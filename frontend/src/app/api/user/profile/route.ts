import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { getCurrentUser, userFromRow } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RISK_LEVELS = new Set(["beginner", "intermediate", "advanced", "professional"]);

type ProfilePayload = {
  displayName?: unknown;
  onboardingCompleted?: unknown;
  riskExperienceLevel?: unknown;
  timezone?: unknown;
};

type ProfileRow = QueryResultRow & {
  id: string;
  email: string;
  display_name: string | null;
  email_verified: boolean;
  state: string;
  profile_image_url: string | null;
  timezone: string | null;
  risk_experience_level: string | null;
  onboarding_completed: boolean;
  created_at: string;
  last_login_at: string | null;
};

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ authenticated: false, error: "Sign in to view your profile." }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, profile: user });
}

export async function PUT(request: Request) {
  const rateLimited = rateLimitRequest(request, "profile:write", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ authenticated: false, error: "Sign in to update your profile." }, { status: 401 });
  }

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = (await request.json().catch(() => null)) as ProfilePayload | null;
  const displayName = cleanText(payload?.displayName, 120);
  const timezone = cleanText(payload?.timezone, 80);
  const riskExperienceLevel = normalizeRiskLevel(payload?.riskExperienceLevel);
  const onboardingCompleted = typeof payload?.onboardingCompleted === "boolean" ? payload.onboardingCompleted : user.onboardingCompleted;

  try {
    const result = await dbQuery<ProfileRow>(
      `
        UPDATE users
        SET
          display_name = $2,
          timezone = $3,
          risk_experience_level = $4,
          onboarding_completed = $5,
          updated_at = now()
        WHERE id = $1
        RETURNING
          id::text,
          email,
          display_name,
          email_verified,
          state,
          profile_image_url,
          timezone,
          risk_experience_level,
          onboarding_completed,
          created_at::text,
          last_login_at::text
      `,
      [user.id, displayName, timezone, riskExperienceLevel, onboardingCompleted],
    );
    return NextResponse.json({ authenticated: true, profile: userFromRow(result.rows[0]) });
  } catch (error) {
    console.warn("[profile] update failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ authenticated: true, error: "Unable to update profile." }, { status: 400 });
  }
}

function cleanText(value: unknown, maxLength: number): string | null {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeRiskLevel(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  return RISK_LEVELS.has(text) ? text : null;
}
