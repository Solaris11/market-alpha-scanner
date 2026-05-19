"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DISCOVERY_OPEN_EVENT } from "@/components/discovery/DiscoveryCommandButton";
import { IntelligenceDiscoveryWorkspace } from "@/components/discovery/IntelligenceDiscoveryWorkspace";
import { buildLimitedIntelligenceDiscoverySystem, type IntelligenceDiscoverySystem } from "@/lib/trading/intelligence-discovery";

type DiscoveryApiResponse = {
  limited?: boolean;
  message?: string;
  ok?: boolean;
  system?: IntelligenceDiscoverySystem;
};

export function GlobalIntelligenceDiscovery() {
  const [open, setOpen] = useState(false);
  const [system, setSystem] = useState<IntelligenceDiscoverySystem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const reduceMotion = useReducedMotion();

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
    setLoading(true);
    setError(null);
    fetch("/api/discovery", { cache: "no-store", signal: controller.signal })
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
        if (controller.signal.aborted) return;
        const message = reason instanceof Error ? reason.message : "Discovery request failed.";
        setSystem(buildLimitedIntelligenceDiscoverySystem(message));
        setError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <div aria-modal="true" className="fixed inset-0 z-[10040] overflow-hidden" role="dialog">
          <motion.button
            aria-label="Close discovery"
            animate={reduceMotion ? undefined : { opacity: 1 }}
            className="absolute inset-0 bg-slate-950/82 backdrop-blur-lg"
            initial={reduceMotion ? false : { opacity: 0 }}
            onClick={() => setOpen(false)}
            transition={{ duration: 0.18 }}
            type="button"
          />
          <motion.section
            animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
            className="absolute inset-x-0 bottom-0 top-0 mx-auto flex w-full max-w-[1700px] flex-col overflow-hidden rounded-none border-cyan-300/18 bg-slate-950 shadow-2xl shadow-black/80 ring-1 ring-cyan-300/10 sm:inset-x-4 sm:bottom-4 sm:top-4 sm:rounded-[2rem] sm:border"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.985, y: 20 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/94 px-4 py-3 backdrop-blur-xl sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-300">Global command search</div>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Discover market intelligence</h2>
                  <p className="mt-1 text-xs text-slate-500">Search, scan, filter, compare, and open symbol research without leaving your current workflow.</p>
                </div>
                <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35 hover:text-cyan-100" onClick={() => setOpen(false)} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              {loading && !system ? (
                <div className="grid min-h-[55dvh] place-items-center rounded-3xl border border-cyan-300/16 bg-cyan-300/[0.05] text-center">
                  <div>
                    <div className="mx-auto h-12 w-12 animate-pulse rounded-full border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_48px_rgba(34,211,238,0.22)]" />
                    <div className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-cyan-100">Loading discovery universe</div>
                    <p className="mt-2 text-xs text-slate-500">Fetching validated scanner context.</p>
                  </div>
                </div>
              ) : (
                <IntelligenceDiscoveryWorkspace mode="overlay" system={system ?? buildLimitedIntelligenceDiscoverySystem(error ?? "Discovery is unavailable.")} />
              )}
            </div>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
