"use client";

import {
  recordEcosystemContinuityRoute,
  type ContinuityWorkflowGroup,
} from "@/lib/client/ecosystem-continuity-storage";
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
import { readWatchlistStorage } from "@/lib/watchlist-storage";

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
const ACTIVATION_MILESTONES_KEY = "tv_activation_milestones_recorded";
const FIRST_USEFUL_ACTION_KEY = "tv_first_useful_action_recorded";
const FIRST_USEFUL_ACTIONS_KEY = "tv_first_useful_actions_recorded";
const SESSION_KEY = "tv_analytics_session";
const SESSION_STARTED_AT_KEY = "tv_analytics_session_started_at";
const LAST_WORKFLOW_GROUP_KEY = "tv_analytics_last_workflow_group";
const LAST_ACTIVE_DAY_KEY = "tv_analytics_last_active_day";
const TELEMETRY_OPT_OUT_KEY = "tv_analytics_opt_out";
const MORNING_WORKFLOW_EMITTED_KEY = "tv_morning_workflow_emitted";
const RETURN_SESSION_EMITTED_KEY = "tv_return_session_emitted";
const RETURN_WORKFLOW_EMITTED_KEY = "tv_return_workflow_emitted";
const PERSONALIZED_RETURN_EMITTED_KEY = "tv_personalized_return_emitted";
const WATCHLIST_RETENTION_EMITTED_KEY = "tv_watchlist_retention_emitted";
const WORKFLOW_DROPOFF_EMITTED_KEY = "tv_workflow_dropoff_emitted";
const SESSION_TTL_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_QUEUE = 40;
const DUPLICATE_CLICK_MS = 900;
const RAGE_CLICK_WINDOW_MS = 1600;
const RAGE_CLICK_MIN_COUNT = 4;
const SCROLL_ABANDON_DEPTH = 0.72;
const SCROLL_ABANDON_IDLE_MS = 18_000;
const CARD_CLICK_MIN_INTERVAL_MS = 350;

let queue: ClientAnalyticsEvent[] = [];
let flushTimer: number | null = null;
let lastPageViewKey = "";
let pageStartedAtMs = Date.now();
let usefulInteractionSeen = false;
let lastClick: { component: string; occurredAt: number } | null = null;
let recentClicks: Array<{ component: string; occurredAt: number; x: number; y: number }> = [];
let emittedScrollAbandonPath = "";
let maxScrollDepth = 0;
let lastInteractionAt = Date.now();
let lastCardClickAt = 0;

export type ActivationMilestone =
  | "alert"
  | "chart"
  | "compare"
  | "morning_command"
  | "replay"
  | "scanner"
  | "strategy"
  | "symbol_investigation"
  | "watchlist";

