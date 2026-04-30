import "server-only";

type AttemptBucket = {
  count: number;
  resetAt: number;
};

const bucketsRoot = globalThis as typeof globalThis & {
  __marketAlphaRateLimitBuckets?: Map<string, AttemptBucket>;
};

const buckets = bucketsRoot.__marketAlphaRateLimitBuckets ?? new Map<string, AttemptBucket>();
bucketsRoot.__marketAlphaRateLimitBuckets = buckets;

export function tooManyAttempts(key: string, options: { limit: number; windowMs: number }): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return false;
  }

  current.count += 1;
  return current.count > options.limit;
}
