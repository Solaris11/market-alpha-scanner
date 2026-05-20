"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MOBILE_BOTTOM_NAV_ITEMS, isActivePath } from "@/lib/navigation";

type TouchPoint = {
  target: EventTarget | null;
  time: number;
  x: number;
  y: number;
};

const MIN_HORIZONTAL_SWIPE = 78;
const MAX_VERTICAL_DRIFT = 54;
const MAX_SWIPE_MS = 680;

export function MobileNativeGestureLayer() {
  const pathname = usePathname();
  const router = useRouter();
  const [hint, setHint] = useState<string | null>(null);
  const routes = useMemo(() => MOBILE_BOTTOM_NAV_ITEMS.map((item) => ({ href: item.href, label: item.key === "opportunities" ? "Ideas" : item.key === "discover" ? "Scanner" : item.label })), []);

  useEffect(() => {
    let start: TouchPoint | null = null;
    let hintTimer: number | null = null;

    function clearHintSoon(): void {
      if (hintTimer !== null) window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => setHint(null), 1150);
    }

    function onTouchStart(event: TouchEvent): void {
      if (event.touches.length !== 1) {
        start = null;
        return;
      }
      const touch = event.touches[0];
      if (!touch || shouldIgnoreGesture(event.target)) {
        start = null;
        return;
      }
      start = {
        target: event.target,
        time: Date.now(),
        x: touch.clientX,
        y: touch.clientY,
      };
    }

    function onTouchEnd(event: TouchEvent): void {
      if (!start) return;
      const changed = event.changedTouches[0];
      if (!changed) {
        start = null;
        return;
      }
      const elapsed = Date.now() - start.time;
      const deltaX = changed.clientX - start.x;
      const deltaY = changed.clientY - start.y;
      const initialTarget = start.target;
      start = null;
      if (elapsed > MAX_SWIPE_MS) return;
      if (Math.abs(deltaX) < MIN_HORIZONTAL_SWIPE || Math.abs(deltaY) > MAX_VERTICAL_DRIFT) return;
      if (shouldIgnoreGesture(initialTarget)) return;

      const activeIndex = routes.findIndex((item) => isActivePath(pathname, item.href));
      if (activeIndex < 0) return;
      const nextIndex = deltaX < 0 ? activeIndex + 1 : activeIndex - 1;
      const next = routes[nextIndex];
      if (!next) return;
      setHint(deltaX < 0 ? `Next: ${next.label}` : `Back: ${next.label}`);
      clearHintSoon();
      router.push(next.href);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      if (hintTimer !== null) window.clearTimeout(hintTimer);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pathname, router, routes]);

  if (!hint) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(5.9rem+env(safe-area-inset-bottom))] z-[8490] flex justify-center xl:hidden">
      <div className="rounded-full border border-cyan-300/25 bg-slate-950/88 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-100 shadow-2xl shadow-black/40 backdrop-blur-xl">
        {hint}
      </div>
    </div>
  );
}

function shouldIgnoreGesture(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest("[data-stable-overlay='true']")) return true;
  if (target.closest("[data-mobile-gesture-ignore='true']")) return true;
  if (target.closest("input, textarea, select, button, [contenteditable='true']")) return true;
  return Boolean(nearestHorizontalScroller(target));
}

function nearestHorizontalScroller(element: Element): Element | null {
  let node: Element | null = element;
  while (node && node !== document.body) {
    if (node.scrollWidth > node.clientWidth + 12) return node;
    node = node.parentElement;
  }
  return null;
}