export function trackAnalyticsEvent(eventName: AnalyticsEventName, metadata: Record<string, unknown> = {}, options: { pagePath?: string; source?: string; symbol?: string } = {}): void {
  if (typeof window === "undefined" || !analyticsEnabled()) return;
  const pagePath = sanitizeAnalyticsPath(options.pagePath ?? `${window.location.pathname}${window.location.search}`);
  const event: ClientAnalyticsEvent = {
    anonymousId: browserId(ANONYMOUS_ID_KEY),
    deviceType: deviceType(),
    eventName,
    metadata: sanitizeAnalyticsMetadata({
      ...metadata,
      pageElapsedMs: Math.max(0, Math.round(Date.now() - pageStartedAtMs)),
      sessionElapsedMs: sessionElapsedMs(),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }),
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

export function trackFirstUsefulAction(action: string, metadata: Record<string, unknown> = {}, options: { pagePath?: string; source?: string; symbol?: string } = {}): void {
  if (typeof window === "undefined" || !analyticsEnabled()) return;
  const actionKey = normalizeFirstUsefulActionKey(action);
  if (!actionKey) return;
  let firstGlobalUsefulAction = false;
  try {
    const actions = readFirstUsefulActions();
    if (actions.includes(actionKey)) return;
    const next = [...actions, actionKey].slice(-32);
    window.localStorage.setItem(FIRST_USEFUL_ACTIONS_KEY, JSON.stringify(next));
    if (!window.localStorage.getItem(FIRST_USEFUL_ACTION_KEY)) {
      window.localStorage.setItem(FIRST_USEFUL_ACTION_KEY, new Date().toISOString());
      firstGlobalUsefulAction = true;
    }
  } catch {
    // If local storage is unavailable, still emit the activation event once for the current call path.
  }
  usefulInteractionSeen = true;
  lastInteractionAt = Date.now();
  trackAnalyticsEvent("first_useful_action", { ...metadata, action, actionKey, firstGlobalUsefulAction }, options);
}

export function trackActivationMilestone(milestone: ActivationMilestone, metadata: Record<string, unknown> = {}, options: { pagePath?: string; source?: string; symbol?: string } = {}): void {
  if (typeof window === "undefined" || !analyticsEnabled()) return;
  try {
    const milestones = readActivationMilestones();
    if (milestones.includes(milestone)) return;
    const next = [...milestones, milestone].slice(-20);
    window.localStorage.setItem(ACTIVATION_MILESTONES_KEY, JSON.stringify(next));
    trackAnalyticsEvent("activation_milestone", {
      ...metadata,
      milestone,
      milestoneCount: next.length,
    }, options);
  } catch {
    trackAnalyticsEvent("activation_milestone", { ...metadata, milestone }, options);
  }
}

export function trackRouteAnalytics(pathname: string): void {
  if (typeof window === "undefined" || !analyticsEnabled()) return;
  pageStartedAtMs = Date.now();
  usefulInteractionSeen = false;
  maxScrollDepth = 0;
  emittedScrollAbandonPath = "";
  const pagePath = sanitizeAnalyticsPath(`${pathname}${window.location.search}`);
  const key = `${pagePath}:${Math.floor(Date.now() / 1000)}`;
  if (key === lastPageViewKey) return;
  lastPageViewKey = key;
  const routePagePath = pagePath ?? undefined;
  trackAnalyticsEvent("page_view", { path: pagePath }, { pagePath: routePagePath, source: "route" });
  const pageEvent = pageOpenEventForPath(pathname);
  if (pageEvent) trackAnalyticsEvent(pageEvent, { path: pagePath }, { pagePath: routePagePath, source: "route", symbol: symbolFromPath(pathname) ?? undefined });
  const usageEvent = usageEventForPath(pathname);
  if (usageEvent) trackAnalyticsEvent(usageEvent, { path: pagePath }, { pagePath: routePagePath, source: "route_usage", symbol: symbolFromPath(pathname) ?? undefined });
  trackRouteActivationMilestone(pathname, routePagePath);
  trackMobileEngagement(pathname, routePagePath);
  trackReturnSession(pathname, routePagePath);
  trackWorkflowContinuity(pathname, routePagePath);
  recordRouteContinuityMemory(pathname, routePagePath);
  trackWatchlistRetention(pathname, routePagePath);
}

export async function flushAnalyticsEvents(): Promise<void> {
  if (typeof window === "undefined" || !analyticsEnabled() || !queue.length) return;
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

export function installBehaviorTelemetry(): () => void {
  if (typeof window === "undefined" || !analyticsEnabled()) return () => undefined;

  const abort = new AbortController();
  const signal = abort.signal;

  document.addEventListener("click", handleDocumentClick, { capture: true, passive: true, signal });
  window.addEventListener("scroll", handleScroll, { passive: true, signal });
  window.addEventListener("pagehide", emitExitTelemetry, { signal });
  window.addEventListener("popstate", () => {
    trackAnalyticsEvent("back_navigation", { path: sanitizeAnalyticsPath(`${window.location.pathname}${window.location.search}`) }, { source: "browser_history" });
  }, { signal });

  return () => abort.abort();
}

export function trackModalOpen(component: string, metadata: Record<string, unknown> = {}): void {
  trackAnalyticsEvent("modal_open", { ...metadata, component: compactComponent(component) }, { source: "modal" });
}

export function trackModalClose(component: string, metadata: Record<string, unknown> = {}): void {
  const eventName: AnalyticsEventName = deviceType() === "mobile" ? "bottom_sheet_close" : "modal_close";
  trackAnalyticsEvent(eventName, { ...metadata, component: compactComponent(component) }, { source: "modal" });
}

export function trackModalAbandon(component: string, metadata: Record<string, unknown> = {}): void {
  trackAnalyticsEvent("modal_abandon", { ...metadata, component: compactComponent(component) }, { source: "modal" });
}

export function trackFailedAction(component: string, reason: string, metadata: Record<string, unknown> = {}): void {
  trackAnalyticsEvent("failed_action", { ...metadata, component: compactComponent(component), reason: compactComponent(reason) }, { source: "action_error" });
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

export function analyticsOptOutStorageKey(): string {
  return TELEMETRY_OPT_OUT_KEY;
}

export function setAnalyticsOptOut(optOut: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TELEMETRY_OPT_OUT_KEY, optOut ? "true" : "false");
  } catch {
    // Telemetry remains non-blocking when storage is unavailable.
  }
  if (optOut) {
    queue = [];
    if (flushTimer !== null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
  }
}

export function analyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_TRADEVETO_DISABLE_TELEMETRY === "1") return false;
  try {
    return window.localStorage.getItem(TELEMETRY_OPT_OUT_KEY) !== "true";
  } catch {
    return true;
  }
}

function handleDocumentClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const descriptor = target ? analyticsElementDescriptor(target) : null;
  if (!descriptor) return;

  const now = Date.now();
  usefulInteractionSeen = true;
  lastInteractionAt = now;

  const component = descriptor.component;
  if (now - lastCardClickAt >= CARD_CLICK_MIN_INTERVAL_MS) {
    lastCardClickAt = now;
    trackAnalyticsEvent("card_click", { component, kind: descriptor.kind }, { source: "behavior_detector", symbol: descriptor.symbol ?? undefined });
  }

  if (lastClick && lastClick.component === component && now - lastClick.occurredAt <= DUPLICATE_CLICK_MS) {
    trackAnalyticsEvent("duplicate_click", { component, intervalMs: now - lastClick.occurredAt }, { source: "friction_detector", symbol: descriptor.symbol ?? undefined });
  }
  lastClick = { component, occurredAt: now };

  recentClicks = [...recentClicks.filter((click) => now - click.occurredAt <= RAGE_CLICK_WINDOW_MS), { component, occurredAt: now, x: event.clientX, y: event.clientY }];
  const cluster = recentClicks.filter((click) => click.component === component && Math.abs(click.x - event.clientX) <= 48 && Math.abs(click.y - event.clientY) <= 48);
  if (cluster.length === RAGE_CLICK_MIN_COUNT) {
    trackAnalyticsEvent("rage_click", { component, count: cluster.length }, { source: "friction_detector", symbol: descriptor.symbol ?? undefined });
  }
}

