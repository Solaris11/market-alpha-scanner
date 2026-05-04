import {
  paymentFailedNotification,
  premiumActivatedNotification,
  premiumRenewalRestoredNotification,
  subscriptionCanceledNotification,
  type SubscriptionNotificationIntent,
} from "./subscription-notifications";

export type StripeWebhookSyncState = {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  previousCancelAtPeriodEnd: boolean | null;
  staleEvent: boolean;
  status: string;
  userId: string | null;
};

export function stripeStatusGrantsPremium(status: string): boolean {
  return status === "active" || status === "trialing";
}

export function notificationIntentForStripeWebhook(eventType: string, result: StripeWebhookSyncState): SubscriptionNotificationIntent | null {
  if (!result.userId || result.staleEvent) return null;
  if (eventType === "invoice.payment_failed") return paymentFailedNotification();
  if (result.previousCancelAtPeriodEnd === true && !result.cancelAtPeriodEnd && stripeStatusGrantsPremium(result.status)) {
    return premiumRenewalRestoredNotification();
  }
  if (result.cancelAtPeriodEnd && stripeStatusGrantsPremium(result.status) && result.previousCancelAtPeriodEnd !== true) {
    return subscriptionCanceledNotification(result.currentPeriodEnd);
  }
  if ((eventType === "checkout.session.completed" || eventType === "customer.subscription.created") && stripeStatusGrantsPremium(result.status)) {
    return premiumActivatedNotification();
  }
  if (eventType === "customer.subscription.deleted") {
    return subscriptionCanceledNotification(result.currentPeriodEnd);
  }
  if (eventType === "invoice.payment_succeeded" && stripeStatusGrantsPremium(result.status)) {
    return premiumActivatedNotification();
  }
  return null;
}
