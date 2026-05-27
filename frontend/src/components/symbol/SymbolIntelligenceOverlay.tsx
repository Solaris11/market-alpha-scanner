"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { lockMobileBodyScroll } from "@/lib/client/mobile-scroll-lock";
import { installMobileViewportCssVars } from "@/lib/client/mobile-viewport";
import {
  closeSymbolCard,
  installGlobalSymbolOverlayListeners,
  resetSymbolOverlayCloseIntent,
  shouldRestoreSymbolOverlayScrollOnClose,
  useSymbolOverlayState,
} from "@/lib/symbol/symbol-overlay-store";
import {
  buildSymbolIntelligenceCard,
  type SymbolCardDataInput,
} from "@/lib/symbol/symbol-intelligence-card";
import type { SymbolDetail } from "@/lib/types";
import { SymbolIntelligenceCard } from "./SymbolIntelligenceCard";

type SymbolApiPayload = Partial<SymbolDetail> & {
  error?: string;
  limited?: boolean;
  message?: string;
};

const useSymbolLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function SymbolIntelligenceOverlay() {
  const overlay = useSymbolOverlayState();
  const [mounted, setMounted] = useState(false);
  const [detail, setDetail] = useState<Partial<SymbolDetail> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
    installGlobalSymbolOverlayListeners();
  }, []);

  useEffect(() => {
    if (!overlay.open || !overlay.symbol) {
      setDetail(null);
      setError("");
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    setDetail(null);

    async function loadSymbolDetail(symbol: string): Promise<void> {
      try {
        const response = await fetch(`/api/symbol/${encodeURIComponent(symbol)}?period=1y`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as SymbolApiPayload | null;
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setError(payload?.message ?? payload?.error ?? "Symbol packet is limited for the current account state.");
          setDetail(null);
          return;
        }
        if (payload?.limited) {
          setError(payload.message ?? "Live symbol research is limited for the current account state.");
        }
        setDetail(payload ?? null);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : "Failed to hydrate symbol packet.");
          setDetail(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadSymbolDetail(overlay.symbol);
    return () => controller.abort();
  }, [overlay.open, overlay.symbol]);

  useSymbolLayoutEffect(() => {
    if (!overlay.open) return undefined;
    const cleanupViewport = installMobileViewportCssVars();
    const unlock = lockMobileBodyScroll(overlay.scrollY, { restoreScroll: shouldRestoreSymbolOverlayScrollOnClose });

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSymbolCard();
        return;
      }
      if (event.key === "Tab") trapFocus(event, dialogRef.current);
    }

    window.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    }, 20);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      unlock();
      resetSymbolOverlayCloseIntent();
      cleanupViewport();
    };
  }, [overlay.open, overlay.scrollY]);

  const model = useMemo(() => {
    const input: SymbolCardDataInput = {
      detail,
      sourceContext: overlay.sourceContext,
      symbol: overlay.symbol ?? "",
    };
    return buildSymbolIntelligenceCard(input);
  }, [detail, overlay.sourceContext, overlay.symbol]);

  if (!mounted || !overlay.open || !overlay.symbol) return null;

  return createPortal(
    <div
      aria-labelledby="symbol-intelligence-card-title"
      aria-modal="true"
      className="tv-overlay-root fixed inset-0 z-[var(--tv-z-critical-overlay)] flex items-start justify-center overflow-hidden px-[var(--tv-overlay-inline-gap)] pb-[calc(var(--tv-mobile-nav-clearance)+var(--tv-keyboard-offset,0px)+0.75rem)] pt-[calc(var(--tv-safe-area-top)+0.75rem)] sm:pb-[var(--tv-overlay-bottom-gap)] sm:pt-[calc(var(--tv-safe-area-top)+1.5rem)]"
      data-symbol-intelligence-card="true"
      role="dialog"
    >
      <button
        aria-label="Close symbol intelligence card backdrop"
        className="tv-governed-backdrop absolute inset-0"
        onClick={() => closeSymbolCard()}
        type="button"
      />
      <div
        className="tv-governed-overlay-surface relative z-10 flex max-h-[calc(var(--tv-visual-viewport-height,100dvh)-var(--tv-safe-area-top)-var(--tv-mobile-nav-clearance)-1.5rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-[1.25rem] border bg-slate-950 shadow-2xl shadow-black/60 sm:max-h-[calc(var(--tv-visual-viewport-height,100dvh)-var(--tv-safe-area-top)-var(--tv-overlay-bottom-gap)-3rem)]"
        data-symbol-card-panel="true"
        ref={dialogRef}
      >
        <header className="tv-governed-overlay-header sticky top-0 z-20 border-b px-4 py-3 backdrop-blur-xl sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Symbol intelligence</div>
              <div className="mt-1 truncate font-mono text-lg font-black text-slate-50">{overlay.symbol}</div>
            </div>
            <button
              aria-label="Close symbol intelligence card"
              className="tv-mobile-touch-target grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100"
              onClick={() => closeSymbolCard()}
              ref={closeButtonRef}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="tv-native-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(1rem+var(--tv-safe-area-bottom)+var(--tv-keyboard-offset,0px))] sm:p-5">
          <SymbolIntelligenceCard error={error} loading={loading} model={model} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function trapFocus(event: KeyboardEvent, root: HTMLElement | null): void {
  if (!root) return;
  const focusable = Array.from(
    root.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ).filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1);
  if (!focusable.length) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
