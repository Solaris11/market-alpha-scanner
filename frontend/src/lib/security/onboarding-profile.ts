export const RISK_EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export type RiskExperienceLevel = (typeof RISK_EXPERIENCE_LEVELS)[number];

export type OnboardingProfile = {
  onboardingCompleted?: boolean | null;
  riskExperienceLevel?: string | null;
  timezone?: string | null;
};

const RISK_LABELS: Record<RiskExperienceLevel, string> = {
  advanced: "Advanced",
  beginner: "Beginner",
  intermediate: "Intermediate",
};

export function normalizeRiskExperienceLevel(value: unknown): RiskExperienceLevel | null {
  const text = String(value ?? "").trim().toLowerCase();
  return isRiskExperienceLevel(text) ? text : null;
}

export function normalizeTimezone(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || text.length > 80) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: text }).format(new Date(0));
    return text;
  } catch {
    return null;
  }
}

export function hasRequiredOnboardingFields(profile: OnboardingProfile): boolean {
  return Boolean(normalizeTimezone(profile.timezone) && normalizeRiskExperienceLevel(profile.riskExperienceLevel));
}

export function requiresAccountOnboarding(profile: OnboardingProfile | null | undefined): boolean {
  if (!profile) return false;
  return !profile.onboardingCompleted || !hasRequiredOnboardingFields(profile);
}

export function formatRiskExperienceLevel(value: string | null): string {
  const normalized = normalizeRiskExperienceLevel(value);
  return normalized ? RISK_LABELS[normalized] : "Required";
}

function isRiskExperienceLevel(value: string): value is RiskExperienceLevel {
  return RISK_EXPERIENCE_LEVELS.some((level) => level === value);
}
