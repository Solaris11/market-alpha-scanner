"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { trackAnalyticsEvent } from "@/lib/client/analytics";

const ONBOARDING_KEY = "ma_onboarding_completed";
const REPLAY_EVENT = "ma:replay-onboarding";
const REPLAY_PENDING_KEY = "ma_onboarding_replay_pending";
const RISK_ACK_READY_EVENT = "ma:risk-acknowledgement-ready";
const RISK_ACK_STORAGE_KEY = "ma_risk_acknowledged_v1";

type TourStep = {
  title: string;
  message: string;
  selector?: string;
};

type HighlightRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

const STEPS: TourStep[] = [
  {
    title: "Start With One Market Read",
    message: "This is the daily shortcut. Read what matters now, the biggest risk, and the best place to look before you open any symbol.",
    selector: "[data-onboarding-target='start-here'], [data-onboarding-target='what-matters-now'], [data-onboarding-target='best-trade']",
  },
  {
    title: "WAIT Is Still A Decision",
    message: "TradeVeto is WAIT-first. WAIT means the setup may be interesting, but timing, fragility, or market support is not clean enough yet.",
    selector: "[data-onboarding-target='best-trade'], [data-onboarding-target='what-matters-now']",
  },
  {
    title: "Change Risk And Reward",
    message: "Use risk/reward controls to move from safer research lists to more aggressive ideas. The core risk warning stays visible either way.",
    selector: "[data-onboarding-target='ai-decision'], [data-onboarding-target='trade-plan-entry']",
  },
  {
    title: "Review One Symbol",
    message: "Open one symbol and look for four things: why it matters, what to wait for, what invalidates it, and whether chasing is risky.",
    selector: "[data-onboarding-target='trade-plan-entry']",
  },
  {
    title: "Save A Small Watchlist",
    message: "Save 3-5 symbols you already care about. Future visits can then focus on what changed instead of making you rescan everything.",
    selector: "[data-onboarding-target='trade-plan-entry']",
  },
];

