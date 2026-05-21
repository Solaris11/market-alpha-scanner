"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, useReducedMotion, type PanInfo, type Transition } from "motion/react";
import { trackModalAbandon, trackModalClose, trackModalOpen } from "@/lib/client/analytics";
import { lockMobileBodyScroll } from "@/lib/client/mobile-scroll-lock";
import { installMobileViewportCssVars } from "@/lib/client/mobile-viewport";

type StableDetailOverlaySize = "md" | "lg" | "xl";

type StableDetailOverlayProps = {
  analyticsSurface?: string;
  backdropCloses?: boolean;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  onClose: () => void;
  open: boolean;
  size?: StableDetailOverlaySize;
  title: ReactNode;
};

const WIDTH_CLASS: Record<StableDetailOverlaySize, string> = {
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

let stableTriggerScrollY: number | null = null;
let stableTriggerCapturedAt = 0;
let stableTriggerCaptureInstalled = false;
let lastSettledScrollY = 0;
let lastScrollEventAt = 0;
let settleScrollTimer: number | null = null;
let scrollSamples: Array<{ at: number; y: number }> = [];

const SCROLL_LOOKBACK_MS = 90;
const SCROLL_CAPTURE_GRACE_MS = 110;
const SCROLL_SAMPLE_LIMIT = 48;

function rememberScrollSample(): void {
  const sample = { at: Date.now(), y: window.scrollY };
  scrollSamples = [...scrollSamples.slice(-(SCROLL_SAMPLE_LIMIT - 1)), sample];
}

function getLookbackScrollY(): number {
  const cutoff = Date.now() - SCROLL_LOOKBACK_MS;
  for (let index = scrollSamples.length - 1; index >= 0; index -= 1) {
    const sample = scrollSamples[index];
    if (sample && sample.at <= cutoff) return sample.y;
  }
  return scrollSamples[0]?.y ?? window.scrollY;
}

function getInteractionSafeScrollY(): number {
  if (Date.now() - lastScrollEventAt < SCROLL_CAPTURE_GRACE_MS) {
    const lookbackScrollY = getLookbackScrollY();
    if (Math.abs(window.scrollY - lookbackScrollY) > 2) return lookbackScrollY;
    return lastSettledScrollY;
  }
  return window.scrollY;
}

function rememberStableTriggerPosition(target: EventTarget | null): void {
  if (!(target instanceof Element)) return;
  if (!target.closest('[data-stable-overlay-trigger="true"]')) return;
  const nextScrollY = getTriggerAwareScrollY(target);
  const duplicateEvent = stableTriggerScrollY !== null
    && Date.now() - stableTriggerCapturedAt < 800
    && Math.abs(nextScrollY - stableTriggerScrollY) <= 8;
  if (duplicateEvent) return;
  stableTriggerScrollY = nextScrollY;
  stableTriggerCapturedAt = Date.now();
}

function getTriggerAwareScrollY(target: Element): number {
  const rect = target.getBoundingClientRect();
  const visiblyTapped = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  return visiblyTapped ? window.scrollY : getInteractionSafeScrollY();
}

function installStableTriggerCapture(): void {
  if (stableTriggerCaptureInstalled || typeof document === "undefined") return;
  stableTriggerCaptureInstalled = true;
  lastSettledScrollY = window.scrollY;
  rememberScrollSample();
  window.setInterval(rememberScrollSample, 32);
  window.addEventListener("scroll", () => {
    lastScrollEventAt = Date.now();
    if (settleScrollTimer !== null) window.clearTimeout(settleScrollTimer);
    settleScrollTimer = window.setTimeout(() => {
      lastSettledScrollY = window.scrollY;
      settleScrollTimer = null;
    }, 100);
  }, { passive: true });
  document.addEventListener("pointerdown", (event) => rememberStableTriggerPosition(event.target), { capture: true, passive: true });
  document.addEventListener("mousedown", (event) => rememberStableTriggerPosition(event.target), { capture: true, passive: true });
  document.addEventListener("touchstart", (event) => rememberStableTriggerPosition(event.target), { capture: true, passive: true });
  document.addEventListener("click", (event) => rememberStableTriggerPosition(event.target), { capture: true, passive: true });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    rememberStableTriggerPosition(event.target);
  }, { capture: true });
}

function getStableOverlayScrollY(): number {
  const capturedScrollY = stableTriggerScrollY;
  const capturedRecently = capturedScrollY !== null && Date.now() - stableTriggerCapturedAt < 500;
  stableTriggerScrollY = null;
  stableTriggerCapturedAt = 0;
  return capturedRecently ? capturedScrollY : window.scrollY;
}

installStableTriggerCapture();

