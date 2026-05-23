export type OversizedRequestResult =
  | {
      maxBytes: number;
      ok: true;
    }
  | {
      contentLength: number;
      maxBytes: number;
      ok: false;
    };

export const REQUEST_BODY_LIMITS = {
  analyticsEvents: 64 * 1024,
  developerMutation: 24 * 1024,
  notificationFeedback: 8 * 1024,
  researchCopilot: 48 * 1024,
  supportMessage: 32 * 1024,
} as const;

export function evaluateContentLength(value: string | null | undefined, maxBytes: number): OversizedRequestResult {
  const safeMax = Math.max(1, Math.trunc(maxBytes));
  const contentLength = parseContentLength(value);
  if (contentLength === null || contentLength <= safeMax) {
    return { maxBytes: safeMax, ok: true };
  }
  return { contentLength, maxBytes: safeMax, ok: false };
}

function parseContentLength(value: string | null | undefined): number | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
