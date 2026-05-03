"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { UserNotification } from "@/lib/notifications";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type NotificationsResponse = {
  notifications?: UserNotification[];
  ok?: boolean;
  unreadCount?: number;
};

export function NotificationBell() {
  const { authenticated, loading } = useCurrentUser();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [fetching, setFetching] = useState(false);

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
      setNotifications(payload.notifications ?? []);
      setUnreadCount(payload.unreadCount ?? 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
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
    const viewportHeight = window.innerHeight;
    const top = Math.min(rect.bottom + 8, viewportHeight - margin);
    const right = Math.max(margin, viewportWidth - rect.right);
    setMenuStyle({
      maxHeight: "calc(100vh - 48px)",
      maxWidth: `calc(100vw - ${margin * 2}px)`,
      overflowY: "auto",
      position: "fixed",
      right,
      top,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  if (!authenticated || loading) return null;

  async function markRead(notification: UserNotification) {
    if (notification.read) return;
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
    }
  }

  async function markAllRead() {
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    try {
      const response = await csrfFetch("/api/notifications/read-all", { method: "POST" });
      if (!response.ok) throw new Error("Unable to mark all notifications read.");
    } catch {
      void loadNotifications();
    }
  }

  return (
    <div>
      <button
        ref={buttonRef}
        aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-sm text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-cyan-100"
        onClick={() => {
          updateMenuPosition();
          setOpen((value) => !value);
          void loadNotifications();
        }}
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
            <div
              ref={menuRef}
              className="z-[9000] rounded-2xl border border-white/10 bg-slate-950/95 p-2 text-xs text-slate-300 shadow-2xl shadow-black/40 ring-1 ring-cyan-300/10 backdrop-blur-xl"
              style={menuStyle}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
                <div>
                  <div className="font-semibold text-slate-100">Notifications</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{unreadCount ? `${unreadCount} unread` : "All caught up"}</div>
                </div>
                {unreadCount ? (
                  <button className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-cyan-100 hover:bg-cyan-400/10" onClick={() => void markAllRead()} type="button">
                    Mark all read
                  </button>
                ) : null}
              </div>
              <div className="max-h-[460px] overflow-y-auto py-1">
                {fetching && !notifications.length ? <div className="px-3 py-6 text-center text-slate-500">Loading notifications...</div> : null}
                {!fetching && !notifications.length ? <div className="px-3 py-6 text-center text-slate-500">No notifications yet.</div> : null}
                {notifications.map((notification) => (
                  <button
                    className={`mt-1 w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.06] ${
                      notification.read ? "text-slate-400" : "border border-cyan-300/15 bg-cyan-400/[0.07] text-slate-100"
                    }`}
                    key={notification.id}
                    onClick={() => void markRead(notification)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{notification.title}</div>
                        <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{notification.message}</div>
                      </div>
                      {!notification.read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300" /> : null}
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-600">{formatTimestamp(notification.createdAt)}</div>
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
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
