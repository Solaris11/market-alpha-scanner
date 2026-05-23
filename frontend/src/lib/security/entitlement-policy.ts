import { normalizeBetaEmail, parseAllowedBetaEmails, parseBetaSignupMode } from "./beta-access";

export type SubscriptionRecord = {
  currentPeriodEnd: Date | string | null;
  plan: string | null;
  status: string | null;
};

export type BetaPremiumAccessSource = "allowlist" | "closed_beta" | "invite_beta";

export type BetaPremiumAccess = {
  active: boolean;
  label: string | null;
  source: BetaPremiumAccessSource | null;
};

export function subscriptionGrantsPremium(subscription: SubscriptionRecord | null | undefined, now = new Date()): boolean {
  if (!subscription) return false;
  if (!isPremiumPlan(subscription.plan)) return false;
  if (!isActiveSubscriptionStatus(subscription.status)) return false;
  if (!subscription.currentPeriodEnd) return false;

  const expiresAt = subscription.currentPeriodEnd instanceof Date ? subscription.currentPeriodEnd : new Date(subscription.currentPeriodEnd);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

export function betaPremiumAccessForEmail(email: string, env: NodeJS.ProcessEnv = process.env): BetaPremiumAccess {
  const normalized = normalizeBetaEmail(email);
  if (!normalized || betaPremiumDisabled(env)) return inactiveBetaPremiumAccess();

  const allowedEmails = parseAllowedBetaEmails(env.TRADEVETO_BETA_ALLOWED_EMAILS);
  if (allowedEmails.includes(normalized)) return activeBetaPremiumAccess("allowlist");

  const mode = parseBetaSignupMode(env.TRADEVETO_BETA_SIGNUP_MODE);
  const explicitBetaPremium = betaPremiumExplicitlyEnabled(env);
  if (mode === "invite" && (explicitBetaPremium || Boolean(env.TRADEVETO_BETA_INVITE_CODE?.trim()))) {
    return activeBetaPremiumAccess("invite_beta");
  }

  if (mode === "closed" && explicitBetaPremium) {
    return activeBetaPremiumAccess("closed_beta");
  }

  return inactiveBetaPremiumAccess();
}

export function betaPremiumAccessEnabled(email: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return betaPremiumAccessForEmail(email, env).active;
}

export function productionMockPremiumEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && (env.TRADEVETO_MOCK_PREMIUM === "true" || env.MARKET_ALPHA_MOCK_PREMIUM === "true");
}

export function devConfigPremiumEnabled(email: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (env.TRADEVETO_MOCK_PREMIUM === "true" || env.MARKET_ALPHA_MOCK_PREMIUM === "true") return true;
  return premiumEmailSet(env).has(normalized);
}

function isActiveSubscriptionStatus(status: string | null): boolean {
  const normalized = String(status ?? "").trim().toLowerCase();
  return normalized === "active" || normalized === "trialing";
}

function isPremiumPlan(plan: string | null): boolean {
  return String(plan ?? "").trim().toLowerCase() === "premium";
}

function activeBetaPremiumAccess(source: BetaPremiumAccessSource): BetaPremiumAccess {
  return {
    active: true,
    label: source === "allowlist" ? "Founding Member" : "Founding Early Access",
    source,
  };
}

function inactiveBetaPremiumAccess(): BetaPremiumAccess {
  return {
    active: false,
    label: null,
    source: null,
  };
}

function betaPremiumDisabled(env: NodeJS.ProcessEnv): boolean {
  const value = String(env.TRADEVETO_BETA_PREMIUM_ACCESS ?? "").trim().toLowerCase();
  return value === "false" || value === "0" || value === "off" || value === "disabled";
}

function betaPremiumExplicitlyEnabled(env: NodeJS.ProcessEnv): boolean {
  const value = String(env.TRADEVETO_BETA_PREMIUM_ACCESS ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "on" || value === "enabled";
}

function premiumEmailSet(env: NodeJS.ProcessEnv): Set<string> {
  return new Set(
    `${env.TRADEVETO_DEV_PREMIUM_EMAILS ?? ""},${env.TRADEVETO_PREMIUM_EMAILS ?? ""},${env.TRADEVETO_MOCK_PREMIUM_EMAILS ?? ""},${env.MARKET_ALPHA_DEV_PREMIUM_EMAILS ?? ""},${env.MARKET_ALPHA_PREMIUM_EMAILS ?? ""},${env.MARKET_ALPHA_MOCK_PREMIUM_EMAILS ?? ""}`
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
