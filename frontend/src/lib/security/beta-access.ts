export type BetaSignupMode = "closed" | "invite" | "open";

export type BetaSignupConfig = {
  allowedEmails: string[];
  inviteCode: string | null;
  mode: BetaSignupMode;
};

export type BetaSignupDecision = {
  allowed: boolean;
  message: string | null;
  reason: "allowed_email" | "closed" | "invite_code" | "invite_required" | "open";
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
      message: "Closed beta signup requires an invite code. Existing users can still sign in.",
      reason: "invite_required",
    };
  }

  return {
    allowed: false,
    message: "Closed beta signup is currently invite-only. Existing users can still sign in.",
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

function normalizeBetaEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