export function MarketOnboarding({ tradePlanHref }: { tradePlanHref: string }) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const step = STEPS[stepIndex];
  const isFinal = stepIndex === STEPS.length - 1;

  const openTour = useCallback((startIndex = 0) => {
    setStepIndex(startIndex);
    setActive(true);
    trackAnalyticsEvent("onboarding_step", { onboarding: "terminal_tour", step: startIndex + 1 }, { source: "terminal_onboarding" });
  }, []);

  const completeTour = useCallback(() => {
    window.localStorage.setItem(ONBOARDING_KEY, "true");
    if (window.location.search.includes("firstRun")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("firstRun");
      window.history.replaceState(null, "", url.toString());
    }
    setActive(false);
  }, []);

  const skipTour = useCallback(() => {
    trackAnalyticsEvent("onboarding_skip", { onboarding: "terminal_tour", step: stepIndex + 1 }, { source: "terminal_onboarding" });
    completeTour();
  }, [completeTour, stepIndex]);

  useEffect(() => {
    const explicitFirstRun = new URLSearchParams(window.location.search).get("firstRun") === "1";
    if (explicitFirstRun) {
      openTour();
      return;
    }

    const pendingReplay = window.sessionStorage.getItem(REPLAY_PENDING_KEY) === "true";
    if (pendingReplay) {
      window.sessionStorage.removeItem(REPLAY_PENDING_KEY);
      openTour();
      return;
    }

    function openWhenReady() {
      if (window.localStorage.getItem(ONBOARDING_KEY) === "true") return;
      openTour();
    }

    if (window.localStorage.getItem(RISK_ACK_STORAGE_KEY) === "true") openWhenReady();

    window.addEventListener(RISK_ACK_READY_EVENT, openWhenReady);
    return () => window.removeEventListener(RISK_ACK_READY_EVENT, openWhenReady);
  }, [openTour]);

  useEffect(() => {
    function onReplay() {
      openTour();
    }

    window.addEventListener(REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(REPLAY_EVENT, onReplay);
  }, [openTour]);

  useEffect(() => {
    if (!active) return;

    function updateRect() {
      const target = step.selector ? document.querySelector<HTMLElement>(step.selector) : null;
      if (!target) {
        setRect(null);
        return;
      }

      const bounds = target.getBoundingClientRect();
      setRect({
        height: bounds.height,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
      });
    }

    const target = step.selector ? document.querySelector<HTMLElement>(step.selector) : null;
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    updateRect();
    const frame = window.requestAnimationFrame(updateRect);
    const timeout = window.setTimeout(updateRect, 260);

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [active, step]);

  const tooltipStyle = useMemo(() => {
    if (!rect) return centeredTooltip();
    const margin = 16;
    const width = Math.max(220, Math.min(340, window.innerWidth - margin * 2));
    const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin));
    const belowTop = rect.top + rect.height + 14;
    const estimatedHeight = window.innerWidth < 640 ? 330 : 230;
    const availableBelow = window.innerHeight - belowTop - margin;
    const availableAbove = rect.top - margin;
    const top = availableBelow >= estimatedHeight
      ? belowTop
      : availableAbove >= estimatedHeight
        ? Math.max(margin, rect.top - estimatedHeight - 14)
        : margin;
    return { left, maxHeight: `calc(100vh - ${margin * 2}px)`, overflowY: "auto" as const, top, width };
  }, [rect]);

  if (!active) return null;

  return (
    <div aria-live="polite" className="fixed inset-0 z-[9500] pointer-events-none">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" />
      {rect ? (
        <div
          className="absolute rounded-2xl border border-cyan-200/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.18),0_0_36px_rgba(34,211,238,0.75)]"
          style={{
            height: Math.max(48, rect.height + 16),
            left: Math.max(8, rect.left - 8),
            top: Math.max(8, rect.top - 8),
            width: Math.max(120, rect.width + 16),
          }}
        />
      ) : null}
      <section
        className="pointer-events-auto fixed rounded-2xl border border-cyan-300/25 bg-slate-950/95 p-4 text-sm text-slate-100 shadow-2xl shadow-cyan-950/30 ring-1 ring-white/10 backdrop-blur-xl"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Step {stepIndex + 1} of {STEPS.length}</div>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-50">{step.title}</h2>
          </div>
          <button className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-400 transition hover:border-rose-300/40 hover:text-rose-100" onClick={skipTour} type="button">
            Skip onboarding
          </button>
        </div>
        <p className="mt-3 leading-6 text-slate-300">{step.message}</p>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-slate-400">
          <span className="font-semibold text-slate-200">Goal:</span> know what TradeVeto does, where opportunities are, and what to inspect next without reading every panel.
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition disabled:cursor-not-allowed disabled:opacity-40 hover:border-cyan-300/40 hover:text-cyan-100"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((current) => {
              const next = Math.max(0, current - 1);
              trackAnalyticsEvent("onboarding_step", { direction: "back", onboarding: "terminal_tour", step: next + 1 }, { source: "terminal_onboarding" });
              return next;
            })}
            type="button"
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            {!isFinal ? (
              <button className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200" onClick={() => setStepIndex((current) => {
                const next = Math.min(STEPS.length - 1, current + 1);
                trackAnalyticsEvent("onboarding_step", { direction: "next", onboarding: "terminal_tour", step: next + 1 }, { source: "terminal_onboarding" });
                return next;
              })} type="button">
                Next
              </button>
            ) : (
              <button
                className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200"
                onClick={() => {
                  trackAnalyticsEvent("onboarding_complete", { onboarding: "terminal_tour" }, { source: "terminal_onboarding" });
                  completeTour();
                  router.push(tradePlanHref);
                }}
                type="button"
              >
                Open Symbol Research
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function replayMarketOnboarding() {
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

export function markOnboardingReplayPending() {
  window.sessionStorage.setItem(REPLAY_PENDING_KEY, "true");
}

function centeredTooltip() {
  if (typeof window === "undefined") return { left: 24, maxHeight: "calc(100vh - 32px)", overflowY: "auto" as const, top: 120, width: 340 };
  const width = Math.max(220, Math.min(340, window.innerWidth - 32));
  return {
    left: Math.max(16, (window.innerWidth - width) / 2),
    maxHeight: "calc(100vh - 32px)",
    overflowY: "auto" as const,
    top: Math.max(80, window.innerHeight * 0.28),
    width,
  };
}
