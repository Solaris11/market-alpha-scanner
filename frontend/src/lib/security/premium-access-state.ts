export type PremiumAccessState = "unauthenticated" | "authenticated_free" | "authenticated_premium";

export type PremiumAccessInput = {
  authenticated?: boolean | null;
  isAdmin?: boolean | null;
  isPremium?: boolean | null;
  plan?: string | null;
};

export function premiumAccessState(input: PremiumAccessInput): PremiumAccessState {
  if (!input.authenticated) return "unauthenticated";
  const plan = String(input.plan ?? "").trim().toLowerCase();
  if (input.isAdmin || input.isPremium || plan === "admin" || plan === "premium") return "authenticated_premium";
  return "authenticated_free";
}

export function premiumAccessCopy(state: PremiumAccessState): { helper: string; statusLabel: string | null } {
  if (state === "authenticated_premium") {
    return {
      helper: "Premium access is active. Full trade plans and scanner intelligence are available on this account.",
      statusLabel: "Premium active",
    };
  }

  if (state === "authenticated_free") {
    return {
      helper: "Upgrade your account to unlock full trade plans, ranked setups, alerts, simulations, and premium scanner intelligence.",
      statusLabel: null,
    };
  }

  return {
    helper: "Sign in to view your account and upgrade.",
    statusLabel: null,
  };
}
