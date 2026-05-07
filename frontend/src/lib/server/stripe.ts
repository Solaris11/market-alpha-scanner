import "server-only";

import Stripe from "stripe";
import { parseBooleanFlag, parseTrialDays } from "@/lib/security/beta-billing";
import { canonicalAppUrl } from "./request-security";

let stripeClient: Stripe | null = null;

export type StripeBillingConfig = {
  appBaseUrl: string;
  priceId: string;
  webhookSecret: string;
};

export function stripe(): Stripe {
  const secretKey = requiredEnv("STRIPE_SECRET_KEY");
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

export function stripeBillingConfig(): StripeBillingConfig {
  return {
    appBaseUrl: appBaseUrl(),
    priceId: requiredEnv("STRIPE_PRICE_ID"),
    webhookSecret: requiredEnv("STRIPE_WEBHOOK_SECRET"),
  };
}

export function stripePriceId(): string {
  return requiredEnv("STRIPE_PRICE_ID");
}

export function stripeAppBaseUrl(): string {
  return appBaseUrl();
}

export function stripeWebhookSecret(): string {
  return requiredEnv("STRIPE_WEBHOOK_SECRET");
}

export function stripeBetaTrialDays(): number | null {
  return parseTrialDays(process.env.STRIPE_BETA_TRIAL_DAYS);
}

export function stripePromotionCodesEnabled(): boolean {
  return parseBooleanFlag(process.env.STRIPE_ALLOW_PROMOTION_CODES);
}

function appBaseUrl(): string {
  const raw = process.env.APP_BASE_URL?.trim() || canonicalAppUrl().toString();
  try {
    const parsed = new URL(raw);
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return canonicalAppUrl().toString().replace(/\/$/, "");
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}
