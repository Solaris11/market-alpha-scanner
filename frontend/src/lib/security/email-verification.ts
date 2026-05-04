import { createHash } from "node:crypto";

export type EmailVerificationTokenState = {
  expiresAt: Date | string | null;
  usedAt: Date | string | null;
};

export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function emailVerificationTokenIsUsable(token: EmailVerificationTokenState, now = new Date()): boolean {
  if (token.usedAt !== null) return false;
  if (!token.expiresAt) return false;
  const expiresAt = token.expiresAt instanceof Date ? token.expiresAt : new Date(token.expiresAt);
  return Number.isFinite(expiresAt.getTime()) && expiresAt > now;
}
