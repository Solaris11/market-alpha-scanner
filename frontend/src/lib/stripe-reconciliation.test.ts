import assert from "node:assert/strict";
import test from "node:test";
import { subscriptionGrantsPremium } from "./security/entitlement-policy";
import {
  reconcileStripeSubscriptions,
  stripeSyncFields,
  type RateLimitedDb,
  type ReconciliationCandidate,
  type StripeSubscriptionFetcher,
  type StripeSubscriptionForReconciliation,
} from "./stripe-reconciliation";

class FakeDb implements RateLimitedDb {
  public updates = 0;

  public constructor(public rows: ReconciliationCandidate[]) {}

  public async query<Row>(text: string, params: readonly unknown[] = []): Promise<{ rows: Row[]; rowCount: number }> {
    if (text.includes("FROM user_subscriptions")) {
      return { rows: this.rows as Row[], rowCount: this.rows.length };
    }
    if (text.includes("UPDATE user_subscriptions")) {
      const userId = String(params[0]);
      const row = this.rows.find((candidate) => candidate.user_id === userId);
      if (!row) return { rows: [], rowCount: 0 };
      row.status = String(params[1]);
      row.plan = String(params[2]);
      row.current_period_end = params[3] as Date | null;
      row.stripe_customer_id = (params[4] as string | null) ?? row.stripe_customer_id;
      row.stripe_subscription_id = params[5] as string;
      row.cancel_at_period_end = Boolean(params[6]);
      row.canceled_at = params[7] as Date | null;
      this.updates += 1;
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${text.slice(0, 40)}`);
  }
}

test("dry-run reports mismatches without mutating DB", async () => {
  const db = new FakeDb([candidate({ status: "inactive", stripe_subscription_id: "sub_active" })]);
  const result = await reconcileStripeSubscriptions({
    db,
    dryRun: true,
    logger: quietLogger(),
    stripe: fakeStripe({ sub_active: activeSubscription("sub_active") }),
  });

  assert.equal(result.checked, 1);
  assert.equal(result.updated, 0);
  assert.equal(result.mismatches.length, 1);
  assert.equal(db.updates, 0);
  assert.equal(db.rows[0]?.status, "inactive");
});

test("active subscription is reconciled to premium-granting state", async () => {
  const db = new FakeDb([candidate({ status: "inactive", stripe_subscription_id: "sub_active" })]);
  const result = await reconcileStripeSubscriptions({
    db,
    dryRun: false,
    logger: quietLogger(),
    stripe: fakeStripe({ sub_active: activeSubscription("sub_active") }),
  });

  assert.equal(result.updated, 1);
  assert.equal(db.rows[0]?.status, "active");
  assert.equal(db.rows[0]?.plan, "premium");
  assert.equal(subscriptionGrantsPremium({ currentPeriodEnd: db.rows[0]?.current_period_end ?? null, plan: db.rows[0]?.plan ?? null, status: db.rows[0]?.status ?? null }), true);
});

test("canceled-at-period-end stays premium until current period end", async () => {
  const subscription = activeSubscription("sub_canceling", { cancel_at_period_end: true });
  const fields = stripeSyncFields(subscription);

  assert.equal(fields.cancelAtPeriodEnd, true);
  assert.equal(subscriptionGrantsPremium({ currentPeriodEnd: fields.currentPeriodEnd, plan: fields.plan, status: fields.status }), true);
});

test("expired canceled subscription reconciles to non-premium state", async () => {
  const db = new FakeDb([candidate({ status: "active", stripe_subscription_id: "sub_canceled" })]);
  const result = await reconcileStripeSubscriptions({
    db,
    dryRun: false,
    logger: quietLogger(),
    stripe: fakeStripe({ sub_canceled: canceledSubscription("sub_canceled") }),
  });

  assert.equal(result.updated, 1);
  assert.equal(db.rows[0]?.status, "canceled");
  assert.equal(subscriptionGrantsPremium({ currentPeriodEnd: db.rows[0]?.current_period_end ?? null, plan: db.rows[0]?.plan ?? null, status: db.rows[0]?.status ?? null }), false);
});

test("Stripe fetch failure does not blindly revoke local state", async () => {
  const db = new FakeDb([candidate({ status: "active", stripe_subscription_id: "sub_missing" })]);
  const result = await reconcileStripeSubscriptions({
    db,
    dryRun: false,
    logger: quietLogger(),
    stripe: {
      listSubscriptionsByCustomer: async () => [],
      retrieveSubscription: async () => {
        throw new Error("Stripe unavailable");
      },
    },
  });

  assert.equal(result.errors, 1);
  assert.equal(result.updated, 0);
  assert.equal(db.rows[0]?.status, "active");
});

test("reconciliation is idempotent on repeated runs", async () => {
  const db = new FakeDb([candidate({ status: "inactive", stripe_subscription_id: "sub_active" })]);
  const stripe = fakeStripe({ sub_active: activeSubscription("sub_active") });

  const first = await reconcileStripeSubscriptions({ db, dryRun: false, logger: quietLogger(), stripe });
  const second = await reconcileStripeSubscriptions({ db, dryRun: false, logger: quietLogger(), stripe });

  assert.equal(first.updated, 1);
  assert.equal(second.updated, 0);
  assert.equal(db.updates, 1);
});

function candidate(overrides: Partial<ReconciliationCandidate> = {}): ReconciliationCandidate {
  return {
    canceled_at: null,
    cancel_at_period_end: false,
    current_period_end: null,
    plan: "free",
    status: "inactive",
    stripe_customer_id: "cus_test",
    stripe_subscription_id: "sub_test",
    user_id: "user_test",
    ...overrides,
  };
}

function activeSubscription(id: string, overrides: Partial<StripeSubscriptionForReconciliation> = {}): StripeSubscriptionForReconciliation {
  return {
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    created: 1_760_000_000,
    customer: "cus_test",
    id,
    items: {
      data: [{ current_period_end: 1_830_000_000 }],
    },
    metadata: { user_id: "user_test" },
    status: "active",
    trial_end: null,
    ...overrides,
  };
}

function canceledSubscription(id: string): StripeSubscriptionForReconciliation {
  return {
    ...activeSubscription(id),
    canceled_at: 1_760_000_000,
    items: {
      data: [{ current_period_end: 1_760_000_000 }],
    },
    status: "canceled",
  };
}

function fakeStripe(subscriptions: Record<string, StripeSubscriptionForReconciliation>): StripeSubscriptionFetcher {
  return {
    listSubscriptionsByCustomer: async () => Object.values(subscriptions),
    retrieveSubscription: async (subscriptionId: string) => {
      const subscription = subscriptions[subscriptionId];
      if (!subscription) throw new Error("missing subscription");
      return subscription;
    },
  };
}

function quietLogger(): Pick<Console, "error" | "log" | "warn"> {
  return {
    error: () => undefined,
    log: () => undefined,
    warn: () => undefined,
  };
}
