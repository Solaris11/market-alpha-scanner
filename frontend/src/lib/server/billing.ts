import "server-only";

import type Stripe from "stripe";
import type { QueryResultRow } from "pg";
import {
  paymentFailedNotification,
  premiumActivatedNotification,
  premiumRenewalRestoredNotification,
  subscriptionCanceledNotification,
  type SubscriptionNotificationIntent,
} from "@/lib/security/subscription-notifications";
import { STRIPE_LIVE_MODE, STRIPE_TEST_MODE, scopedStripeEventId, stripeTestEmailAllowed, type StripeMode } from "@/lib/security/stripe-mode";
import { stripeSubscriptionAccessEnd, stripeSubscriptionCancelScheduled } from "@/lib/security/stripe-subscription-state";
import type { AuthUser } from "./auth";
import { dbQuery, type DbExecutor } from "./db";
import { createNotificationOnce, createNotificationWithAction } from "./notifications";
import { stripe } from "./stripe";

export type BillingSubscription = {
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  plan: string | null;
  stripeMode: StripeMode;
  status: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  userId: string;
};

export type StripeSyncResult = {
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  previousCancelAtPeriodEnd: boolean | null;
  staleEvent: boolean;
  status: string;
  stripeCustomerId: string | null;
  stripeMode: StripeMode;
  stripeSubscriptionId: string | null;
  userId: string | null;
};

type BillingSubscriptionRow = QueryResultRow & {
  canceled_at: string | Date | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | Date | null;
  plan: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_mode: string | null;
  stripe_subscription_id: string | null;
  user_id: string;
};

type UserEmailRow = QueryResultRow & {
  email: string;
};

type UserIdRow = QueryResultRow & {
  user_id: string;
};

type BillingEventExistsRow = QueryResultRow & {
  exists: boolean;
};

type StripeEventClaimRow = QueryResultRow & {
  id: string;
};

type SubscriptionSyncStateRow = QueryResultRow & {
  cancel_at_period_end: boolean | null;
  current_period_end: string | Date | null;
  plan: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_last_event_created_at: string | Date | null;
  stripe_mode: string | null;
  stripe_subscription_id: string | null;
};

type NotificationRow = QueryResultRow & {
  id: string;
};

const PREMIUM_PLAN = "premium";
const INACTIVE_STATUS = "inactive";
const defaultDb: DbExecutor = { query: dbQuery };

export async function getBillingSubscriptionForUser(userId: string, mode?: StripeMode): Promise<BillingSubscription | null> {
  const params: string[] = [userId];
  const modeClause = mode ? "AND stripe_mode = $2" : "";
  if (mode) params.push(mode);
  const result = await dbQuery<BillingSubscriptionRow>(
    `
      SELECT user_id::text, status, plan, current_period_end::text, stripe_customer_id, stripe_mode, stripe_subscription_id
      , cancel_at_period_end, canceled_at::text
      FROM user_subscriptions
      WHERE user_id = $1
      ${modeClause}
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
    `,
    params,
  );
  return subscriptionFromRow(result.rows[0]);
}

export async function getFreshBillingSubscriptionForUser(userId: string): Promise<BillingSubscription | null> {
  const subscription = await getBillingSubscriptionForUser(userId);
  if (!subscription?.stripeSubscriptionId) return subscription;

  try {
    const result = await upsertSubscriptionFromStripe(await retrieveSubscription(subscription.stripeSubscriptionId, subscription.stripeMode), userId, undefined, undefined, subscription.stripeMode);
    if (result.userId && statusGrantsPremium(result.status) && result.cancelAtPeriodEnd && result.previousCancelAtPeriodEnd !== true) {
      await notifySubscriptionCanceled(result.userId, result.currentPeriodEnd);
    }
    if (result.userId && result.previousCancelAtPeriodEnd === true && !result.cancelAtPeriodEnd && statusGrantsPremium(result.status)) {
      await notifyPremiumRenewalRestored(result.userId);
    }
    return getBillingSubscriptionForUser(userId);
  } catch (error) {
    console.warn("[stripe] account billing refresh failed", error instanceof Error ? error.message : error);
    return subscription;
  }
}

