export type BillingViewSubscription = {
  cancelAtPeriodEnd?: boolean | null;
  currentPeriodEnd?: Date | string | null;
  status?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
};

export type BillingViewState = {
  accessText: string | null;
  actionLabel: "Manage Subscription" | "Renew Subscription" | "Update billing" | "Upgrade to Premium" | null;
  actionMode: "checkout" | "portal" | null;
  helper: string | null;
  state: "active" | "cancel_scheduled" | "free" | "manual_premium" | "past_due";
  statusText: string | null;
};

export function billingViewState(args: { isPremium: boolean; subscription: BillingViewSubscription | null }): BillingViewState {
  const subscription = args.subscription;
  const status = normalizedStatus(subscription?.status);
  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);
  const currentPeriodEnd = formatDate(subscription?.currentPeriodEnd ?? null);

  if (status === "past_due") {
    return {
      accessText: null,
      actionLabel: hasStripeCustomer ? "Update billing" : null,
      actionMode: hasStripeCustomer ? "portal" : null,
      helper: "Update your payment method to keep Premium access.",
      state: "past_due",
      statusText: "Payment issue",
    };
  }

  if (subscription?.cancelAtPeriodEnd && (status === "active" || status === "trialing")) {
    return {
      accessText: `Premium access active until ${currentPeriodEnd ?? "the end of the billing period"}`,
      actionLabel: hasStripeCustomer ? "Renew Subscription" : null,
      actionMode: hasStripeCustomer ? "portal" : null,
      helper: currentPeriodEnd
        ? `Your premium access will continue until ${currentPeriodEnd}. Your subscription will not renew.`
        : "Your subscription will not renew.",
      state: "cancel_scheduled",
      statusText: "Subscription canceled",
    };
  }

  if (args.isPremium) {
    if (!hasStripeCustomer) {
      return {
        accessText: null,
        actionLabel: null,
        actionMode: null,
        helper: "Premium access is active, but no Stripe billing profile is linked to this account.",
        state: "manual_premium",
        statusText: "Premium active",
      };
    }
    return {
      accessText: null,
      actionLabel: "Manage Subscription",
      actionMode: "portal",
      helper: "Cancel or update your subscription anytime. No hassle.",
      state: "active",
      statusText: "Premium active",
    };
  }

  if (hasStripeCustomer && status === "canceled") {
    return {
      accessText: null,
      actionLabel: "Renew Subscription",
      actionMode: "portal",
      helper: "Renew anytime to restore full Premium access.",
      state: "free",
      statusText: currentPeriodEnd ? `Canceled - access ended ${currentPeriodEnd}` : "Canceled",
    };
  }

  return {
    accessText: null,
    actionLabel: "Upgrade to Premium",
    actionMode: "checkout",
    helper: null,
    state: "free",
    statusText: null,
  };
}

function normalizedStatus(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function formatDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}
