"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { trackModalAbandon, trackModalClose, trackModalOpen } from "@/lib/client/analytics";

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
  const telemetrySurface = analyticsSurface ?? (typeof title === "string" ? title : closeLabel);

  const requestClose = useCallback((reason: string) => {
    closeReasonRef.current = reason;
    trackModalClose(telemetrySurface, { reason, size });
    onClose();
  }, [onClose, size, telemetrySurface]);

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
    scrollYRef.current = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose("escape");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => window.scrollTo({ left: 0, top: scrollYRef.current }));
    };
  }, [open, requestClose]);

  if (!open) return null;

  return (
    <div
      aria-label={typeof title === "string" ? title : closeLabel}
      aria-modal="true"
      className="fixed inset-0 z-[10050] flex items-center justify-center overflow-hidden p-3 sm:p-6"
      role="dialog"
    >
      <button
        aria-label={closeLabel}
        className="absolute inset-0 cursor-default bg-slate-950/78 backdrop-blur-md"
        onClick={backdropCloses ? () => requestClose("backdrop") : undefined}
        type="button"
      />
      <section
        className={`relative z-10 flex max-h-[min(92dvh,900px)] w-full ${WIDTH_CLASS[size]} flex-col overflow-hidden rounded-[1.6rem] border border-cyan-300/20 bg-slate-950 shadow-2xl shadow-black/75 ring-1 ring-cyan-300/10 ${className}`}
      >
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur-xl sm:px-6">
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
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">{children}</div>
      </section>
    </div>
  );
}
