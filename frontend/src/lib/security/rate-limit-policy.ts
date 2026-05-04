import { createHash } from "node:crypto";

export type PublicRateLimitPayload = {
  error: "rate_limited";
  retryAfter: number;
};

export function rateLimitPayload(retryAfter: number): PublicRateLimitPayload {
  return {
    error: "rate_limited",
    retryAfter: Math.max(1, Math.ceil(retryAfter)),
  };
}

export function hashRateLimitKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