function handleScroll(): void {
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  maxScrollDepth = Math.max(maxScrollDepth, Math.min(1, window.scrollY / scrollable));
}

function emitScrollAbandonIfNeeded(): void {
  const path = sanitizeAnalyticsPath(`${window.location.pathname}${window.location.search}`) ?? "unknown";
  if (emittedScrollAbandonPath === path) return;
  const idleMs = Date.now() - lastInteractionAt;
  if (maxScrollDepth >= SCROLL_ABANDON_DEPTH && !usefulInteractionSeen && idleMs >= SCROLL_ABANDON_IDLE_MS) {
    emittedScrollAbandonPath = path;
    trackAnalyticsEvent("scroll_abandon", { maxScrollDepth: Number(maxScrollDepth.toFixed(2)), idleMs }, { pagePath: path, source: "friction_detector" });
  }
}

function emitWorkflowDropoffIfNeeded(): void {
  const path = sanitizeAnalyticsPath(`${window.location.pathname}${window.location.search}`) ?? "unknown";
  const group = workflowGroupForPath(window.location.pathname);
  if (!group || group === "support" || group === "account") return;
  const pageElapsedMs = Date.now() - pageStartedAtMs;
  if (pageElapsedMs < 12_000 || usefulInteractionSeen) return;
  const sessionId = currentSessionId() ?? "unknown";
  const key = `${WORKFLOW_DROPOFF_EMITTED_KEY}:${sessionId}:${path}`;
  try {
    if (window.sessionStorage.getItem(key) === "true") return;
    window.sessionStorage.setItem(key, "true");
  } catch {
    // If session storage is unavailable, still emit once for this pagehide path.
  }
  trackAnalyticsEvent("workflow_dropoff", {
    maxScrollDepth: Number(maxScrollDepth.toFixed(2)),
    pageElapsedMs: Math.round(pageElapsedMs),
    routeGroup: group,
  }, { pagePath: path, source: "friction_detector", symbol: symbolFromPath(window.location.pathname) ?? undefined });
  trackAnalyticsEvent("churn_risk_signal", {
    maxScrollDepth: Number(maxScrollDepth.toFixed(2)),
    pageElapsedMs: Math.round(pageElapsedMs),
    riskType: "workflow_abandonment",
    routeGroup: group,
  }, { pagePath: path, source: "friction_detector", symbol: symbolFromPath(window.location.pathname) ?? undefined });
}

