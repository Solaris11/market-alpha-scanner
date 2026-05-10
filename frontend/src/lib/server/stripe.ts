import "server-only";

import Stripe from "stripe";
import { parseBooleanFlag, parseTrialDays } from "@/lib/security/beta-billing";
import { STRIPE_LIVE_MODE, STRIPE_TEST_MODE, stripeTestEmailAllowed, type StripeMode } from "@/lib/security/stripe-mode";
import type { AuthUser } from "./auth";
import { canonicalAppUrl } from "./request-security";

const stripeClients: Partial<Record<StripeMode, Stripe>> = {};

export type StripeBillingConfig = {
  appBaseUrl: string;
  mode: StripeMode;
  priceId: string;
  webhookSecret: string;
};

export function stripe(mode: StripeMode = STRIPE_LIVE_MODE): Stripe {
  const secretKey = stripeSecretKey(mode);
  if (!stripeClients[mode]) {
    stripeClients[mode] = new Stripe(secretKey);
  }
  return stripeClients[mode];
}

export function stripeBillingConfig(mode: StripeMode = STRIPE_LIVE_MODE): StripeBillingConfig {
  return {
    appBaseUrl: appBaseUrl(),
    mode,
    priceId: stripePriceId(mode),
    webhookSecret: stripeWebhookSecret(mode),
  };
}

export function stripePriceId(mode: StripeMode = STRIPE_LIVE_MODE): string {
  if (mode === STRIPE_TEST_MODE) return requiredEnv("STRIPE_TEST_PRICE_ID");
  return requiredEnv("STRIPE_PRICE_ID");
}

export function stripeAppBaseUrl(): string {
  return appBaseUrl();
}

export function stripeWebhookSecret(mode: StripeMode = STRIPE_LIVE_MODE): string {
  if (mode === STRIPE_TEST_MODE) return requiredEnv("STRIPE_TEST_WEBHOOK_SECRET");
  return requiredEnv("STRIPE_WEBHOOK_SECRET");
}

export function stripeBetaTrialDays(mode: StripeMode = STRIPE_LIVE_MODE): number | null {
  if (mode === STRIPE_TEST_MODE) return parseTrialDays(process.env.STRIPE_TEST_BETA_TRIAL_DAYS) ?? parseTrialDays(process.env.STRIPE_BETA_TRIAL_DAYS);
  return parseTrialDays(process.env.STRIPE_BETA_TRIAL_DAYS);
}

export function stripePromotionCodesEnabled(mode: StripeMode = STRIPE_LIVE_MODE): boolean {
  if (mode === STRIPE_TEST_MODE) return parseBooleanFlag(process.env.STRIPE_TEST_ALLOW_PROMOTION_CODES) || parseBooleanFlag(process.env.STRIPE_ALLOW_PROMOTION_CODES);
  return parseBooleanFlag(process.env.STRIPE_ALLOW_PROMOTION_CODES);
}

export function stripeTestModeEnabled(): boolean {
  return parseBooleanFlag(process.env.TRADEVETO_ENABLE_STRIPE_TEST_MODE);
}

export function stripeTestModeAllowedForUser(user: Pick<AuthUser, "email">): boolean {
  return stripeTestModeEnabled() && stripeTestEmailAllowed(user.email, process.env.TRADEVETO_STRIPE_TEST_ALLOWED_EMAILS);
}

export function stripeTestModeDeniedMessage(user: Pick<AuthUser, "email"> | null): string {
  if (!stripeTestModeEnabled()) return "Stripe test mode is disabled.";
  if (!user || !stripeTestEmailAllowed(user.email, process.env.TRADEVETO_STRIPE_TEST_ALLOWED_EMAILS)) return "Stripe test mode is restricted to allowlisted QA accounts.";
  return "Stripe test mode is unavailable.";
}

function appBaseUrl(): string {
  const raw = process.env.TRADEVETO_APP_BASE_URL?.trim() || process.env.APP_BASE_URL?.trim() || canonicalAppUrl().toString();
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

function stripeSecretKey(mode: StripeMode): string {
  if (mode === STRIPE_TEST_MODE) return requiredEnv("STRIPE_TEST_SECRET_KEY");
  return requiredEnv("STRIPE_SECRET_KEY");
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}