export async function getOrCreateStripeCustomerForUser(user: AuthUser, mode: StripeMode = STRIPE_LIVE_MODE): Promise<string> {
  const existing = await getBillingSubscriptionForUser(user.id);
  if (existing?.stripeCustomerId) {
    if (existing.stripeMode !== mode) {
      throw new Error(`Stripe customer exists in ${existing.stripeMode} mode; refusing to mix billing modes.`);
    }
    return existing.stripeCustomerId;
  }

  const customer = await stripe(mode).customers.create({
    email: user.email,
    metadata: {
      stripe_mode: mode,
      user_id: user.id,
    },
    name: user.displayName ?? undefined,
  });

  await upsertCustomerReference(user.id, customer.id, null, undefined, mode);
  return customer.id;
}

export async function upsertCustomerReference(userId: string, stripeCustomerId: string, stripeSubscriptionId?: string | null, db: DbExecutor = defaultDb, mode: StripeMode = STRIPE_LIVE_MODE): Promise<void> {
  if (!(await stripeModeAllowedForUserId(userId, mode, db))) {
    console.warn("[stripe] refusing to link test-mode customer to a non-allowlisted user.");
    return;
  }

  await db.query(
    `
      INSERT INTO user_subscriptions (
        user_id,
        status,
        plan,
        current_period_end,
        stripe_customer_id,
        stripe_mode,
        stripe_subscription_id,
        cancel_at_period_end,
        canceled_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 'free', NULL, $3, $4, $5, false, NULL, now(), now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        stripe_mode = EXCLUDED.stripe_mode,
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, user_subscriptions.stripe_customer_id),
        stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, user_subscriptions.stripe_subscription_id),
        updated_at = now()
    `,
    [userId, INACTIVE_STATUS, stripeCustomerId, mode, stripeSubscriptionId ?? null],
  );
}

