export const EMAIL_MAX_ATTEMPTS = 3;
export const EMAIL_RETRY_BACKOFF_MS = [1000, 5000, 30000] as const;

export function emailRetryDelayMs(failedAttempt: number): number {
  if (!Number.isFinite(failedAttempt) || failedAttempt <= 0) return EMAIL_RETRY_BACKOFF_MS[0];
  return EMAIL_RETRY_BACKOFF_MS[Math.min(failedAttempt - 1, EMAIL_RETRY_BACKOFF_MS.length - 1)];
}

export function shouldRetryEmailSend(failedAttempt: number): boolean {
  return failedAttempt < EMAIL_MAX_ATTEMPTS;
}
