"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DISCOVERY_OPEN_EVENT } from "@/components/discovery/DiscoveryCommandButton";
import { ResilienceStatusBanner } from "@/components/resilience/ResilienceStatusBanner";
import { lockMobileBodyScroll } from "@/lib/client/mobile-scroll-lock";
import { installMobileViewportCssVars } from "@/lib/client/mobile-viewport";
import { buildLimitedIntelligenceDiscoverySystem, type IntelligenceDiscoverySystem } from "@/lib/trading/intelligence-discovery";

type DiscoveryApiResponse = {
  limited?: boolean;
  message?: string;
  ok?: boolean;
  system?: IntelligenceDiscoverySystem;
};

const DISCOVERY_REQUEST_TIMEOUT_MS = 12_000;
const DISCOVERY_SLOW_RESPONSE_MS = 10_000;

const LazyIntelligenceDiscoveryWorkspace = dynamic(
  () => import("@/components/discovery/IntelligenceDiscoveryWorkspace").then((module) => module.IntelligenceDiscoveryWorkspace),
  {
    loading: () => <DiscoveryLoadingState />,
    ssr: false,
  },
);

export function GlobalIntelligenceDiscovery() {
  const [open, setOpen] = useState(false);
  const [system, setSystem] = useState<IntelligenceDiscoverySystem | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedLoadingMs, setElapsedLoadingMs] = useState(0);
  const [loadingStartedAt, setLoadingStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const loadedRef = useRef(false);
  const requestRef = useRef<Promise<void> | null>(null);
  const timeoutAbortRef = useRef(false);
  const reduceMotion = useReducedMotion();

  const loadDiscovery = useCallback((signal?: AbortSignal, showLoading = false): Promise<void> => {
    if (loadedRef.current) return Promise.resolve();
    if (requestRef.current) {
      if (showLoading) setLoading(true);
      return requestRef.current;
    }
    if (showLoading) {
      setLoading(true);
      setElapsedLoadingMs(0);
      setLoadingStartedAt(Date.now());
    }
    setError(null);
    const request = fetch("/api/discovery", { cache: "no-store", signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as DiscoveryApiResponse | null;
        if (!payload?.system) {
          const message = payload?.message ?? `Discovery failed with status ${response.status}.`;
          setSystem(buildLimitedIntelligenceDiscoverySystem(message));
          setError(message);
          return;
        }
        setSystem(payload.system);
        loadedRef.current = Boolean(payload.ok);
      })
      .catch((reason: unknown) => {
        const timedOut = timeoutAbortRef.current;
        if (signal?.aborted && !timedOut) return;
        const message = timedOut
          ? "Discovery request timed out. Showing a protected scanner snapshot until the next retry succeeds."
          : reason instanceof Error ? reason.message : "Discovery request failed.";
        setSystem(buildLimitedIntelligenceDiscoverySystem(message));
        setError(message);
      })
      .finally(() => {
        requestRef.current = null;
        if (!signal?.aborted || timeoutAbortRef.current) setLoading(false);
        setLoadingStartedAt(null);
        timeoutAbortRef.current = false;
      });
    requestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    function openDiscovery() {
      setOpen(true);
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "/") {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener(DISCOVERY_OPEN_EVENT, openDiscovery);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(DISCOVERY_OPEN_EVENT, openDiscovery);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      timeoutAbortRef.current = true;
      controller.abort();
    }, DISCOVERY_REQUEST_TIMEOUT_MS);
    void loadDiscovery(controller.signal, true).finally(() => window.clearTimeout(timeout));
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadDiscovery, open]);

  useEffect(() => {
    if (loadedRef.current || open) return undefined;
    const controller = new AbortController();
    const idleCallback = "requestIdleCallback" in window
      ? window.requestIdleCallback(() => {
        void loadDiscovery(controller.signal, false);
      }, { timeout: 4_000 })
      : null;
    const timeout = idleCallback === null
      ? window.setTimeout(() => {
        void loadDiscovery(controller.signal, false);
      }, 2_500)
      : null;
    return () => {
      if (idleCallback !== null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleCallback);
      if (timeout !== null) window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadDiscovery, open]);

  useEffect(() => {
    if (!open) return undefined;
    const cleanupViewport = installMobileViewportCssVars();
    const unlockBodyScroll = lockMobileBodyScroll();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      unlockBodyScroll();
      cleanupViewport();
    };
  }, [open]);

  useEffect(() => {
    if (!loading || loadingStartedAt === null) return undefined;
    const updateElapsed = (): void => setElapsedLoadingMs(Date.now() - loadingStartedAt);
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(interval);
  }, [loading, loadingStartedAt]);

  const retryDiscovery = useCallback(() => {
    loadedRef.current = false;
    requestRef.current = null;
    timeoutAbortRef.current = false;
    setSystem(null);
    setError(null);
    setRetryAttempt((attempt) => attempt + 1);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      timeoutAbortRef.current = true;
      controller.abort();
    }, DISCOVERY_REQUEST_TIMEOUT_MS);
    void loadDiscovery(controller.signal, true).finally(() => window.clearTimeout(timeout));
  }, [loadDiscovery]);

  const slowLoadingMs = loading && elapsedLoadingMs >= DISCOVERY_SLOW_RESPONSE_MS ? elapsedLoadingMs : null;

  return (
    <AnimatePresence>
      {open ? (
        <div aria-modal="true" className="tv-overlay-root fixed inset-0 overflow-hidden" role="dialog">
          <motion.button
            aria-label="Close discovery"
            animate={reduceMotion ? undefined : { opacity: 1 }}
            className="tv-governed-backdrop absolute inset-0"
            initial={reduceMotion ? false : { opacity: 0 }}
            onClick={() => setOpen(false)}
            transition={{ duration: 0.18 }}
            type="button"
          />
          <motion.section
            animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
            className="tv-global-discovery-surface tv-governed-overlay-surface tv-governed-discovery-surface absolute inset-x-0 bottom-0 top-0 mx-auto flex w-full max-w-[1700px] flex-col overflow-hidden rounded-none border-cyan-300/18 bg-slate-950 ring-1 ring-cyan-300/10 sm:inset-x-4 sm:bottom-4 sm:top-4 sm:rounded-[2rem] sm:border"
            data-mobile-gesture-ignore="true"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.985, y: 20 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="tv-governed-overlay-header sticky top-0 z-10 border-b px-4 pb-3 pt-[calc(0.85rem+env(safe-area-inset-top))] backdrop-blur-xl sm:px-6 sm:pt-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-300">Global command search</div>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Discover market intelligence</h2>
                  <p className="mt-1 text-xs text-slate-500">Search, scan, filter, compare, and open symbol research without leaving your current workflow.</p>
                </div>
                <button className="tv-governed-icon-button tv-mobile-touch-target grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:text-cyan-100" onClick={() => setOpen(false)} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>
            <div className="tv-native-scroll tv-mobile-safe-bottom min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              <ResilienceStatusBanner
                className="mb-3"
                errorMessage={error}
                loadingMs={slowLoadingMs}
                onRetry={retryDiscovery}
                partialData={Boolean(system?.limited)}
                retryAttempt={retryAttempt}
                surface="discovery"
              />
              {loading && !system ? (
                <DiscoveryLoadingState />
              ) : (
                <LazyIntelligenceDiscoveryWorkspace mode="overlay" system={system ?? buildLimitedIntelligenceDiscoverySystem(error ?? "Discovery is unavailable.")} />
              )}
            </div>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function DiscoveryLoadingState() {
  return (
    <div className="grid min-h-[55dvh] place-items-center rounded-3xl border border-cyan-300/16 bg-cyan-300/[0.05] text-center">
      <div>
        <div className="mx-auto h-12 w-12 animate-pulse rounded-full border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_48px_rgba(34,211,238,0.22)]" />
        <div className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-cyan-100">Loading discovery universe</div>
        <p className="mt-2 text-xs text-slate-500">Fetching validated scanner context.</p>
      </div>
    </div>
  );
}
