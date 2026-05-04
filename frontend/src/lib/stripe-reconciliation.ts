import type { QueryResultRow } from "pg";
import { subscriptionGrantsPremium } from "./security/entitlement-policy";
import { stripeSubscriptionAccessEnd, stripeSubscriptionCancelScheduled, type StripeSubscriptionLike } from "./security/stripe-subscription-state";

export type StripeSubscriptionForReconciliation = StripeSubscriptionLike & {
  canceled_at?: number | null;
  created?: number | null;
  customer?: string | { id?: string | null } | null;
  id: string;
  metadata?: Record<string, string> | null;
  status?: string | null;
};

export type RateLimitedDb = {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]): Promise<{ rows: Row[]; rowCount?: number | null }>;
};

export type ReconciliationCandidate = QueryResultRow & {
  canceled_at: Date | string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: Date | string | null;
  plan: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  user_id: string;
};

export type StripeSubscriptionFetcher = {
  listSubscriptionsByCustomer(customerId: string): Promise<StripeSubscriptionForReconciliation[]>;
  retrieveSubscription(subscriptionId: string): Promise<StripeSubscriptionForReconciliation>;
};

export type ReconciliationMismatch = {
  fields: string[];
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  userId: string;
};

export type ReconciliationResult = {
  checked: number;
  errors: number;
  mismatches: ReconciliationMismatch[];
  skipped: number;
  updated: number;
};

type ReconcileOptions = {
  db: RateLimitedDb;
  dryRun: boolean;
  logger?: Pick<Console, "error" | "log" | "warn">;
  stripe: StripeSubscriptionFetcher;
};

