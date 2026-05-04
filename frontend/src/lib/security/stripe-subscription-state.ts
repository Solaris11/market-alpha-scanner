export type StripeSubscriptionLike = {
  cancel_at?: number | null;
  cancel_at_period_end?: boolean | null;
  items?: {
    data?: Array<{
      current_period_end?: number | null;
    }>;
  } | null;
  status?: string | null;
  trial_end?: number | null;
};

export function stripeSubscriptionAccessEnd(subscription: StripeSubscriptionLike): Date | null {
  return timestampDate(subscription.cancel_at) ?? stripeSubscriptionPeriodEnd(subscription);
}

export function stripeSubscriptionCancelScheduled(subscription: StripeSubscriptionLike): boolean {
  if (subscription.cancel_at_period_end === true) return true;
  if (!timestampDate(subscription.cancel_at)) return false;
  return subscription.status === "active" || subscription.status === "trialing";
}

function stripeSubscriptionPeriodEnd(subscription: StripeSubscriptionLike): Date | null {
  const itemPeriodEnds = (subscription.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const periodEnd = itemPeriodEnds.length ? Math.max(...itemPeriodEnds) : subscription.trial_end;
  return timestampDate(periodEnd);
}

function timestampDate(value: number | null | undefined): Date | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;
}