function emitExitTelemetry(): void {
  emitScrollAbandonIfNeeded();
  emitWorkflowDropoffIfNeeded();
}

function analyticsElementDescriptor(target: Element): { component: string; kind: string; symbol: string | null } | null {
  const element = target.closest<HTMLElement>("[data-analytics-id], [data-analytics-component], [data-telemetry-id], [data-symbol], a, button, summary, [role='button']");
  if (!element) return null;
  const explicit = element.dataset.analyticsId || element.dataset.analyticsComponent || element.dataset.telemetryId;
  const href = element instanceof HTMLAnchorElement ? sanitizeAnalyticsPath(element.getAttribute("href")) : null;
  const label = explicit || element.getAttribute("aria-label") || element.getAttribute("title") || href || element.textContent || element.tagName.toLowerCase();
  const kind = element instanceof HTMLAnchorElement ? "link" : element.tagName.toLowerCase() === "button" ? "button" : element.getAttribute("role") || element.tagName.toLowerCase();
  return {
    component: compactComponent(label),
    kind: compactComponent(kind),
    symbol: sanitizeAnalyticsSymbol(element.dataset.symbol),
  };
}

function trackRouteActivationMilestone(pathname: string, pagePath?: string): void {
  const group = workflowGroupForPath(pathname);
  const symbol = symbolFromPath(pathname);
  if (pathname === "/terminal" || pathname.startsWith("/terminal/")) {
    trackActivationMilestone("morning_command", { routeGroup: "terminal" }, { pagePath, source: "route_activation" });
  }
  if (group === "scanner") {
    trackActivationMilestone("scanner", { routeGroup: group }, { pagePath, source: "route_activation", symbol: symbol ?? undefined });
    if (compareModeVisible()) trackActivationMilestone("compare", { routeGroup: group }, { pagePath, source: "route_activation" });
  }
  if (group === "symbol") {
    trackActivationMilestone("symbol_investigation", { routeGroup: group }, { pagePath, source: "route_activation", symbol: symbol ?? undefined });
    trackActivationMilestone("chart", { routeGroup: group }, { pagePath, source: "route_activation", symbol: symbol ?? undefined });
  }
  if (group === "replay") trackActivationMilestone("replay", { routeGroup: group }, { pagePath, source: "route_activation", symbol: symbol ?? undefined });
  if (group === "alerts") trackActivationMilestone("alert", { routeGroup: group }, { pagePath, source: "route_activation" });
  if (group === "strategy") trackActivationMilestone("strategy", { routeGroup: group }, { pagePath, source: "route_activation" });
}

function usageEventForPath(pathname: string): AnalyticsEventName | null {
  if (pathname === "/discover" || pathname.startsWith("/discover/") || pathname === "/scanner" || pathname.startsWith("/scanner/")) return "scanner_usage";
  if (pathname === "/strategy-labs" || pathname.startsWith("/strategy-labs/")) return "strategy_usage";
  return null;
}

