import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  billingEventProcessed,
  customerIdFromInvoice,
  notifyPaymentFailed,
  notifyPremiumRenewalRestored,
  notifySubscriptionActive,
  notifySubscriptionCanceled,
  recordBillingEvent,
  retrieveSubscription,
  stripeObjectId,
  subscriptionIdFromInvoice,
  updateSubscriptionStatusByCustomer,
  upsertCustomerReference,
  upsertSubscriptionFromStripe,
  type StripeSyncResult,
} from "@/lib/server/billing";
import { stripe, stripeWebhookSecret } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ ok: false, message: "Invalid webhook signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, stripeWebhookSecret());
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    if (await billingEventProcessed(event.id)) {
      return NextResponse.json({ ok: true, received: true, duplicate: true });
    }

    const result = await handleStripeEvent(event);
    await recordBillingEvent({
      eventType: event.type,
      payloadSummary: {
        cancel_at_period_end: String(result.cancelAtPeriodEnd),
        customer: result.stripeCustomerId,
        current_period_end: result.currentPeriodEnd,
        status: result.status,
        subscription: result.stripeSubscriptionId,
      },
      stripeEventId: event.id,
      userId: result.userId,
    });

    return NextResponse.json({ ok: true, received: true });
  } catch (error) {
    console.warn("[stripe] webhook processing failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Webhook processing failed." }, { status: 500 });
  }
}

async function handleStripeEvent(event: Stripe.Event): Promise<StripeSyncResult> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
    case "invoice.payment_succeeded":
      return handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
    default:
      return {
        canceledAt: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        previousCancelAtPeriodEnd: null,
        status: "ignored",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        userId: null,
      };
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<StripeSyncResult> {
  const userId = metadataUserId(session.metadata);
  const customerId = stripeObjectId(session.customer);
  const subscriptionId = stripeObjectId(session.subscription);

  if (userId && customerId) {
    await upsertCustomerReference(userId, customerId, subscriptionId);
  }

  if (subscriptionId) {
    const subscription = await retrieveSubscription(subscriptionId);
    const result = await upsertSubscriptionFromStripe(subscription, userId);
    if (result.userId && statusGrantsPremium(result.status)) {
      await notifySubscriptionActive(result.userId);
    }
    return result;
  }

  return {
    canceledAt: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    previousCancelAtPeriodEnd: null,
    status: session.status ?? "complete",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    userId,
  };
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<StripeSyncResult> {
  const result = await upsertSubscriptionFromStripe(subscription);
  if (result.userId && statusGrantsPremium(result.status) && result.cancelAtPeriodEnd) {
    await notifySubscriptionCanceled(result.userId, result.currentPeriodEnd);
  } else if (result.userId && statusGrantsPremium(result.status)) {
    await notifySubscriptionActive(result.userId);
  }
  if (result.userId && result.previousCancelAtPeriodEnd === true && !result.cancelAtPeriodEnd && statusGrantsPremium(result.status)) {
    await notifyPremiumRenewalRestored(result.userId);
  }
  return result;
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<StripeSyncResult> {
  const result = await upsertSubscriptionFromStripe(subscription);
  if (result.userId) {
    await notifySubscriptionCanceled(result.userId, result.currentPeriodEnd);
  }
  return result;
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<StripeSyncResult> {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  const customerId = customerIdFromInvoice(invoice);

  if (subscriptionId) {
    const subscription = await retrieveSubscription(subscriptionId);
    const result = await upsertSubscriptionFromStripe(subscription);
    const userId = customerId ? await updateSubscriptionStatusByCustomer(customerId, "past_due") : result.userId;
    if (userId) await notifyPaymentFailed(userId);
    return {
      ...result,
      status: "past_due",
      userId: userId ?? result.userId,
    };
  }

  if (customerId) {
    const userId = await updateSubscriptionStatusByCustomer(customerId, "past_due");
    if (userId) await notifyPaymentFailed(userId);
    return {
      canceledAt: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      previousCancelAtPeriodEnd: null,
      status: "past_due",
      stripeCustomerId: customerId,
      stripeSubscriptionId: null,
      userId,
    };
  }

  return {
    canceledAt: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    previousCancelAtPeriodEnd: null,
    status: "past_due",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    userId: null,
  };
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<StripeSyncResult> {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    return {
      canceledAt: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      previousCancelAtPeriodEnd: null,
      status: "paid",
      stripeCustomerId: customerIdFromInvoice(invoice),
      stripeSubscriptionId: null,
      userId: null,
    };
  }

  const result = await upsertSubscriptionFromStripe(await retrieveSubscription(subscriptionId));
  if (result.userId && statusGrantsPremium(result.status)) {
    await notifySubscriptionActive(result.userId);
  }
  return result;
}

function metadataUserId(metadata: Stripe.Metadata | null | undefined): string | null {
  const userId = metadata?.user_id;
  return typeof userId === "string" && userId ? userId : null;
}

function statusGrantsPremium(status: string): boolean {
  return status === "active" || status === "trialing";
}
