import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type Stripe from "stripe";
import { sendExternalAlert } from "@/lib/alerting/external-alerts";
import { notificationIntentForStripeWebhook } from "@/lib/security/stripe-webhook-policy";
import {
  billingEventProcessed,
  claimStripeEvent,
  createBillingNotificationForEvent,
  customerIdFromInvoice,
  recordBillingEvent,
  retrieveSubscription,
  stripeObjectId,
  subscriptionIdFromInvoice,
  updateSubscriptionStatusByCustomer,
  upsertCustomerReference,
  upsertSubscriptionFromStripe,
  type StripeSyncResult,
} from "@/lib/server/billing";
import { dbTransaction, type DbExecutor } from "@/lib/server/db";
import { sendBillingLifecycleEmailToUser } from "@/lib/server/email";
import { recordMonitoringEvent, withRequestMetrics } from "@/lib/server/monitoring";
import { stripe, stripeWebhookSecret } from "@/lib/server/stripe";
import type { SubscriptionNotificationIntent } from "@/lib/security/subscription-notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PreparedStripeEvent = {
  invoice: Stripe.Invoice | null;
  session: Stripe.Checkout.Session | null;
  subscription: Stripe.Subscription | null;
};

type WebhookProcessResult = {
  duplicate: boolean;
  emailIntent: { intent: SubscriptionNotificationIntent; userId: string } | null;
  result: StripeSyncResult;
};

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/stripe/webhook", () => webhook(request));
}

async function webhook(request: Request): Promise<Response> {
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
    const processResult = await processStripeWebhook(event);
    if (processResult.emailIntent) {
      await sendBillingLifecycleEmailToUser(processResult.emailIntent.userId, processResult.emailIntent.intent).catch((emailError: unknown) => {
        console.warn("[billing] lifecycle email failed", emailError instanceof Error ? emailError.message : emailError);
      });
    }
    return NextResponse.json({ ok: true, received: true, duplicate: processResult.duplicate });
  } catch (error) {
    console.warn("[stripe] webhook processing failed", error instanceof Error ? error.message : error);
    Sentry.captureException(error, { tags: { area: "stripe_webhook", event_type: event.type } });
    await reportStripeWebhookFailure(event, error);
    return NextResponse.json({ ok: false, message: "Webhook processing failed." }, { status: 500 });
  }
}

async function reportStripeWebhookFailure(event: Stripe.Event, error: unknown): Promise<void> {
  const metadata = {
    error: error instanceof Error ? error.message : "unknown error",
    eventId: event.id,
    eventType: event.type,
  };
  await recordMonitoringEvent({
    eventType: "stripe:webhook_failure",
    message: "Stripe webhook processing failed.",
    metadata,
    severity: "critical",
    status: "fail",
  }).catch((writeError: unknown) => {
    console.warn("[stripe] webhook monitoring event failed", writeError instanceof Error ? writeError.message : writeError);
  });
  await sendExternalAlert({
    eventType: "stripe:webhook_failure",
    message: "Stripe webhook processing failed.",
    metadata,
    severity: "critical",
    status: "fail",
  }).catch((alertError: unknown) => {
    console.warn("[stripe] webhook external alert failed", alertError instanceof Error ? alertError.message : alertError);
  });
}

async function processStripeWebhook(event: Stripe.Event): Promise<WebhookProcessResult> {
  if (await billingEventProcessed(event.id)) {
    return { duplicate: true, emailIntent: null, result: ignoredResult() };
  }

  const prepared = await prepareStripeEvent(event);
  return dbTransaction(async (db) => {
    const claimed = await claimStripeEvent(event.id, event.type, db);
    if (!claimed) {
      return { duplicate: true, emailIntent: null, result: ignoredResult() };
    }

    const result = await applyPreparedStripeEvent(event, prepared, db);
    await recordBillingEvent({
      db,
      eventType: event.type,
      payloadSummary: {
        cancel_at_period_end: String(result.cancelAtPeriodEnd),
        customer: result.stripeCustomerId,
        current_period_end: result.currentPeriodEnd,
        stale_event: String(result.staleEvent),
        status: result.status,
        subscription: result.stripeSubscriptionId,
      },
      stripeEventId: event.id,
      userId: result.userId,
    });
    const emailIntent = await notifyForStripeEvent(event, result, db);
    return { duplicate: false, emailIntent, result };
  });
}