function trackMobileEngagement(pathname: string, pagePath?: string): void {
  const group = workflowGroupForPath(pathname);
  if (!group) return;
  const currentDevice = deviceType();
  if (currentDevice !== "mobile" && currentDevice !== "tablet") return;
  trackAnalyticsEvent("mobile_engagement", { deviceType: currentDevice, routeGroup: group }, { pagePath, source: "mobile_route", symbol: symbolFromPath(pathname) ?? undefined });
}

function trackWorkflowContinuity(pathname: string, pagePath?: string): void {
  const nextGroup = workflowGroupForPath(pathname);
  if (!nextGroup) return;
  try {
    const previousGroup = window.sessionStorage.getItem(LAST_WORKFLOW_GROUP_KEY);
    window.sessionStorage.setItem(LAST_WORKFLOW_GROUP_KEY, nextGroup);
    if (!previousGroup || previousGroup === nextGroup) return;
    trackAnalyticsEvent("workflow_continuity", { from: previousGroup, to: nextGroup }, { pagePath, source: "route_continuity", symbol: symbolFromPath(pathname) ?? undefined });
  } catch {
    // Workflow continuity is proof telemetry only; route tracking must never depend on session storage.
  }
}

function trackWatchlistRetention(pathname: string, pagePath?: string): void {
  const group = workflowGroupForPath(pathname);
  if (!group || group === "support" || group === "account") return;
  try {
    const watchlist = readWatchlistStorage();
    if (!watchlist.length) return;
    const sessionId = currentSessionId() ?? "unknown";
    const key = `${WATCHLIST_RETENTION_EMITTED_KEY}:${sessionId}:${group}`;
    if (window.sessionStorage.getItem(key) === "true") return;
    window.sessionStorage.setItem(key, "true");
    trackAnalyticsEvent("watchlist_retention", { routeGroup: group, watchlistSize: watchlist.length }, { pagePath, source: "watchlist_return", symbol: symbolFromPath(pathname) ?? undefined });
  } catch {
    // Watchlist retention telemetry degrades silently when storage is unavailable.
  }
}