type StripeSyncFields = {
  canceledAt: Date | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  plan: "premium";
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export async function reconcileStripeSubscriptions(options: ReconcileOptions): Promise<ReconciliationResult> {
  const logger = options.logger ?? console;
  const candidates = await listReconciliationCandidates(options.db);
  const result: ReconciliationResult = { checked: 0, errors: 0, mismatches: [], skipped: 0, updated: 0 };

  for (const candidate of candidates) {
    result.checked += 1;
    let subscription: StripeSubscriptionForReconciliation | null = null;
    try {
      subscription = await fetchStripeSubscriptionForCandidate(candidate, options.stripe);
    } catch (error) {
      result.errors += 1;
      logger.warn(
        `[stripe:reconcile] lookup failed user=${redact(candidate.user_id)} customer=${redact(candidate.stripe_customer_id)} subscription=${redact(candidate.stripe_subscription_id)} message=${safeErrorMessage(error)}`,
      );
      continue;
    }

    if (!subscription) {
      result.skipped += 1;
      logger.warn(`[stripe:reconcile] no Stripe subscription found user=${redact(candidate.user_id)} customer=${redact(candidate.stripe_customer_id)}`);
      continue;
    }

    const syncFields = stripeSyncFields(subscription);
    const fields = changedFields(candidate, syncFields);
    if (fields.length === 0) {
      continue;
    }

    result.mismatches.push({
      fields,
      stripeCustomerId: syncFields.stripeCustomerId,
      stripeSubscriptionId: syncFields.stripeSubscriptionId,
      userId: candidate.user_id,
    });

    logger.log(
      `[stripe:reconcile] mismatch user=${redact(candidate.user_id)} subscription=${redact(syncFields.stripeSubscriptionId)} fields=${fields.join(",")} dryRun=${String(options.dryRun)}`,
    );

    if (!options.dryRun) {
      await updateSubscriptionFromStripe(options.db, candidate.user_id, syncFields);
      result.updated += 1;
    }
  }

  return result;
}

export function stripeSyncFields(subscription: StripeSubscriptionForReconciliation): StripeSyncFields {
  return {
    canceledAt: timestampDate(subscription.canceled_at),
    cancelAtPeriodEnd: stripeSubscriptionCancelScheduled(subscription),
    currentPeriodEnd: stripeSubscriptionAccessEnd(subscription),
    plan: "premium",
    status: String(subscription.status ?? "unknown"),
    stripeCustomerId: stripeObjectId(subscription.customer),
    stripeSubscriptionId: subscription.id,
  };
}

export function stripeSubscriptionStillGrantsPremium(subscription: StripeSubscriptionForReconciliation, now = new Date()): boolean {
  const fields = stripeSyncFields(subscription);
  return subscriptionGrantsPremium({ currentPeriodEnd: fields.currentPeriodEnd, plan: fields.plan, status: fields.status }, now);
}

export function redact(value: string | null | undefined): string {
  if (!value) return "none";
  if (value.length <= 10) return `${value.slice(0, 2)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function listReconciliationCandidates(db: RateLimitedDb): Promise<ReconciliationCandidate[]> {
  const result = await db.query<ReconciliationCandidate>(
    `
      SELECT
        user_id::text,
        status,
        plan,
        current_period_end,
        stripe_customer_id,
        stripe_subscription_id,
        cancel_at_period_end,
        canceled_at
      FROM user_subscriptions
      WHERE stripe_customer_id IS NOT NULL
         OR stripe_subscription_id IS NOT NULL
         OR status IN ('active', 'trialing')
         OR cancel_at_period_end = true
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    `,
  );
  return result.rows;
}

async function fetchStripeSubscriptionForCandidate(candidate: ReconciliationCandidate, stripeClient: StripeSubscriptionFetcher): Promise<StripeSubscriptionForReconciliation | null> {
  if (candidate.stripe_subscription_id) {
    return stripeClient.retrieveSubscription(candidate.stripe_subscription_id);
  }
  if (!candidate.stripe_customer_id) return null;
  const subscriptions = await stripeClient.listSubscriptionsByCustomer(candidate.stripe_customer_id);
  return chooseBestSubscription(subscriptions);
}

function chooseBestSubscription(subscriptions: StripeSubscriptionForReconciliation[]): StripeSubscriptionForReconciliation | null {
  if (subscriptions.length === 0) return null;
  return [...subscriptions].sort(compareSubscriptionsForReconciliation)[0] ?? null;
}

function compareSubscriptionsForReconciliation(a: StripeSubscriptionForReconciliation, b: StripeSubscriptionForReconciliation): number {
  const aActive = ACTIVE_STATUSES.has(String(a.status ?? ""));
  const bActive = ACTIVE_STATUSES.has(String(b.status ?? ""));
  if (aActive !== bActive) return aActive ? -1 : 1;
  const aEnd = stripeSubscriptionAccessEnd(a)?.getTime() ?? 0;
  const bEnd = stripeSubscriptionAccessEnd(b)?.getTime() ?? 0;
  if (aEnd !== bEnd) return bEnd - aEnd;
  return (b.created ?? 0) - (a.created ?? 0);
}

function changedFields(candidate: ReconciliationCandidate, syncFields: StripeSyncFields): string[] {
  const changes: string[] = [];
  if (normalize(candidate.status) !== normalize(syncFields.status)) changes.push("status");
  if (normalize(candidate.plan) !== syncFields.plan) changes.push("plan");
  if (dateIso(candidate.current_period_end) !== dateIso(syncFields.currentPeriodEnd)) changes.push("current_period_end");
  if (normalize(candidate.stripe_customer_id) !== normalize(syncFields.stripeCustomerId)) changes.push("stripe_customer_id");
  if (normalize(candidate.stripe_subscription_id) !== normalize(syncFields.stripeSubscriptionId)) changes.push("stripe_subscription_id");
  if (Boolean(candidate.cancel_at_period_end) !== syncFields.cancelAtPeriodEnd) changes.push("cancel_at_period_end");
  if (dateIso(candidate.canceled_at) !== dateIso(syncFields.canceledAt)) changes.push("canceled_at");
  return changes;
}

async function updateSubscriptionFromStripe(db: RateLimitedDb, userId: string, fields: StripeSyncFields): Promise<void> {
  await db.query(
    `
      UPDATE user_subscriptions
      SET status = $2,
          plan = $3,
          current_period_end = $4,
          stripe_customer_id = COALESCE($5, stripe_customer_id),
          stripe_subscription_id = $6,
          cancel_at_period_end = $7,
          canceled_at = $8,
          updated_at = now()
      WHERE user_id = $1
    `,
    [userId, fields.status, fields.plan, fields.currentPeriodEnd, fields.stripeCustomerId, fields.stripeSubscriptionId, fields.cancelAtPeriodEnd, fields.canceledAt],
  );
}

function stripeObjectId(value: string | { id?: string | null } | null | undefined): string | null {
  if (typeof value === "string") return value;
  const id = value?.id;
  return typeof id === "string" && id ? id : null;
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function dateIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function timestampDate(value: number | null | undefined): Date | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  return error.message.trim().replace(/\s+/g, " ").slice(0, 180);
}
