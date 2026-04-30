"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ONBOARDING_KEY = "ma_onboarding_completed";
const REPLAY_EVENT = "ma:replay-onboarding";
const REPLAY_PENDING_KEY = "ma_onboarding_replay_pending";

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
    title: "Terminal Overview",
    message: "This is your AI-ranked best opportunity right now.",
    selector: "[data-onboarding-target='best-trade']",
  },
  {
    title: "AI Decision Panel",
    message: "AI explains why a trade is good or risky, and can block bad trades.",
    selector: "[data-onboarding-target='ai-decision']",
  },
  {
    title: "What-If Simulator",
    message: "Simulate position size, risk, and reward before taking any trade.",
    selector: "[data-onboarding-target='what-if-simulator'], [data-onboarding-target='trade-plan-entry']",
  },
  {
    title: "Next Step",
    message: "Start by reviewing today's best setup and open its trade plan.",
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
  }, []);

  const completeTour = useCallback(() => {
    window.localStorage.setItem(ONBOARDING_KEY, "true");
    setActive(false);
  }, []);

  useEffect(() => {
    const pendingReplay = window.sessionStorage.getItem(REPLAY_PENDING_KEY) === "true";
    if (pendingReplay) {
      window.sessionStorage.removeItem(REPLAY_PENDING_KEY);
      openTour();
      return;
    }

    if (window.localStorage.getItem(ONBOARDING_KEY) !== "true") {
      openTour();
    }
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
    const top = belowTop + 190 < window.innerHeight ? belowTop : Math.max(margin, rect.top - 206);
    return { left, top, width };
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
          <button className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-400 transition hover:border-rose-300/40 hover:text-rose-100" onClick={completeTour} type="button">
            Skip onboarding
          </button>
        </div>
        <p className="mt-3 leading-6 text-slate-300">{step.message}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition disabled:cursor-not-allowed disabled:opacity-40 hover:border-cyan-300/40 hover:text-cyan-100"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            type="button"
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            {!isFinal ? (
              <button className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200" onClick={() => setStepIndex((current) => Math.min(STEPS.length - 1, current + 1))} type="button">
                Next
              </button>
            ) : (
              <button
                className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200"
                onClick={() => {
                  completeTour();
                  router.push(tradePlanHref);
                }}
                type="button"
              >
                Go to Trade Plan
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
  if (typeof window === "undefined") return { left: 24, top: 120, width: 340 };
  const width = Math.max(220, Math.min(340, window.innerWidth - 32));
  return {
    left: Math.max(16, (window.innerWidth - width) / 2),
    top: Math.max(80, window.innerHeight * 0.28),
    width,
  };
}
