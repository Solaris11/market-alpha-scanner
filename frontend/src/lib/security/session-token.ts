import { createHmac } from "node:crypto";

const DEV_SESSION_SECRET = "market-alpha-development-session-secret-change-in-production";

export function hashSessionToken(token: string, secret = sessionHashSecret()): string {
  const cleaned = token.trim();
  if (!cleaned) throw new Error("Session token is required.");
  return createHmac("sha256", secret).update(cleaned).digest("hex");
}

export function sessionHashSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = [
    env.MARKET_ALPHA_SESSION_SECRET,
    env.AUTH_SECRET,
    env.NEXTAUTH_SECRET,
    env.SESSION_SECRET,
  ].find((value) => Boolean(value?.trim()))?.trim();

  if (secret) return secret;
  if (env.NODE_ENV === "production") {
    throw new Error("Session secret is not configured.");
  }
  return DEV_SESSION_SECRET;
}
