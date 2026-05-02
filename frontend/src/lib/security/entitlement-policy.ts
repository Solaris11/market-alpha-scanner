export type SubscriptionRecord = {
  currentPeriodEnd: Date | string | null;
  plan: string | null;
  status: string | null;
};

export function subscriptionGrantsPremium(subscription: SubscriptionRecord | null | undefined, now = new Date()): boolean {
  if (!subscription) return false;
  if (!isPremiumPlan(subscription.plan)) return false;
  if (!isActiveSubscriptionStatus(subscription.status)) return false;
  if (!subscription.currentPeriodEnd) return false;

  const expiresAt = subscription.currentPeriodEnd instanceof Date ? subscription.currentPeriodEnd : new Date(subscription.currentPeriodEnd);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

export function productionMockPremiumEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && env.MARKET_ALPHA_MOCK_PREMIUM === "true";
}

export function devConfigPremiumEnabled(email: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (env.MARKET_ALPHA_MOCK_PREMIUM === "true") return true;
  return premiumEmailSet(env).has(normalized);
}

function isActiveSubscriptionStatus(status: string | null): boolean {
  const normalized = String(status ?? "").trim().toLowerCase();
  return normalized === "active" || normalized === "trialing";
}

function isPremiumPlan(plan: string | null): boolean {
  return String(plan ?? "").trim().toLowerCase() === "premium";
}

function premiumEmailSet(env: NodeJS.ProcessEnv): Set<string> {
  return new Set(
    `${env.MARKET_ALPHA_DEV_PREMIUM_EMAILS ?? ""},${env.MARKET_ALPHA_PREMIUM_EMAILS ?? ""},${env.MARKET_ALPHA_MOCK_PREMIUM_EMAILS ?? ""}`
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
