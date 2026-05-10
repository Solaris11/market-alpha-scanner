export type StripeMode = "live" | "test";

export const STRIPE_LIVE_MODE: StripeMode = "live";
export const STRIPE_TEST_MODE: StripeMode = "test";

export function isStripeMode(value: string | null | undefined): value is StripeMode {
  return value === STRIPE_LIVE_MODE || value === STRIPE_TEST_MODE;
}

export function normalizeStripeMode(value: string | null | undefined): StripeMode {
  return value === STRIPE_TEST_MODE ? STRIPE_TEST_MODE : STRIPE_LIVE_MODE;
}

export function scopedStripeEventId(mode: StripeMode, eventId: string): string {
  const cleanEventId = eventId.trim();
  return mode === STRIPE_TEST_MODE ? `${STRIPE_TEST_MODE}:${cleanEventId}` : cleanEventId;
}

export function stripeModeLabel(mode: StripeMode): string {
  return mode === STRIPE_TEST_MODE ? "Stripe test mode" : "Stripe live mode";
}

export function parseStripeTestAllowedEmails(raw: string | null | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,\n]/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function stripeTestEmailAllowed(email: string | null | undefined, rawAllowlist: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  const allowed = parseStripeTestAllowedEmails(rawAllowlist);
  return allowed.has(normalized);
}

