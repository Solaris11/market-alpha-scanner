"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { notificationDisplayMessage, type NotificationFeedbackValue, type UserNotification } from "@/lib/notifications";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import { trackAnalyticsEvent } from "@/lib/client/analytics";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { installMobileViewportCssVars } from "@/lib/client/mobile-viewport";

type NotificationsResponse = {
  notifications?: UserNotification[];
  ok?: boolean;
  unreadCount?: number;
};

const NOTIFICATION_DRAWER_OPEN_EVENT = "tradeveto:notifications-open";

export function NotificationBell() {
  const router = useRouter();
  const { authenticated, loading } = useCurrentUser();
  const instanceId = useId();
  const menuId = useId();
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [feedbackById, setFeedbackById] = useState<Record<string, NotificationFeedbackValue>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!authenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setFetching(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as NotificationsResponse | null;
      if (!response.ok || !payload?.ok) throw new Error("Notifications unavailable.");
      const loadedNotifications = payload.notifications ?? [];
      setNotifications(rankNotificationsForRetention(loadedNotifications));
      setUnreadCount(payload.unreadCount ?? 0);
      setFeedbackById(feedbackMapFromNotifications(loadedNotifications));
    } catch {
      setNotifications([]);
      setUnreadCount(0);
      setFeedbackById({});
    } finally {
      setFetching(false);
    }
  }, [authenticated]);

  useEffect(() => {
    if (!loading) void loadNotifications();
  }, [loadNotifications, loading]);

  const updateMenuPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 16;
    const width = 340;
    const viewportWidth = window.innerWidth;
    const visualViewport = window.visualViewport;
    const viewportHeight = Math.min(visualViewport?.height ?? window.innerHeight, window.innerHeight);
    const isMobile = viewportWidth < 640;
    setMobileMenu(isMobile);
    if (isMobile) {
      setMenuStyle({
        bottom: "calc(var(--tv-mobile-nav-clearance) + var(--tv-keyboard-offset, 0px) + 0.75rem)",
        left: "var(--tv-overlay-inline-gap)",
        maxHeight: "var(--tv-mobile-nav-overlay-available-height)",
        position: "fixed",
        right: "var(--tv-overlay-inline-gap)",
        top: "var(--tv-overlay-top-gap)",
        width: "auto",
      });
      return;
    }
    const top = Math.min(rect.bottom + 8, Math.max(margin, viewportHeight - margin));
    const right = Math.max(margin, viewportWidth - rect.right);
    const availableHeight = Math.max(220, viewportHeight - top - margin);
    setMenuStyle({
      maxHeight: `${availableHeight}px`,
      maxWidth: `calc(100vw - ${margin * 2}px)`,
      position: "fixed",
      right,
      top,
      width,
    });
  }, []);

  const emitIgnoredNotifications = useCallback((reason: string) => {
    const ignoredUnread = notifications.filter((notification) => !notification.read);
    if (!ignoredUnread.length) return;
    const topNotification = ignoredUnread[0] ?? null;
    trackAnalyticsEvent("notification_engagement", {
      action: "ignored",
      ignoredCount: ignoredUnread.length,
      reason,
      topCategory: topNotification?.context.feedCategory ?? topNotification?.type ?? "unknown",
      topSeverity: topNotification?.context.feedSeverity ?? "unknown",
      unreadCount,
      visibleCount: notifications.length,
    }, { source: "notification_bell" });
    if (ignoredUnread.length >= 3) {
      trackAnalyticsEvent("churn_risk_signal", {
        ignoredCount: ignoredUnread.length,
        reason,
        riskType: "notification_fatigue",
      }, { source: "notification_bell" });
    }
  }, [notifications, unreadCount]);

  const closeNotifications = useCallback((options: { reason?: string; restoreFocus?: boolean; trackIgnored?: boolean } = {}) => {
    const restoreFocus = options.restoreFocus ?? true;
    if (options.trackIgnored ?? true) emitIgnoredNotifications(options.reason ?? "close_drawer");
    setOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => {
        buttonRef.current?.focus({ preventScroll: true });
      }, 0);
    }
  }, [emitIgnoredNotifications]);

  const toggleNotifications = useCallback(() => {
    updateMenuPosition();
    if (open) {
      trackAnalyticsEvent("notification_engagement", { action: "close_menu", unreadCount }, { source: "notification_bell" });
      closeNotifications({ reason: "bell_toggle" });
      return;
    }
    window.dispatchEvent(new CustomEvent(NOTIFICATION_DRAWER_OPEN_EVENT, { detail: instanceId }));
    trackAnalyticsEvent("notification_engagement", { action: "opened", unreadCount }, { source: "notification_bell" });
    setOpen(true);
    void loadNotifications();
  }, [closeNotifications, instanceId, loadNotifications, open, unreadCount, updateMenuPosition]);

  useLayoutEffect(() => {
    if (open) updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    function onPeerDrawerOpen(event: Event) {
      if (!(event instanceof CustomEvent) || event.detail === instanceId) return;
      setOpen(false);
    }

    window.addEventListener(NOTIFICATION_DRAWER_OPEN_EVENT, onPeerDrawerOpen);
    return () => {
      window.removeEventListener(NOTIFICATION_DRAWER_OPEN_EVENT, onPeerDrawerOpen);
    };
  }, [instanceId]);

  useEffect(() => {
    if (!open) return;
    const cleanupViewport = installMobileViewportCssVars();

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      closeNotifications({ reason: "outside_click" });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeNotifications({ reason: "escape_key" });
      }
    }

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      cleanupViewport();
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [closeNotifications, open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  if (!authenticated || loading) return null;

  async function markRead(notification: UserNotification) {
    if (!notification.read) {
      setNotifications((items) => items.map((item) => (item.id === notification.id ? { ...item, read: true } : item)));
      setUnreadCount((count) => Math.max(0, count - 1));
      try {
        const response = await csrfFetch("/api/notifications/read", {
          body: JSON.stringify({ id: notification.id }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!response.ok) throw new Error("Unable to mark notification read.");
      } catch {
        void loadNotifications();
        return;
      }
    }

    trackAnalyticsEvent("notification_engagement", {
      action: notification.actionUrl ? "open_action" : "mark_read",
      notificationId: notification.id,
      notificationType: notification.type,
      wasUnread: !notification.read,
    }, { source: "notification_bell" });

    if (notification.actionUrl) {
      trackNotificationReturn(notification);
      closeNotifications({ restoreFocus: false, trackIgnored: false });
      router.push(notification.actionUrl);
    }
  }

  async function markAllRead() {
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    trackAnalyticsEvent("notification_engagement", { action: "mark_all_read", unreadCount }, { source: "notification_bell" });
    if (unreadCount >= 5) {
      trackAnalyticsEvent("churn_risk_signal", {
        action: "bulk_notification_clear",
        riskType: "notification_fatigue",
        unreadCount,
      }, { source: "notification_bell" });
    }
    try {
      const response = await csrfFetch("/api/notifications/read-all", { method: "POST" });
      if (!response.ok) throw new Error("Unable to mark all notifications read.");
    } catch {
      void loadNotifications();
    }
  }

  async function trackNotificationFeedback(notification: UserNotification, value: NotificationFeedbackValue): Promise<void> {
    const previous = feedbackById[notification.id] ?? null;
    setFeedbackById((items) => ({ ...items, [notification.id]: value }));
    setNotifications((items) => rankNotificationsForRetention(items.map((item) => (item.id === notification.id ? { ...item, feedback: value } : item))));
    const action = value === "useful" ? "useful_feedback" : "not_useful_feedback";
    const fatigueSignal = value === "not_useful";
    const categoryQuality = value === "useful" ? "positive" : "fatigue";
    trackAnalyticsEvent("notification_usefulness_feedback", {
      action,
      categoryQuality,
      fatigueSignal,
      feedback: value,
      feedCategory: notification.context.feedCategory ?? "unknown",
      feedSeverity: notification.context.feedSeverity ?? "unknown",
      hasActionUrl: Boolean(notification.actionUrl),
      notificationId: notification.id,
      notificationType: notification.type,
      sourceKey: notification.context.sourceKey ?? "unknown",
      wasUnread: !notification.read,
    }, { source: "notification_bell" });
    trackAnalyticsEvent("notification_engagement", {
      action,
      feedback: value,
      feedCategory: notification.context.feedCategory ?? "unknown",
      notificationId: notification.id,
      notificationType: notification.type,
      wasUnread: !notification.read,
    }, { source: "notification_bell" });
    if (fatigueSignal) {
      trackAnalyticsEvent("churn_risk_signal", {
        action: "notification_not_useful",
        feedCategory: notification.context.feedCategory ?? "unknown",
        notificationId: notification.id,
        riskType: "notification_fatigue",
      }, { source: "notification_bell" });
    }

    try {
      const response = await csrfFetch("/api/notifications/feedback", {
        body: JSON.stringify({
          feedback: value,
          id: notification.id,
          metadata: {
            action,
            actionPath: notification.actionUrl ?? "none",
            adaptivePriority: notification.context.adaptivePriority ?? "none",
            categoryQuality,
            feedCategory: notification.context.feedCategory ?? "unknown",
            feedSeverity: notification.context.feedSeverity ?? "unknown",
            fatigueSignal,
            hasActionUrl: Boolean(notification.actionUrl),
            notificationType: notification.type,
            returnAttribution: notification.actionUrl ? "action_url" : "none",
            sourceKey: notification.context.sourceKey ?? "unknown",
          },
          source: "notification_bell",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("Unable to record notification feedback.");
    } catch {
      setFeedbackById((items) => {
        const next = { ...items };
        if (previous) {
          next[notification.id] = previous;
        } else {
          delete next[notification.id];
        }
        return next;
      });
      setNotifications((items) => rankNotificationsForRetention(items.map((item) => (item.id === notification.id ? { ...item, feedback: previous } : item))));
      trackAnalyticsEvent("failed_action", {
        component: "notification_feedback",
        notificationId: notification.id,
        reason: "request_failed",
      }, { source: "notification_bell" });
    }
  }

  return (
    <div data-sensitive>
      <button
        ref={buttonRef}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
        className={`tv-tap-motion relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-sm text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-cyan-100 ${unreadCount ? "tv-alert-pulse" : ""}`}
        data-notification-bell="true"
        onClick={toggleNotifications}
        type="button"
      >
        🔔
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full border border-slate-950 bg-cyan-300 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open && mounted
        ? createPortal(
            <>
              <div
                aria-hidden="true"
                className={`${mobileMenu ? "tv-notification-backdrop" : "tv-notification-click-layer"} fixed inset-0`}
              />
              <div
                ref={menuRef}
                aria-labelledby={titleId}
                aria-modal="true"
                className="tv-drawer-surface tv-notification-menu rounded-2xl border border-white/10 bg-slate-950/95 p-2 text-xs text-slate-300 shadow-2xl shadow-black/40 ring-1 ring-cyan-300/10 backdrop-blur-xl"
                data-mobile-gesture-ignore="true"
                id={menuId}
                role="dialog"
                style={menuStyle}
              >
                <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-950/95 px-3 py-2 backdrop-blur-xl">
                  <div>
                    <div className="font-semibold text-slate-100" id={titleId}>Notifications</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{unreadCount ? `${unreadCount} unread` : "All caught up"}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {unreadCount ? (
                      <button className="tv-mobile-touch-target rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-cyan-100 hover:bg-cyan-400/10" onClick={() => void markAllRead()} type="button">
                        Mark all read
                      </button>
                    ) : null}
                    <button
                      ref={closeButtonRef}
                      aria-label="Close notifications"
                      className="tv-mobile-touch-target grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-cyan-100"
                      onClick={() => closeNotifications({ reason: "close_button" })}
                      type="button"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="tv-notification-scroll py-1">
                  {fetching && !notifications.length ? <div className="px-3 py-6 text-center text-slate-500">Loading notifications...</div> : null}
                  {!fetching && !notifications.length ? <div className="px-3 py-6 text-center text-slate-500">No notifications yet.</div> : null}
                  {notifications.map((notification) => {
                    const feedback = feedbackById[notification.id] ?? null;
                    const retentionContext = notificationRetentionContext(notification);
                    return (
                      <div
                        className={`mt-1 rounded-xl transition ${
                          notification.read ? "text-slate-400" : "border border-cyan-300/15 bg-cyan-400/[0.07] text-slate-100"
                        }`}
                        key={notification.id}
                      >
                        <button
                          className="tv-tap-motion w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.06]"
                          onClick={() => void markRead(notification)}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="break-words font-semibold leading-5">{notification.title}</div>
                              <div className="mt-1 break-words text-[11px] leading-4 text-slate-400">{notificationDisplayMessage(notification)}</div>
                              <div className="mt-2 grid gap-1 rounded-xl border border-white/10 bg-black/15 p-2 text-[10px] leading-4 text-slate-500">
                                <div><span className="font-black uppercase tracking-[0.12em] text-cyan-200">Why</span> {retentionContext.why}</div>
                                <div><span className="font-black uppercase tracking-[0.12em] text-cyan-200">Changed</span> {retentionContext.changed}</div>
                                <div><span className="font-black uppercase tracking-[0.12em] text-cyan-200">Matters</span> {retentionContext.matters}</div>
                                <div><span className="font-black uppercase tracking-[0.12em] text-cyan-200">Next</span> {retentionContext.next}</div>
                              </div>
                            </div>
                            {!notification.read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300" /> : null}
                          </div>
                          <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-600">{formatTimestamp(notification.createdAt)}</div>
                        </button>
                        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
                          <span className="text-[10px] uppercase tracking-[0.16em] text-slate-600">Was this useful?</span>
                          <button
                            className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                              feedback === "useful" ? "border-emerald-300/45 bg-emerald-300/15 text-emerald-100" : "border-white/10 bg-black/15 text-slate-400 hover:border-emerald-300/35 hover:text-emerald-100"
                            }`}
                            aria-pressed={feedback === "useful"}
                            onClick={() => void trackNotificationFeedback(notification, "useful")}
                            type="button"
                          >
                            Useful
                          </button>
                          <button
                            className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                              feedback === "not_useful" ? "border-amber-300/45 bg-amber-300/15 text-amber-100" : "border-white/10 bg-black/15 text-slate-400 hover:border-amber-300/35 hover:text-amber-100"
                            }`}
                            aria-pressed={feedback === "not_useful"}
                            onClick={() => void trackNotificationFeedback(notification, "not_useful")}
                            type="button"
                          >
                            Not useful
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

function feedbackMapFromNotifications(notifications: UserNotification[]): Record<string, NotificationFeedbackValue> {
  const feedback: Record<string, NotificationFeedbackValue> = {};
  for (const notification of notifications) {
    if (notification.feedback) feedback[notification.id] = notification.feedback;
  }
  return feedback;
}

function rankNotificationsForRetention(notifications: UserNotification[]): UserNotification[] {
  return [...notifications].sort((left, right) => {
    const leftScore = notificationRetentionPriority(left);
    const rightScore = notificationRetentionPriority(right);
    if (leftScore !== rightScore) return rightScore - leftScore;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function notificationRetentionPriority(notification: UserNotification): number {
  let score = notification.read ? 10 : 40;
  if (notification.feedback === "not_useful") score -= 35;
  if (notification.feedback === "useful") score += 20;
  if (notification.actionUrl) score += 12;
  if (notification.context.adaptivePriority === "high") score += 18;
  if (notification.context.feedSeverity === "high") score += 10;
  return score;
}

function notificationRetentionContext(notification: UserNotification): { changed: string; matters: string; next: string; why: string } {
  const category = notification.context.feedCategory ?? notification.type;
  const severity = notification.context.feedSeverity ?? "normal";
  const priority = notification.context.adaptivePriority ?? "standard";
  const source = notification.context.sourceKey ?? "TradeVeto";
  const workflow = workflowLabelForNotification(notification.actionUrl);
  return {
    changed: `${category} signal updated with ${severity} severity from ${source}.`,
    matters: `${priority} priority means this was ranked for ${workflow} review, not sent as a generic broadcast.`,
    next: notification.actionUrl ? `Open ${workflow}, complete one useful action, then rate the notification.` : "Review it here, then mark useful or not useful so low-value categories can be reduced.",
    why: `${source} context matched the current alert, watchlist, feed, or workflow memory rules.`,
  };
}

function workflowLabelForNotification(actionUrl: string | null): string {
  if (!actionUrl) return "notification";
  if (actionUrl.startsWith("/alerts")) return "alert follow-up";
  if (actionUrl.startsWith("/discover") || actionUrl.startsWith("/scanner") || actionUrl.startsWith("/opportunities")) return "scanner";
  if (actionUrl.startsWith("/history") || actionUrl.startsWith("/market-memory")) return "replay";
  if (actionUrl.startsWith("/symbol/")) return "symbol research";
  if (actionUrl.startsWith("/terminal")) return "morning briefing";
  if (actionUrl.startsWith("/macro")) return "macro";
  if (actionUrl.startsWith("/feed")) return "feed";
  return "linked workflow";
}

function trackNotificationReturn(notification: UserNotification): void {
  const actionUrl = notification.actionUrl;
  if (!actionUrl) return;
  const metadata = {
    action: "converted",
    actionPath: actionUrl,
    feedCategory: notification.context.feedCategory ?? "unknown",
    feedSeverity: notification.context.feedSeverity ?? "unknown",
    notificationId: notification.id,
    notificationType: notification.type,
    sourceKey: notification.context.sourceKey ?? "unknown",
  };
  trackAnalyticsEvent("notification_engagement", metadata, { source: "notification_bell" });
  if (actionUrl.startsWith("/alerts")) {
    trackAnalyticsEvent("alert_return", metadata, { source: "notification_bell" });
    return;
  }
  if (actionUrl.startsWith("/discover") || actionUrl.startsWith("/scanner") || actionUrl.startsWith("/opportunities")) {
    trackAnalyticsEvent("scanner_return", metadata, { source: "notification_bell" });
    return;
  }
  if (actionUrl.startsWith("/history") || actionUrl.startsWith("/market-memory")) {
    trackAnalyticsEvent("replay_return", metadata, { source: "notification_bell" });
    return;
  }
  if (actionUrl.startsWith("/symbol/") || actionUrl.startsWith("/terminal") || actionUrl.startsWith("/feed") || actionUrl.startsWith("/macro")) {
    trackAnalyticsEvent("personalized_intelligence_return", metadata, { source: "notification_bell" });
    if (actionUrl.startsWith("/symbol/")) trackAnalyticsEvent("symbol_return", metadata, { source: "notification_bell" });
    if (actionUrl.startsWith("/terminal")) trackAnalyticsEvent("briefing_return", metadata, { source: "notification_bell" });
  }
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}
