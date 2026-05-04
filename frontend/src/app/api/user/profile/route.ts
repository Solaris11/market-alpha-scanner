import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { getCurrentUser, userFromRow } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { hasRequiredOnboardingFields, normalizeRiskExperienceLevel, normalizeTimezone } from "@/lib/security/onboarding-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProfilePayload = {
  displayName?: unknown;
  onboardingCompleted?: unknown;
  riskExperience?: unknown;
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
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ authenticated: true, error: "Invalid profile update." }, { status: 400 });
  }

  const displayName = hasField(payload, "displayName") ? cleanText(payload.displayName, 120) : user.displayName;
  const timezone = hasField(payload, "timezone") ? normalizeTimezone(payload.timezone) : user.timezone;
  if (hasField(payload, "timezone") && !timezone) {
    return NextResponse.json({ authenticated: true, error: "Select a valid timezone." }, { status: 400 });
  }

  const hasRiskExperience = hasField(payload, "riskExperienceLevel") || hasField(payload, "riskExperience");
  const riskValue = hasField(payload, "riskExperienceLevel") ? payload.riskExperienceLevel : payload.riskExperience;
  const riskExperienceLevel = hasRiskExperience ? normalizeRiskExperienceLevel(riskValue) : user.riskExperienceLevel;
  if (hasRiskExperience && !riskExperienceLevel) {
    return NextResponse.json({ authenticated: true, error: "Select a valid risk experience level." }, { status: 400 });
  }

  const requestedOnboardingCompleted = typeof payload.onboardingCompleted === "boolean" ? payload.onboardingCompleted : user.onboardingCompleted;
  const onboardingCompleted = requestedOnboardingCompleted && hasRequiredOnboardingFields({ riskExperienceLevel, timezone });

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

function hasField<T extends object>(payload: T, key: keyof ProfilePayload): boolean {
  return Object.prototype.hasOwnProperty.call(payload, key);
}
