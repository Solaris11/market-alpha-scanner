import "server-only";

import type { AuthUser } from "./auth";

export function isAdminUser(user: AuthUser | null): boolean {
  if (!user) return false;
  const adminEmails = new Set(
    String(process.env.MARKET_ALPHA_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  return adminEmails.has(user.email.toLowerCase());
}
