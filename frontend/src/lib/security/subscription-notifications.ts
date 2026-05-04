export type SubscriptionNotificationIntent = {
  actionUrl: "/account";
  dedupe: "always" | "once";
  message: string;
  title: string;
  type: "subscription";
};

export function premiumActivatedNotification(): SubscriptionNotificationIntent {
  return {
    actionUrl: "/account",
    dedupe: "once",
    message: "Your Market Alpha Premium subscription is now active.",
    title: "Premium activated",
    type: "subscription",
  };
}

export function paymentFailedNotification(): SubscriptionNotificationIntent {
  return {
    actionUrl: "/account",
    dedupe: "always",
    message: "We could not process your payment. Update your billing details to keep Premium access.",
    title: "Payment failed",
    type: "subscription",
  };
}

export function subscriptionCanceledNotification(currentPeriodEnd: string | null): SubscriptionNotificationIntent {
  const endText = formatPeriodEnd(currentPeriodEnd);
  return {
    actionUrl: "/account",
    dedupe: "once",
    message: endText
      ? `Your Premium access will remain active until ${endText}. Renew anytime to keep full access.`
      : "Your Premium subscription was canceled. Renew anytime to keep full access.",
    title: "Subscription canceled",
    type: "subscription",
  };
}

function formatPeriodEnd(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}
