"use client";

import {
  normalizeAnalyticsDevice,
  pageOpenEventForPath,
  sanitizeAnalyticsMetadata,
  sanitizeAnalyticsPath,
  sanitizeAnalyticsSource,
  sanitizeAnalyticsSymbol,
  symbolFromPath,
  type AnalyticsEventName,
  type AnalyticsMetadata,
} from "@/lib/analytics-policy";

type ClientAnalyticsEvent = {
  anonymousId: string | null;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  eventName: AnalyticsEventName;
  metadata: AnalyticsMetadata;
  occurredAt: string;
  pagePath: string | null;
  sessionId: string | null;
  source: string | null;
  symbol: string | null;
};

const ANONYMOUS_ID_KEY = "tv_analytics_anonymous_id";
const SESSION_KEY = "tv_analytics_session";
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_QUEUE = 40;

let queue: ClientAnalyticsEvent[] = [];
let flushTimer: number | null = null;
let lastPageViewKey = "";

export function trackAnalyticsEvent(eventName: AnalyticsEventName, metadata: Record<string, unknown> = {}, options: { pagePath?: string; source?: string; symbol?: string } = {}): void {
  if (typeof window === "undefined") return;
  const pagePath = sanitizeAnalyticsPath(options.pagePath ?? `${window.location.pathname}${window.location.search}`);
  const event: ClientAnalyticsEvent = {
    anonymousId: browserId(ANONYMOUS_ID_KEY),
    deviceType: deviceType(),
    eventName,
    metadata: sanitizeAnalyticsMetadata({ ...metadata, viewportHeight: window.innerHeight, viewportWidth: window.innerWidth }),
    occurredAt: new Date().toISOString(),
    pagePath,
    sessionId: currentSessionId(),
    source: sanitizeAnalyticsSource(options.source ?? "client"),
    symbol: sanitizeAnalyticsSymbol(options.symbol) ?? symbolFromPath(window.location.pathname),
  };
  queue.push(event);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= 8) {
    void flushAnalyticsEvents();
    return;
  }
  scheduleFlush();
}

export function trackRouteAnalytics(pathname: string): void {
  if (typeof window === "undefined") return;
  const pagePath = sanitizeAnalyticsPath(`${pathname}${window.location.search}`);
  const key = `${pagePath}:${Math.floor(Date.now() / 1000)}`;
  if (key === lastPageViewKey) return;
  lastPageViewKey = key;
  const routePagePath = pagePath ?? undefined;
  trackAnalyticsEvent("page_view", { path: pagePath }, { pagePath: routePagePath, source: "route" });
  const pageEvent = pageOpenEventForPath(pathname);
  if (pageEvent) trackAnalyticsEvent(pageEvent, { path: pagePath }, { pagePath: routePagePath, source: "route", symbol: symbolFromPath(pathname) ?? undefined });
}

export async function flushAnalyticsEvents(): Promise<void> {
  if (typeof window === "undefined" || !queue.length) return;
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  const batch = queue;
  queue = [];
  const body = JSON.stringify({ events: batch });
  try {
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon("/api/analytics/events", new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
    await fetch("/api/analytics/events", {
      body,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      method: "POST",
    });
  } catch {
    queue = [...batch.slice(-12), ...queue].slice(-MAX_QUEUE);
  }
}

export function analyticsIdentityPayload(): { anonymousId: string | null; deviceType: "desktop" | "mobile" | "tablet" | "unknown"; pagePath: string | null; sessionId: string | null; symbol: string | null } {
  if (typeof window === "undefined") {
    return { anonymousId: null, deviceType: "unknown", pagePath: null, sessionId: null, symbol: null };
  }
  return {
    anonymousId: browserId(ANONYMOUS_ID_KEY),
    deviceType: deviceType(),
    pagePath: sanitizeAnalyticsPath(`${window.location.pathname}${window.location.search}`),
    sessionId: currentSessionId(),
    symbol: symbolFromPath(window.location.pathname),
  };
}

function scheduleFlush(): void {
  if (typeof window === "undefined" || flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    void flushAnalyticsEvents();
  }, 2500);
}

function browserId(key: string): string | null {
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return null;
  }
}

function currentSessionId(): string | null {
  try {
    const now = Date.now();
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    const existing = raw ? (JSON.parse(raw) as { expiresAt?: unknown; id?: unknown }) : null;
    const id = typeof existing?.id === "string" ? existing.id : "";
    const expiresAt = Number(existing?.expiresAt);
    if (id && Number.isFinite(expiresAt) && expiresAt > now) {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ expiresAt: now + SESSION_TTL_MS, id }));
      return id;
    }
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ expiresAt: now + SESSION_TTL_MS, id: next }));
    return next;
  } catch {
    return null;
  }
}

function deviceType(): "desktop" | "mobile" | "tablet" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  const width = window.innerWidth;
  if (width < 640) return "mobile";
  if (width < 1100) return "tablet";
  return normalizeAnalyticsDevice("desktop");
}
