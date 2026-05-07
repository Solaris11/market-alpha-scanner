export type BetaBillingConfig = {
  allowPromotionCodes: boolean;
  trialDays: number | null;
};

export function parseTrialDays(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > 30) return null;
  return parsed;
}

export function parseBooleanFlag(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function betaBillingCopy(config: BetaBillingConfig): string {
  const parts = [];
  if (config.trialDays) parts.push(`${config.trialDays}-day trial`);
  if (config.allowPromotionCodes) parts.push("Stripe promo codes");
  if (!parts.length) return "Closed beta billing uses the standard monthly Premium checkout.";
  return `Closed beta checkout supports ${parts.join(" and ")}. Stripe shows the final renewal price before confirmation.`;
}