function trackReturnSession(pathname: string, pagePath?: string): void {
  const group = workflowGroupForPath(pathname);
  if (!group || group === "support" || group === "account") return;
  try {
    const today = localDateKey(new Date());
    const previousDay = window.localStorage.getItem(LAST_ACTIVE_DAY_KEY);
    window.localStorage.setItem(LAST_ACTIVE_DAY_KEY, today);
    const dayGap = daysBetweenLocalDates(previousDay, today);
    const watchlistSize = readWatchlistSize();
    const sessionId = currentSessionId() ?? "unknown";
    const isReturning = dayGap !== null && dayGap >= 1;

    if (isReturning) {
      const returnKind = dayGap >= 7 ? "weekly_return" : dayGap >= 2 ? "multi_day_return" : "next_day_return";
      const metadata = { dayGap, returnKind, routeGroup: group, watchlistSize };
      emitOncePerSession(`${RETURN_SESSION_EMITTED_KEY}:${sessionId}`, "return_session", metadata, pagePath, pathname, "return_session");
      if (dayGap >= 7) {
        emitOncePerSession(
          `${RETURN_WORKFLOW_EMITTED_KEY}:${sessionId}:long_return_gap`,
          "churn_risk_signal",
          { dayGap, riskType: "repeat_non_return_gap", routeGroup: group, watchlistSize },
          pagePath,
          pathname,
          "retention_detector",
        );
      }

      const workflowEvent = returnEventForGroup(group);
      if (workflowEvent) {
        emitOncePerSession(`${RETURN_WORKFLOW_EMITTED_KEY}:${sessionId}:${workflowEvent}`, workflowEvent, metadata, pagePath, pathname, "return_workflow");
      }
      if (group === "scanner") {
        emitOncePerSession(`${RETURN_WORKFLOW_EMITTED_KEY}:${sessionId}:scanner_habit_loop`, "scanner_habit_loop", metadata, pagePath, pathname, "return_workflow");
      }
      if (group === "symbol") {
        emitOncePerSession(`${RETURN_WORKFLOW_EMITTED_KEY}:${sessionId}:chart_return`, "chart_return", metadata, pagePath, pathname, "return_workflow");
      }
      if (group === "replay") {
        emitOncePerSession(`${RETURN_WORKFLOW_EMITTED_KEY}:${sessionId}:history_return`, "history_return", metadata, pagePath, pathname, "return_workflow");
      }
      if (compareModeVisible()) {
        emitOncePerSession(`${RETURN_WORKFLOW_EMITTED_KEY}:${sessionId}:compare_return`, "compare_return", metadata, pagePath, pathname, "return_workflow");
      }

      if (watchlistSize > 0 && group !== "mobile") {
        emitOncePerSession(`${RETURN_WORKFLOW_EMITTED_KEY}:${sessionId}:watchlist_return`, "watchlist_return", metadata, pagePath, pathname, "watchlist_return");
      }

      if (watchlistSize > 0 && (group === "terminal" || group === "feed" || group === "symbol" || group === "scanner")) {
        emitOncePerSession(`${PERSONALIZED_RETURN_EMITTED_KEY}:${sessionId}`, "personalized_intelligence_return", metadata, pagePath, pathname, "personalized_return");
      }
    }

    const hour = new Date().getHours();
    if (hour >= 4 && hour <= 11 && (group === "terminal" || group === "scanner" || group === "feed")) {
      const key = `${MORNING_WORKFLOW_EMITTED_KEY}:${today}:${group}`;
      if (window.localStorage.getItem(key) !== "true") {
        window.localStorage.setItem(key, "true");
        trackAnalyticsEvent("morning_workflow_start", { localHour: hour, routeGroup: group, watchlistSize }, { pagePath, source: "morning_workflow", symbol: symbolFromPath(pathname) ?? undefined });
      }
    }
  } catch {
    // Return-session telemetry must never block route analytics.
  }
}

function emitOncePerSession(
  key: string,
  eventName: AnalyticsEventName,
  metadata: Record<string, string | number | boolean | null>,
  pagePath: string | undefined,
  pathname: string,
  source: string,
): void {
  if (window.sessionStorage.getItem(key) === "true") return;
  window.sessionStorage.setItem(key, "true");
  trackAnalyticsEvent(eventName, metadata, { pagePath, source, symbol: symbolFromPath(pathname) ?? undefined });
}

function returnEventForGroup(group: ContinuityWorkflowGroup): AnalyticsEventName | null {
  if (group === "scanner") return "scanner_return";
  if (group === "replay") return "replay_return";
  if (group === "alerts") return "alert_return";
  if (group === "strategy") return "strategy_return";
  return null;
}

function compareModeVisible(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();
  return hash.includes("compare") || search.includes("compare") || search.includes("tab=compare");
}

function readActivationMilestones(): ActivationMilestone[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACTIVATION_MILESTONES_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    const output: ActivationMilestone[] = [];
    for (const item of parsed) {
      const milestone = normalizeActivationMilestone(item);
      if (milestone && !output.includes(milestone)) output.push(milestone);
    }
    return output;
  } catch {
    return [];
  }
}

function readFirstUsefulActions(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FIRST_USEFUL_ACTIONS_KEY) ?? "[]") as unknown;
    if (Array.isArray(parsed)) {
      const actions: string[] = [];
      for (const item of parsed) {
        const action = normalizeFirstUsefulActionKey(item);
        if (action && !actions.includes(action)) actions.push(action);
      }
      return actions;
    }
    const legacy = window.localStorage.getItem(FIRST_USEFUL_ACTION_KEY);
    return legacy ? ["legacy_first_action"] : [];
  } catch {
    return [];
  }
}

function normalizeFirstUsefulActionKey(value: unknown): string | null {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 64);
  return text || null;
}

function normalizeActivationMilestone(value: unknown): ActivationMilestone | null {
  const text = String(value ?? "");
  if (text === "alert" || text === "chart" || text === "compare" || text === "morning_command" || text === "replay" || text === "scanner" || text === "strategy" || text === "symbol_investigation" || text === "watchlist") return text;
  return null;
}

