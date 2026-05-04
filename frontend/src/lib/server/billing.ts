import "server-only";

import type Stripe from "stripe";
import type { QueryResultRow } from "pg";
import type { AuthUser } from "./auth";
import { dbQuery } from "./db";
import { createNotification } from "./notifications";
import { stripe } from "./stripe";

export type BillingSubscription = {
  currentPeriodEnd: string | null;
  plan: string | null;
  status: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  userId: string;
};

export type StripeSyncResult = {
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  userId: string | null;
};

type BillingSubscriptionRow = QueryResultRow & {
  current_period_end: string | Date | null;
  plan: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  user_id: string;
};

type UserIdRow = QueryResultRow & {
  user_id: string;
};

type BillingEventExistsRow = QueryResultRow & {
  exists: boolean;
};

const PREMIUM_PLAN = "premium";
const INACTIVE_STATUS = "inactive";

export async function getBillingSubscriptionForUser(userId: string): Promise<BillingSubscription | null> {
  const result = await dbQuery<BillingSubscriptionRow>(
    `
      SELECT user_id::text, status, plan, current_period_end::text, stripe_customer_id, stripe_subscription_id
      FROM user_subscriptions
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  return subscriptionFromRow(result.rows[0]);
}

export async function getOrCreateStripeCustomerForUser(user: AuthUser): Promise<string> {
  const existing = await getBillingSubscriptionForUser(user.id);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await stripe().customers.create({
    email: user.email,
    metadata: {
      user_id: user.id,
    },
    name: user.displayName ?? undefined,
  });

  await upsertCustomerReference(user.id, customer.id);
  return customer.id;
}

export async function upsertCustomerReference(userId: string, stripeCustomerId: string, stripeSubscriptionId?: string | null): Promise<void> {
  await dbQuery(
    `
      INSERT INTO user_subscriptions (
        user_id,
        status,
        plan,
        current_period_end,
        stripe_customer_id,
        stripe_subscription_id,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 'free', NULL, $3, $4, now(), now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, user_subscriptions.stripe_customer_id),
        stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, user_subscriptions.stripe_subscription_id),
        updated_at = now()
    `,
    [userId, INACTIVE_STATUS, stripeCustomerId, stripeSubscriptionId ?? null],
  );
}

export async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription, userIdHint?: string | null): Promise<StripeSyncResult> {
  const stripeCustomerId = stripeObjectId(subscription.customer);
  const stripeSubscriptionId = subscription.id;
  const userId = userIdHint || metadataUserId(subscription.metadata) || (await findUserIdForStripeSubscription(stripeCustomerId, stripeSubscriptionId));

  if (!userId) {
    console.warn("[stripe] subscription event could not be mapped to a user.");
    return {
      status: subscription.status,
      stripeCustomerId,
      stripeSubscriptionId,
      userId: null,
    };
  }

  await dbQuery(
    `
      INSERT INTO user_subscriptions (
        user_id,
        status,
        plan,
        current_period_end,
        stripe_customer_id,
        stripe_subscription_id,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, now(), now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        plan = EXCLUDED.plan,
        current_period_end = EXCLUDED.current_period_end,
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, user_subscriptions.stripe_customer_id),
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        updated_at = now()
    `,
    [userId, subscription.status, PREMIUM_PLAN, periodEndDate(subscription), stripeCustomerId, stripeSubscriptionId],
  );

  return {
    status: subscription.status,
    stripeCustomerId,
    stripeSubscriptionId,
    userId,
  };
}

export async function updateSubscriptionStatusByCustomer(stripeCustomerId: string, status: string): Promise<string | null> {
  const result = await dbQuery<UserIdRow>(
    `
      UPDATE user_subscriptions
      SET status = $2,
          plan = $3,
          updated_at = now()
      WHERE stripe_customer_id = $1
      RETURNING user_id::text
    `,
    [stripeCustomerId, status, PREMIUM_PLAN],
  );
  return result.rows[0]?.user_id ?? null;
}

export async function billingEventProcessed(stripeEventId: string): Promise<boolean> {
  const result = await dbQuery<BillingEventExistsRow>("SELECT EXISTS (SELECT 1 FROM billing_events WHERE stripe_event_id = $1) AS exists", [stripeEventId]);
  return Boolean(result.rows[0]?.exists);
}

export async function recordBillingEvent(args: {
  eventType: string;
  payloadSummary: Record<string, string | null>;
  stripeEventId: string;
  userId: string | null;
}): Promise<void> {
  await dbQuery(
    `
      INSERT INTO billing_events (user_id, event_type, stripe_event_id, payload_summary, created_at)
      VALUES ($1, $2, $3, $4::jsonb, now())
      ON CONFLICT (stripe_event_id) DO NOTHING
    `,
    [args.userId, args.eventType, args.stripeEventId, JSON.stringify(args.payloadSummary)],
  );
}

export async function notifySubscriptionActive(userId: string): Promise<void> {
  await safeCreateNotification(
    userId,
    "Your premium subscription is active",
    "Premium research features are available on this account.",
  );
}

export async function notifyPaymentFailed(userId: string): Promise<void> {
  await safeCreateNotification(
    userId,
    "Payment failed",
    "Update your billing details in the Stripe portal to keep premium access active.",
  );
}

export async function notifySubscriptionCanceled(userId: string): Promise<void> {
  await safeCreateNotification(
    userId,
    "Subscription canceled",
    "Your premium access will end when the current billing period is no longer active.",
  );
}

export async function retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe().subscriptions.retrieve(subscriptionId);
}

export function stripeObjectId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  const id = value?.id;
  return typeof id === "string" && id ? id : null;
}

export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (parent?.type === "subscription_details") {
    return stripeObjectId(parent.subscription_details?.subscription);
  }
  return null;
}

export function customerIdFromInvoice(invoice: Stripe.Invoice): string | null {
  return stripeObjectId(invoice.customer);
}

async function findUserIdForStripeSubscription(stripeCustomerId: string | null, stripeSubscriptionId: string | null): Promise<string | null> {
  const result = await dbQuery<UserIdRow>(
    `
      SELECT user_id::text
      FROM user_subscriptions
      WHERE ($1::text IS NOT NULL AND stripe_customer_id = $1)
         OR ($2::text IS NOT NULL AND stripe_subscription_id = $2)
      LIMIT 1
    `,
    [stripeCustomerId, stripeSubscriptionId],
  );
  return result.rows[0]?.user_id ?? null;
}

function subscriptionFromRow(row: BillingSubscriptionRow | undefined): BillingSubscription | null {
  if (!row) return null;
  return {
    currentPeriodEnd: row.current_period_end === null ? null : new Date(row.current_period_end).toISOString(),
    plan: row.plan,
    status: row.status,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    userId: row.user_id,
  };
}

function metadataUserId(metadata: Stripe.Metadata | null | undefined): string | null {
  const userId = metadata?.user_id;
  return typeof userId === "string" && userId ? userId : null;
}

function periodEndDate(subscription: Stripe.Subscription): Date | null {
  const itemPeriodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => Number.isFinite(value));
  const periodEnd = itemPeriodEnds.length ? Math.max(...itemPeriodEnds) : subscription.trial_end;
  return typeof periodEnd === "number" && Number.isFinite(periodEnd) ? new Date(periodEnd * 1000) : null;
}

async function safeCreateNotification(userId: string, title: string, message: string): Promise<void> {
  try {
    await createNotification(userId, "subscription", title, message);
  } catch (error) {
    console.warn("[notifications] billing notification failed", error instanceof Error ? error.message : error);
  }
}
