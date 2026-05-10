import "server-only";

import type { QueryResultRow } from "pg";
import {
  applyBetaUserCap,
  betaSignupDecision,
  normalizeBetaEmail,
  parseAllowedBetaEmails,
  parseBetaSignupMode,
  parseBetaUserCap,
  type BetaSignupDecision,
} from "@/lib/security/beta-access";
import { dbQuery } from "./db";

type ActiveUserCountRow = QueryResultRow & {
  count: string;
};

type ExistingUserRow = QueryResultRow & {
  id: string;
};

export async function betaSignupDecisionForRequest(input: { email: string | null; inviteCode?: unknown }): Promise<BetaSignupDecision> {
  const baseDecision = betaSignupDecision(
    { email: input.email, inviteCode: typeof input.inviteCode === "string" ? input.inviteCode : null },
    {
      allowedEmails: parseAllowedBetaEmails(process.env.TRADEVETO_BETA_ALLOWED_EMAILS),
      inviteCode: process.env.TRADEVETO_BETA_INVITE_CODE?.trim() || null,
      mode: parseBetaSignupMode(process.env.TRADEVETO_BETA_SIGNUP_MODE),
    },
  );
  if (!baseDecision.allowed || baseDecision.reason === "allowed_email") return baseDecision;

  const email = normalizeBetaEmail(input.email);
  if (email && (await activeUserExists(email))) {
    return { allowed: true, message: null, reason: "existing_user" };
  }

  return applyBetaUserCap(baseDecision, {
    cap: parseBetaUserCap(process.env.TRADEVETO_BETA_USER_CAP),
    currentUsers: await activeUserCount(),
  });
}

async function activeUserExists(email: string): Promise<boolean> {
  const result = await dbQuery<ExistingUserRow>("SELECT id::text FROM users WHERE email = $1 AND state = 'active' LIMIT 1", [email]);
  return Boolean(result.rows[0]);
}

async function activeUserCount(): Promise<number> {
  const result = await dbQuery<ActiveUserCountRow>("SELECT COUNT(*)::text AS count FROM users WHERE state = 'active'");
  return Number.parseInt(result.rows[0]?.count ?? "0", 10) || 0;
}