function readWatchlistSize(): number {
  try {
    return readWatchlistStorage().length;
  } catch {
    return 0;
  }
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetweenLocalDates(previous: string | null, current: string): number | null {
  if (!previous || !/^\d{4}-\d{2}-\d{2}$/.test(previous) || !/^\d{4}-\d{2}-\d{2}$/.test(current)) return null;
  const previousTime = utcMidnightFromLocalDate(previous);
  const currentTime = utcMidnightFromLocalDate(current);
  if (previousTime === null || currentTime === null || currentTime <= previousTime) return null;
  return Math.round((currentTime - previousTime) / DAY_MS);
}

function utcMidnightFromLocalDate(value: string): number | null {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return Date.UTC(year, month - 1, day);
}

function recordRouteContinuityMemory(pathname: string, pagePath?: string): void {
  const group = workflowGroupForPath(pathname);
  if (!group) return;
  try {
    recordEcosystemContinuityRoute(window.localStorage, {
      group,
      path: pagePath ?? pathname,
      symbol: symbolFromPath(pathname),
    });
  } catch {
    // Continuity memory is an optional local bridge and must never block route analytics.
  }
}

function workflowGroupForPath(pathname: string): ContinuityWorkflowGroup | null {
  if (pathname === "/terminal" || pathname.startsWith("/terminal/")) return "terminal";
  if (pathname === "/discover" || pathname.startsWith("/discover/") || pathname === "/scanner" || pathname.startsWith("/scanner/") || pathname === "/opportunities" || pathname.startsWith("/opportunities/")) return "scanner";
  if (pathname.startsWith("/symbol/")) return "symbol";
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "dashboard";
  if (pathname === "/intelligence" || pathname.startsWith("/intelligence/") || pathname === "/feed" || pathname.startsWith("/feed/")) return "feed";
  if (pathname === "/macro" || pathname.startsWith("/macro/")) return "macro";
  if (pathname === "/market-memory" || pathname.startsWith("/market-memory/")) return "replay";
  if (pathname === "/alerts" || pathname.startsWith("/alerts/")) return "alerts";
  if (pathname === "/history" || pathname.startsWith("/history/")) return "replay";
  if (pathname === "/strategy-labs" || pathname.startsWith("/strategy-labs/")) return "strategy";
  if (pathname === "/paper" || pathname.startsWith("/paper/")) return "paper";
  if (pathname === "/performance" || pathname.startsWith("/performance/")) return "performance";
  if (pathname === "/mobile" || pathname.startsWith("/mobile/")) return "mobile";
  if (pathname === "/support" || pathname.startsWith("/support/")) return "support";
  if (pathname === "/account" || pathname.startsWith("/account/") || pathname === "/settings" || pathname.startsWith("/settings/")) return "account";
  return null;
}

function compactComponent(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72) || "unknown";
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
      ensureSessionStartedAt(now);
      return id;
    }
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ expiresAt: now + SESSION_TTL_MS, id: next }));
    window.sessionStorage.setItem(SESSION_STARTED_AT_KEY, String(now));
    return next;
  } catch {
    return null;
  }
}

function ensureSessionStartedAt(now: number): void {
  const raw = window.sessionStorage.getItem(SESSION_STARTED_AT_KEY);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) window.sessionStorage.setItem(SESSION_STARTED_AT_KEY, String(now));
}

function sessionElapsedMs(): number {
  try {
    const now = Date.now();
    ensureSessionStartedAt(now);
    const startedAt = Number(window.sessionStorage.getItem(SESSION_STARTED_AT_KEY));
    return Number.isFinite(startedAt) ? Math.max(0, Math.round(now - startedAt)) : 0;
  } catch {
    return 0;
  }
}

function deviceType(): "desktop" | "mobile" | "tablet" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  const width = window.innerWidth;
  if (width < 640) return "mobile";
  if (width < 1100) return "tablet";
  return normalizeAnalyticsDevice("desktop");
}