export async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription, userIdHint?: string | null, db: DbExecutor = defaultDb, eventCreatedAt?: Date | null, mode: StripeMode = STRIPE_LIVE_MODE): Promise<StripeSyncResult> {
  const stripeCustomerId = stripeObjectId(subscription.customer);
  const stripeSubscriptionId = subscription.id;
  const userId = userIdHint || metadataUserId(subscription.metadata) || (await findUserIdForStripeSubscription(stripeCustomerId, stripeSubscriptionId, mode, db));
  const currentPeriodEnd = stripeSubscriptionAccessEnd(subscription);
  const canceledAt = timestampDate(subscription.canceled_at);
  const cancelAtPeriodEnd = stripeSubscriptionCancelScheduled(subscription);

  if (!userId) {
    console.warn("[stripe] subscription event could not be mapped to a user.");
    return {
      canceledAt: canceledAt?.toISOString() ?? null,
      cancelAtPeriodEnd,
      currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
      previousCancelAtPeriodEnd: null,
      staleEvent: false,
      status: subscription.status,
      stripeCustomerId,
      stripeMode: mode,
      stripeSubscriptionId,
      userId: null,
    };
  }

  if (!(await stripeModeAllowedForUserId(userId, mode, db))) {
    console.warn("[stripe] test-mode subscription event ignored for non-allowlisted user.");
    return {
      canceledAt: canceledAt?.toISOString() ?? null,
      cancelAtPeriodEnd,
      currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
      previousCancelAtPeriodEnd: null,
      staleEvent: false,
      status: "ignored_unauthorized_test_user",
      stripeCustomerId,
      stripeMode: mode,
      stripeSubscriptionId,
      userId: null,
    };
  }

  const previous = await currentSubscriptionSyncState(userId, db);
  if (previous?.stripe_mode && previous.stripe_mode !== mode) {
    console.warn("[stripe] subscription mode mismatch ignored.");
    return {
      canceledAt: canceledAt?.toISOString() ?? null,
      cancelAtPeriodEnd,
      currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
      previousCancelAtPeriodEnd: typeof previous.cancel_at_period_end === "boolean" ? previous.cancel_at_period_end : null,
      staleEvent: false,
      status: "ignored_mode_mismatch",
      stripeCustomerId,
      stripeMode: mode,
      stripeSubscriptionId,
      userId: null,
    };
  }
  const previousEventCreatedAt = previous?.stripe_last_event_created_at ? new Date(previous.stripe_last_event_created_at) : null;
  if (eventCreatedAt && previousEventCreatedAt && previousEventCreatedAt > eventCreatedAt) {
    return {
      canceledAt: null,
      cancelAtPeriodEnd: Boolean(previous?.cancel_at_period_end),
      currentPeriodEnd: previous?.current_period_end === null || previous?.current_period_end === undefined ? null : new Date(previous.current_period_end).toISOString(),
      previousCancelAtPeriodEnd: typeof previous?.cancel_at_period_end === "boolean" ? previous.cancel_at_period_end : null,
      staleEvent: true,
      status: previous?.status ?? subscription.status,
      stripeCustomerId: previous?.stripe_customer_id ?? stripeCustomerId,
      stripeMode: mode,
      stripeSubscriptionId: previous?.stripe_subscription_id ?? stripeSubscriptionId,
      userId,
    };
  }

  await db.query(
    `
      INSERT INTO user_subscriptions (
        user_id,
        status,
        plan,
        current_period_end,
        stripe_customer_id,
        stripe_mode,
        stripe_subscription_id,
        cancel_at_period_end,
        canceled_at,
        stripe_last_event_created_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        plan = EXCLUDED.plan,
        current_period_end = EXCLUDED.current_period_end,
        stripe_mode = EXCLUDED.stripe_mode,
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, user_subscriptions.stripe_customer_id),
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        canceled_at = EXCLUDED.canceled_at,
        stripe_last_event_created_at = COALESCE(EXCLUDED.stripe_last_event_created_at, user_subscriptions.stripe_last_event_created_at),
        updated_at = now()
    `,
    [userId, subscription.status, PREMIUM_PLAN, currentPeriodEnd, stripeCustomerId, mode, stripeSubscriptionId, cancelAtPeriodEnd, canceledAt, eventCreatedAt ?? null],
  );

  return {
    canceledAt: canceledAt?.toISOString() ?? null,
    cancelAtPeriodEnd,
    currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
    previousCancelAtPeriodEnd: typeof previous?.cancel_at_period_end === "boolean" ? previous.cancel_at_period_end : null,
    staleEvent: false,
    status: subscription.status,
    stripeCustomerId,
    stripeMode: mode,
    stripeSubscriptionId,
    userId,
  };
}

export async function updateSubscriptionStatusByCustomer(stripeCustomerId: string, status: string, db: DbExecutor = defaultDb, eventCreatedAt?: Date | null, mode: StripeMode = STRIPE_LIVE_MODE): Promise<string | null> {
  const existing = await db.query<SubscriptionSyncStateRow>(
    "SELECT stripe_last_event_created_at FROM user_subscriptions WHERE stripe_customer_id = $1 AND stripe_mode = $2 LIMIT 1",
    [stripeCustomerId, mode],
  );
  const previousEventCreatedAt = existing.rows[0]?.stripe_last_event_created_at ? new Date(existing.rows[0].stripe_last_event_created_at) : null;
  if (eventCreatedAt && previousEventCreatedAt && previousEventCreatedAt > eventCreatedAt) {
    return null;
  }

  const result = await db.query<UserIdRow>(
    `
      UPDATE user_subscriptions
      SET status = $2,
          plan = $3,
          cancel_at_period_end = false,
          stripe_last_event_created_at = COALESCE($4, stripe_last_event_created_at),
          updated_at = now()
      WHERE stripe_customer_id = $1
        AND stripe_mode = $5
      RETURNING user_id::text
    `,
    [stripeCustomerId, status, PREMIUM_PLAN, eventCreatedAt ?? null, mode],
  );
  return result.rows[0]?.user_id ?? null;
}