async function prepareStripeEvent(event: Stripe.Event): Promise<PreparedStripeEvent> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = stripeObjectId(session.subscription);
      return {
        invoice: null,
        session,
        subscription: subscriptionId ? await retrieveSubscription(subscriptionId) : null,
      };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return {
        invoice: null,
        session: null,
        subscription: event.data.object as Stripe.Subscription,
      };
    case "invoice.payment_failed":
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = subscriptionIdFromInvoice(invoice);
      return {
        invoice,
        session: null,
        subscription: subscriptionId ? await retrieveSubscription(subscriptionId) : null,
      };
    }
    default:
      return { invoice: null, session: null, subscription: null };
  }
}

async function applyPreparedStripeEvent(event: Stripe.Event, prepared: PreparedStripeEvent, db: DbExecutor): Promise<StripeSyncResult> {
  const eventCreatedAt = stripeEventCreatedAt(event);
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(prepared.session, prepared.subscription, eventCreatedAt, db);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return prepared.subscription ? upsertSubscriptionFromStripe(prepared.subscription, null, db, eventCreatedAt) : ignoredResult();
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(prepared.invoice, prepared.subscription, eventCreatedAt, db);
    case "invoice.payment_succeeded":
      return prepared.subscription ? upsertSubscriptionFromStripe(prepared.subscription, null, db, eventCreatedAt) : invoiceOnlyResult(prepared.invoice, "paid");
    default:
      return ignoredResult();
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session | null, subscription: Stripe.Subscription | null, eventCreatedAt: Date | null, db: DbExecutor): Promise<StripeSyncResult> {
  if (!session) return ignoredResult();
  const userId = metadataUserId(session.metadata);
  const customerId = stripeObjectId(session.customer);
  const subscriptionId = stripeObjectId(session.subscription);

  if (userId && customerId) {
    await upsertCustomerReference(userId, customerId, subscriptionId, db);
  }

  if (subscription) {
    return upsertSubscriptionFromStripe(subscription, userId, db, eventCreatedAt);
  }

  return {
    canceledAt: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    previousCancelAtPeriodEnd: null,
    staleEvent: false,
    status: session.status ?? "complete",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    userId,
  };
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice | null, subscription: Stripe.Subscription | null, eventCreatedAt: Date | null, db: DbExecutor): Promise<StripeSyncResult> {
  const customerId = invoice ? customerIdFromInvoice(invoice) : null;

  if (subscription) {
    const result = await upsertSubscriptionFromStripe(subscription, null, db, eventCreatedAt);
    const userId = customerId ? await updateSubscriptionStatusByCustomer(customerId, "past_due", db, eventCreatedAt) : result.userId;
    return {
      ...result,
      status: userId ? "past_due" : result.status,
      userId: userId ?? result.userId,
    };
  }

  if (customerId) {
    const userId = await updateSubscriptionStatusByCustomer(customerId, "past_due", db, eventCreatedAt);
    return {
      canceledAt: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      previousCancelAtPeriodEnd: null,
      staleEvent: false,
      status: userId ? "past_due" : "ignored",
      stripeCustomerId: customerId,
      stripeSubscriptionId: null,
      userId,
    };
  }

  return invoiceOnlyResult(invoice, "past_due");
}

async function notifyForStripeEvent(event: Stripe.Event, result: StripeSyncResult, db: DbExecutor): Promise<{ intent: SubscriptionNotificationIntent; userId: string } | null> {
  if (!result.userId) return null;
  const intent = notificationIntentForStripeWebhook(event.type, result);
  if (!intent) return null;
  const inserted = await createBillingNotificationForEvent(result.userId, intent, event.id, db);
  return inserted ? { intent, userId: result.userId } : null;
}

function metadataUserId(metadata: Stripe.Metadata | null | undefined): string | null {
  const userId = metadata?.user_id;
  return typeof userId === "string" && userId ? userId : null;
}

function stripeEventCreatedAt(event: Stripe.Event): Date | null {
  return typeof event.created === "number" && Number.isFinite(event.created) ? new Date(event.created * 1000) : null;
}

function invoiceOnlyResult(invoice: Stripe.Invoice | null, status: string): StripeSyncResult {
  return {
    canceledAt: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    previousCancelAtPeriodEnd: null,
    staleEvent: false,
    status,
    stripeCustomerId: invoice ? customerIdFromInvoice(invoice) : null,
    stripeSubscriptionId: invoice ? subscriptionIdFromInvoice(invoice) : null,
    userId: null,
  };
}

function ignoredResult(): StripeSyncResult {
  return {
    canceledAt: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    previousCancelAtPeriodEnd: null,
    staleEvent: false,
    status: "ignored",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    userId: null,
  };
}