export function StableDetailOverlay({
  analyticsSurface,
  backdropCloses = true,
  children,
  className = "",
  closeLabel = "Close detail",
  description,
  eyebrow,
  onClose,
  open,
  size = "lg",
  title,
}: StableDetailOverlayProps) {
  const scrollYRef = useRef(0);
  const closeReasonRef = useRef<string | null>(null);
  const openedAtRef = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [mobileSheet, setMobileSheet] = useState(false);
  const reduceMotion = useReducedMotion();
  const telemetrySurface = analyticsSurface ?? (typeof title === "string" ? title : closeLabel);

  const requestClose = useCallback((reason: string) => {
    closeReasonRef.current = reason;
    trackModalClose(telemetrySurface, { reason, size });
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose();
  }, [onClose, size, telemetrySurface]);

  useEffect(() => {
    setMounted(true);
    installStableTriggerCapture();
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const update = () => setMobileSheet(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [mounted]);

  useEffect(() => {
    if (!open) return undefined;
    closeReasonRef.current = null;
    openedAtRef.current = Date.now();
    trackModalOpen(telemetrySurface, { size });

    return () => {
      if (!closeReasonRef.current && Date.now() - openedAtRef.current > 1000) {
        trackModalAbandon(telemetrySurface, { size });
      }
    };
  }, [open, size, telemetrySurface]);

  useEffect(() => {
    if (!open) return undefined;
    scrollYRef.current = getStableOverlayScrollY();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const cleanupViewport = installMobileViewportCssVars();
    const unlockBodyScroll = lockMobileBodyScroll(scrollYRef.current);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose("escape");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlockBodyScroll();
      cleanupViewport();
    };
  }, [open, requestClose]);

  if (!mounted || !open) return null;

  const isMobileSheet = mobileSheet || (typeof window !== "undefined" && window.innerWidth < 640);
  const mobileFullscreen = isMobileSheet && size === "xl";
  const backdropTransition: Transition = { duration: 0.18, ease: "easeOut" };
  const surfaceTransition: Transition = { duration: isMobileSheet ? 0.22 : 0.3, ease: [0.22, 1, 0.36, 1] };
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void => {
    if (!isMobileSheet || mobileFullscreen) return;
    if (info.offset.y > 96 || info.velocity.y > 720) requestClose("drag");
  };
  const mobileChromeClass = mobileFullscreen
    ? "rounded-none border-x-0 border-b-0"
    : "mx-2 mb-[max(0.5rem,env(safe-area-inset-bottom))] max-w-[calc(100vw-1rem)] rounded-[1.6rem] sm:mx-0 sm:mb-0 sm:max-w-none";

  return createPortal(
    <div
      aria-label={typeof title === "string" ? title : closeLabel}
      aria-modal="true"
      className="fixed inset-0 z-[10050] flex items-end justify-center overflow-hidden p-0 sm:items-center sm:p-6"
      data-stable-overlay="true"
      role="dialog"
    >
      <motion.button
        aria-label={closeLabel}
        className="tv-overlay-backdrop absolute inset-0 cursor-default bg-slate-950/78 backdrop-blur-md"
        animate={reduceMotion ? undefined : { opacity: 1 }}
        initial={reduceMotion ? false : { opacity: 0 }}
        onClick={backdropCloses ? () => requestClose("backdrop") : undefined}
        transition={reduceMotion ? undefined : backdropTransition}
        type="button"
      />
      <motion.section
        className={`tv-overlay-surface tv-stable-overlay-surface relative z-10 flex w-full ${WIDTH_CLASS[size]} ${mobileChromeClass} flex-col overflow-hidden border border-cyan-300/20 bg-slate-950 shadow-2xl shadow-black/75 ring-1 ring-cyan-300/10 sm:max-h-[min(92dvh,900px)] sm:rounded-[1.6rem] ${className}`}
        animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
        data-mobile-fullscreen={mobileFullscreen ? "true" : "false"}
        data-stable-overlay-content="true"
        data-mobile-gesture-ignore="true"
        drag={isMobileSheet && !mobileFullscreen ? "y" : false}
        dragConstraints={{ bottom: 0, top: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        initial={reduceMotion ? false : isMobileSheet ? { opacity: 0, scale: mobileFullscreen ? 0.996 : 1, y: mobileFullscreen ? 6 : 24 } : { opacity: 0, scale: 0.975, y: 18 }}
        onDragEnd={handleDragEnd}
        transition={reduceMotion ? undefined : surfaceTransition}
      >
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-4 pb-4 pt-[calc(0.85rem+env(safe-area-inset-top))] backdrop-blur-xl sm:px-6 sm:pt-4">
          {!mobileFullscreen ? <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" /> : null}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {eyebrow ? <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">{eyebrow}</div> : null}
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{title}</h2>
              {description ? <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</div> : null}
            </div>
            <button
              aria-label={closeLabel}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100"
              onClick={() => requestClose("x")}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="tv-native-scroll min-h-0 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">{children}</div>
      </motion.section>
    </div>,
    document.body,
  );
}