export async function billingEventProcessed(stripeEventId: string, mode: StripeMode = STRIPE_LIVE_MODE): Promise<boolean> {
  const result = await dbQuery<BillingEventExistsRow>("SELECT EXISTS (SELECT 1 FROM stripe_events WHERE id = $1) AS exists", [scopedStripeEventId(mode, stripeEventId)]);
  return Boolean(result.rows[0]?.exists);
}

export async function claimStripeEvent(stripeEventId: string, eventType: string, db: DbExecutor = defaultDb, mode: StripeMode = STRIPE_LIVE_MODE): Promise<boolean> {
  const result = await db.query<StripeEventClaimRow>(
    `
      INSERT INTO stripe_events (id, type, stripe_mode, created_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `,
    [scopedStripeEventId(mode, stripeEventId), eventType, mode],
  );
  return Boolean(result.rows[0]?.id);
}

export async function recordBillingEvent(args: {
  db?: DbExecutor;
  eventType: string;
  payloadSummary: Record<string, string | null>;
  stripeMode?: StripeMode;
  stripeEventId: string;
  userId: string | null;
}): Promise<void> {
  const db = args.db ?? defaultDb;
  const stripeMode = args.stripeMode ?? STRIPE_LIVE_MODE;
  await db.query(
    `
      INSERT INTO billing_events (user_id, event_type, stripe_event_id, stripe_mode, payload_summary, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
      ON CONFLICT (stripe_event_id) DO NOTHING
    `,
    [args.userId, args.eventType, scopedStripeEventId(stripeMode, args.stripeEventId), stripeMode, JSON.stringify(args.payloadSummary)],
  );
}

export async function notifySubscriptionActive(userId: string): Promise<void> {
  await safeCreateNotification(premiumActivatedNotification(), userId);
}

export async function notifyPaymentFailed(userId: string): Promise<void> {
  await safeCreateNotification(paymentFailedNotification(), userId);
}

export async function notifySubscriptionCanceled(userId: string, currentPeriodEnd: string | null): Promise<void> {
  await safeCreateNotification(subscriptionCanceledNotification(currentPeriodEnd), userId);
}

export async function notifyPremiumRenewalRestored(userId: string): Promise<void> {
  await safeCreateNotification(premiumRenewalRestoredNotification(), userId);
}

export async function createBillingNotificationForEvent(userId: string, intent: SubscriptionNotificationIntent, stripeEventId: string, db: DbExecutor = defaultDb): Promise<boolean> {
  if (!stripeEventId.trim()) return false;
  const title = cleanText(intent.title, 140);
  const message = cleanText(intent.message, 500);
  const actionUrl = cleanActionUrl(intent.actionUrl);
  if (intent.dedupe === "once") {
    const result = await db.query<NotificationRow>(
      `
        INSERT INTO notifications (user_id, type, title, message, read, action_url, stripe_event_id, created_at)
        SELECT $1, $2, $3, $4, false, $5, $6, now()
        WHERE NOT EXISTS (
          SELECT 1
          FROM notifications
          WHERE stripe_event_id = $6
        )
          AND NOT EXISTS (
            SELECT 1
            FROM notifications
            WHERE user_id = $1 AND type = $2 AND title = $3
          )
        RETURNING id::text
      `,
      [userId, intent.type, title, message, actionUrl, stripeEventId],
    );
    return Boolean(result.rows[0]?.id);
  }

  const result = await db.query<NotificationRow>(
    `
      INSERT INTO notifications (user_id, type, title, message, read, action_url, stripe_event_id, created_at)
      SELECT $1, $2, $3, $4, false, $5, $6, now()
      WHERE NOT EXISTS (
        SELECT 1
        FROM notifications
        WHERE stripe_event_id = $6
      )
      RETURNING id::text
    `,
    [userId, intent.type, title, message, actionUrl, stripeEventId],
  );
  return Boolean(result.rows[0]?.id);
}

