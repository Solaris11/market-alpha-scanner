export type BetaSignupMode = "closed" | "invite" | "open";

export type BetaSignupConfig = {
  allowedEmails: string[];
  inviteCode: string | null;
  mode: BetaSignupMode;
};

export type BetaSignupDecision = {
  allowed: boolean;
  message: string | null;
  reason: "allowed_email" | "closed" | "cohort_full" | "existing_user" | "invite_code" | "invite_required" | "open";
};

export function betaSignupDecision(input: { email: string | null; inviteCode?: string | null }, config: BetaSignupConfig): BetaSignupDecision {
  const email = normalizeBetaEmail(input.email);
  if (email && config.allowedEmails.includes(email)) {
    return { allowed: true, message: null, reason: "allowed_email" };
  }

  if (config.mode === "open") {
    return { allowed: true, message: null, reason: "open" };
  }

  if (config.mode === "invite") {
    const configuredCode = config.inviteCode?.trim();
    const submittedCode = String(input.inviteCode ?? "").trim();
    if (configuredCode && submittedCode && configuredCode === submittedCode) {
      return { allowed: true, message: null, reason: "invite_code" };
    }
    return {
      allowed: false,
      message: "Early access signup currently requires an invite code. Existing users can still sign in.",
      reason: "invite_required",
    };
  }

  return {
    allowed: false,
    message: "Early access signup is currently paused. Existing users can still sign in.",
    reason: "closed",
  };
}

export function parseBetaSignupMode(value: unknown): BetaSignupMode {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "closed" || normalized === "invite" || normalized === "open") return normalized;
  return "open";
}

export function parseAllowedBetaEmails(value: unknown): string[] {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((item) => normalizeBetaEmail(item))
    .filter((item): item is string => Boolean(item));
}

export function parseBetaUserCap(value: unknown, fallback = 25): number {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const cap = Number.parseInt(raw, 10);
  if (!Number.isFinite(cap) || cap < 0) return fallback;
  return cap;
}

export function applyBetaUserCap(decision: BetaSignupDecision, input: { cap: number; currentUsers: number }): BetaSignupDecision {
  if (!decision.allowed) return decision;
  if (input.cap <= 0) return decision;
  if (decision.reason === "allowed_email" || decision.reason === "existing_user") return decision;
  if (input.currentUsers < input.cap) return decision;
  return {
    allowed: false,
    message: `The ${input.cap}-member early-access cohort is currently full. Existing users can still sign in.`,
    reason: "cohort_full",
  };
}

export function normalizeBetaEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
