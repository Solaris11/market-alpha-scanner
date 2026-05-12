"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";

const HIGH_PRIORITY_ROUTES = [
  "/terminal",
  "/opportunities",
  "/performance",
  "/history",
  "/dashboard",
  "/paper",
  "/strategy-labs",
  "/mobile",
  "/account",
] as const;

const NAVIGATION_EVENT = "tradeveto:navigation-start";

type NavigationEventDetail = {
  href: string;
  label?: string;
};

function routeFromHref(href: string): string {
  if (!href) return "/";
  if (href.startsWith("#")) return href;
  try {
    const url = new URL(href, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return href;
  }
}

function sameRoute(pathname: string, href: string): boolean {
  if (!href || href.startsWith("#")) return true;
  try {
    const url = new URL(href, window.location.origin);
    if (url.pathname === pathname && url.hash && !url.search) return true;
    return url.pathname === pathname && !url.search && !url.hash;
  } catch {
    return href === pathname;
  }
}

function shouldIgnoreNavigationClick(event: MouseEvent<HTMLElement>): boolean {
  return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function dispatchNavigationStart(detail: NavigationEventDetail): void {
  window.dispatchEvent(new CustomEvent<NavigationEventDetail>(NAVIGATION_EVENT, { detail }));
}

export function useNavigationIntent(href: string, label?: string) {
  const pathname = usePathname();
  const router = useRouter();
  const prefetched = useRef(false);

  const prefetch = useCallback(() => {
    if (prefetched.current || href.startsWith("#")) return;
    prefetched.current = true;
    router.prefetch(routeFromHref(href));
  }, [href, router]);

  const onPointerEnter = useCallback(
    (_event: PointerEvent<HTMLElement>) => {
      prefetch();
    },
    [prefetch],
  );

  const onFocus = useCallback(() => {
    prefetch();
  }, [prefetch]);

  const onClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (shouldIgnoreNavigationClick(event) || sameRoute(pathname, href)) return;
      prefetch();
      dispatchNavigationStart({ href, label });
    },
    [href, label, pathname, prefetch],
  );

  return { onClick, onFocus, onPointerEnter, prefetch };
}

export function FastNavigationLink({
  children,
  className,
  href,
  label,
}: {
  children: ReactNode;
  className?: string;
  href: string;
  label?: string;
}) {
  const navigationIntent = useNavigationIntent(href, label);
  return (
    <Link
      className={className}
      href={href}
      onClick={navigationIntent.onClick}
      onFocus={navigationIntent.onFocus}
      onPointerEnter={navigationIntent.onPointerEnter}
      prefetch
    >
      {children}
    </Link>
  );
}

export function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const prefetchAll = () => {
      for (const route of HIGH_PRIORITY_ROUTES) {
        if (cancelled) return;
        router.prefetch(route);
      }
    };

    const idleCallback = window.requestIdleCallback?.(() => prefetchAll(), { timeout: 1800 });
    const timeout = idleCallback === undefined ? window.setTimeout(prefetchAll, 900) : null;

    return () => {
      cancelled = true;
      if (idleCallback !== undefined) window.cancelIdleCallback?.(idleCallback);
      if (timeout !== null) window.clearTimeout(timeout);
    };
  }, [router]);

  return null;
}

export function RouteTransitionFeedback() {
  const pathname = usePathname();
  const [pending, setPending] = useState<NavigationEventDetail | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    function clearPendingSoon() {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setPending(null), 160);
    }

    clearPendingSoon();
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [pathname]);

  useEffect(() => {
    function onNavigationStart(event: Event) {
      const detail = event instanceof CustomEvent ? (event.detail as NavigationEventDetail | undefined) : undefined;
      setPending({ href: detail?.href ?? "", label: detail?.label });
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setPending(null), 4500);
    }

    window.addEventListener(NAVIGATION_EVENT, onNavigationStart);
    return () => window.removeEventListener(NAVIGATION_EVENT, onNavigationStart);
  }, []);

  if (!pending) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9500]" role="status" aria-live="polite">
      <div className="h-0.5 w-full overflow-hidden bg-cyan-950/30">
        <div className="tradeveto-route-progress h-full w-2/3 rounded-r-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.75)]" />
      </div>
      <div className="mx-auto mt-2 hidden max-w-[1780px] px-4 sm:block">
        <div className="inline-flex rounded-full border border-cyan-300/20 bg-slate-950/90 px-3 py-1 text-[11px] font-semibold text-cyan-100 shadow-lg shadow-black/30 backdrop-blur">
          {pending.label ? `Opening ${pending.label}` : "Opening workspace"}
        </div>
      </div>
    </div>
  );
}
