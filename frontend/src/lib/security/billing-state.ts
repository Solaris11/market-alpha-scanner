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
  currentPeriodEnd: Date | null;
  helper: string | null;
  isCanceled: boolean;
  isPremium: boolean;
  state: "active" | "cancel_scheduled" | "free" | "manual_premium" | "past_due";
  statusText: string | null;
  willRenew: boolean;
};

export function billingViewState(args: { isPremium: boolean; subscription: BillingViewSubscription | null }): BillingViewState {
  const subscription = args.subscription;
  const status = normalizedStatus(subscription?.status);
  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);
  const currentPeriodEnd = parseDate(subscription?.currentPeriodEnd ?? null);
  const currentPeriodEndText = formatBillingDate(currentPeriodEnd);
  const willRenew = args.isPremium && hasStripeCustomer && (status === "active" || status === "trialing") && !subscription?.cancelAtPeriodEnd;

  if (status === "past_due") {
    return {
      accessText: null,
      actionLabel: hasStripeCustomer ? "Update billing" : null,
      actionMode: hasStripeCustomer ? "portal" : null,
      currentPeriodEnd,
      helper: "Update your payment method to keep Premium access.",
      isCanceled: false,
      isPremium: args.isPremium,
      state: "past_due",
      statusText: "Payment issue",
      willRenew: false,
    };
  }

  if (subscription?.cancelAtPeriodEnd && (status === "active" || status === "trialing")) {
    return {
      accessText: `Premium access active until ${currentPeriodEndText ?? "the end of the billing period"}`,
      actionLabel: hasStripeCustomer ? "Renew Subscription" : null,
      actionMode: hasStripeCustomer ? "portal" : null,
      currentPeriodEnd,
      helper: currentPeriodEndText
        ? `Your premium access will continue until ${currentPeriodEndText}. Your subscription will not renew.`
        : "Your subscription will not renew.",
      isCanceled: true,
      isPremium: args.isPremium,
      state: "cancel_scheduled",
      statusText: "Subscription canceled",
      willRenew: false,
    };
  }

  if (args.isPremium) {
    if (!hasStripeCustomer) {
      return {
        accessText: null,
        actionLabel: null,
        actionMode: null,
        currentPeriodEnd,
        helper: "Premium access is active, but no Stripe billing profile is linked to this account.",
        isCanceled: false,
        isPremium: true,
        state: "manual_premium",
        statusText: "Premium active",
        willRenew: false,
      };
    }
    return {
      accessText: currentPeriodEndText ? `Renews on ${currentPeriodEndText}` : null,
      actionLabel: "Manage Subscription",
      actionMode: "portal",
      currentPeriodEnd,
      helper: "Cancel or update your subscription anytime. No hassle.",
      isCanceled: false,
      isPremium: true,
      state: "active",
      statusText: "Premium active",
      willRenew,
    };
  }

  if (hasStripeCustomer && status === "canceled") {
    return {
      accessText: null,
      actionLabel: "Renew Subscription",
      actionMode: "portal",
      currentPeriodEnd,
      helper: "Renew anytime to restore full Premium access.",
      isCanceled: true,
      isPremium: false,
      state: "free",
      statusText: currentPeriodEndText ? `Canceled - access ended ${currentPeriodEndText}` : "Canceled",
      willRenew: false,
    };
  }

  return {
    accessText: null,
    actionLabel: "Upgrade to Premium",
    actionMode: "checkout",
    currentPeriodEnd,
    helper: null,
    isCanceled: false,
    isPremium: false,
    state: "free",
    statusText: null,
    willRenew: false,
  };
}

function normalizedStatus(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function formatBillingDate(value: Date | string | null): string | null {
  const date = parseDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function parseDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date;
}
