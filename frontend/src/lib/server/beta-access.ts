import "server-only";

import { betaSignupDecision, parseAllowedBetaEmails, parseBetaSignupMode, type BetaSignupDecision } from "@/lib/security/beta-access";

export function betaSignupDecisionForRequest(input: { email: string | null; inviteCode?: unknown }): BetaSignupDecision {
  return betaSignupDecision(
    { email: input.email, inviteCode: typeof input.inviteCode === "string" ? input.inviteCode : null },
    {
      allowedEmails: parseAllowedBetaEmails(process.env.TRADEVETO_BETA_ALLOWED_EMAILS),
      inviteCode: process.env.TRADEVETO_BETA_INVITE_CODE?.trim() || null,
      mode: parseBetaSignupMode(process.env.TRADEVETO_BETA_SIGNUP_MODE),
    },
  );
}