export async function retrieveSubscription(subscriptionId: string, mode: StripeMode = STRIPE_LIVE_MODE): Promise<Stripe.Subscription> {
  return stripe(mode).subscriptions.retrieve(subscriptionId);
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

async function findUserIdForStripeSubscription(stripeCustomerId: string | null, stripeSubscriptionId: string | null, mode: StripeMode = STRIPE_LIVE_MODE, db: DbExecutor = defaultDb): Promise<string | null> {
  const result = await db.query<UserIdRow>(
    `
      SELECT user_id::text
      FROM user_subscriptions
      WHERE stripe_mode = $3
        AND (
          ($1::text IS NOT NULL AND stripe_customer_id = $1)
          OR ($2::text IS NOT NULL AND stripe_subscription_id = $2)
        )
      LIMIT 1
    `,
    [stripeCustomerId, stripeSubscriptionId, mode],
  );
  return result.rows[0]?.user_id ?? null;
}

function subscriptionFromRow(row: BillingSubscriptionRow | undefined): BillingSubscription | null {
  if (!row) return null;
  return {
    canceledAt: row.canceled_at === null ? null : new Date(row.canceled_at).toISOString(),
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    currentPeriodEnd: row.current_period_end === null ? null : new Date(row.current_period_end).toISOString(),
    plan: row.plan,
    stripeMode: row.stripe_mode === STRIPE_TEST_MODE ? STRIPE_TEST_MODE : STRIPE_LIVE_MODE,
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

function timestampDate(value: number | null | undefined): Date | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;
}

async function currentSubscriptionSyncState(userId: string, db: DbExecutor = defaultDb): Promise<SubscriptionSyncStateRow | null> {
  const result = await db.query<SubscriptionSyncStateRow>(
    `
      SELECT
        status,
        plan,
        current_period_end,
        stripe_customer_id,
        stripe_mode,
        stripe_subscription_id,
        cancel_at_period_end,
        stripe_last_event_created_at
      FROM user_subscriptions
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  return result.rows[0] ?? null;
}

async function stripeModeAllowedForUserId(userId: string, mode: StripeMode, db: DbExecutor): Promise<boolean> {
  if (mode !== STRIPE_TEST_MODE) return true;
  const result = await db.query<UserEmailRow>("SELECT email FROM users WHERE id = $1 LIMIT 1", [userId]);
  return stripeTestEmailAllowed(result.rows[0]?.email, process.env.TRADEVETO_STRIPE_TEST_ALLOWED_EMAILS);
}

function statusGrantsPremium(status: string): boolean {
  return status === "active" || status === "trialing";
}

async function safeCreateNotification(intent: SubscriptionNotificationIntent, userId: string): Promise<void> {
  try {
    if (intent.dedupe === "once") {
      await createNotificationOnce(userId, intent.type, intent.title, intent.message, intent.actionUrl);
      return;
    }
    await createNotificationWithAction(userId, intent.type, intent.title, intent.message, intent.actionUrl);
  } catch (error) {
    console.warn("[notifications] billing notification failed", error instanceof Error ? error.message : error);
  }
}

function cleanText(value: string, maxLength: number): string {
  const text = value.trim().replace(/\s+/g, " ");
  return text.slice(0, maxLength);
}

function cleanActionUrl(value: string | null): string | null {
  const text = value?.trim();
  if (!text || !text.startsWith("/") || text.startsWith("//") || text.length > 240) return null;
  return text;
}
