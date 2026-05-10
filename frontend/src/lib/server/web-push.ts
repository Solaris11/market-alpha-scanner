import "server-only";

import webPush from "web-push";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { markPushSubscriptionError, type StoredPushSubscription } from "./push-subscriptions";

export type MobileWebPushPayload = {
  badge?: string;
  body: string;
  icon?: string;
  tag?: string;
  title: string;
  url?: string;
};

export type MobileWebPushResult = {
  disabled: boolean;
  endpoint: string;
  ok: boolean;
  statusCode: number | null;
};

let configured = false;

export function webPushPublicKey(): string | null {
  return cleanEnv(process.env.NEXT_PUBLIC_TRADEVETO_WEB_PUSH_PUBLIC_KEY) ?? cleanEnv(process.env.TRADEVETO_WEB_PUSH_PUBLIC_KEY);
}

export function isWebPushDeliveryConfigured(): boolean {
  return Boolean(webPushPublicKey() && cleanEnv(process.env.TRADEVETO_WEB_PUSH_PRIVATE_KEY));
}

export function configureWebPush(): boolean {
  if (configured) return true;
  const publicKey = webPushPublicKey();
  const privateKey = cleanEnv(process.env.TRADEVETO_WEB_PUSH_PRIVATE_KEY);
  if (!publicKey || !privateKey) return false;
  const subject = cleanEnv(process.env.TRADEVETO_WEB_PUSH_CONTACT) ?? `mailto:${SUPPORT_EMAIL}`;
  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export async function sendMobileWebPush(subscription: StoredPushSubscription, payload: MobileWebPushPayload): Promise<MobileWebPushResult> {
  if (!configureWebPush()) {
    return { disabled: true, endpoint: subscription.endpoint, ok: false, statusCode: null };
  }

  try {
    const response = await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          auth: subscription.auth,
          p256dh: subscription.p256dh,
        },
      },
      JSON.stringify({
        badge: payload.badge ?? "/apple-touch-icon.png",
        body: payload.body,
        icon: payload.icon ?? "/icon.png",
        tag: payload.tag ?? "tradeveto-mobile-intelligence",
        title: payload.title,
        url: safeNotificationUrl(payload.url),
      }),
      { TTL: 60 * 60 },
    );
    return { disabled: false, endpoint: subscription.endpoint, ok: true, statusCode: response.statusCode };
  } catch (error) {
    const statusCode = statusCodeFromError(error);
    if (statusCode === 404 || statusCode === 410) {
      await markPushSubscriptionError(subscription.endpoint, `Web push endpoint expired with ${statusCode}.`).catch(() => undefined);
    } else {
      await markPushSubscriptionError(subscription.endpoint, error instanceof Error ? error.message : "Web push delivery failed.").catch(() => undefined);
    }
    return { disabled: false, endpoint: subscription.endpoint, ok: false, statusCode };
  }
}

function safeNotificationUrl(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || !text.startsWith("/") || text.startsWith("//")) return "/mobile";
  return text.slice(0, 240);
}

function statusCodeFromError(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const value = Number((error as { statusCode?: unknown }).statusCode);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function cleanEnv(value: string | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}
