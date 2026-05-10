"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { trackAnalyticsEvent } from "@/lib/client/analytics";
import { markOnboardingReplayPending, replayMarketOnboarding } from "./MarketOnboarding";

const HIDE_KEY = "tradeveto_first_run_starter_hidden_v1";
const TOUR_COMPLETE_KEY = "ma_onboarding_completed";
const PATH_KEY = "tradeveto_first_run_path_v1";

type StarterPath = "advanced" | "beginner";

const STARTER_STEPS: Record<StarterPath, Array<{ href: string; label: string; text: string }>> = {
  advanced: [
    { href: "/terminal?firstRun=1", label: "Read the console", text: "Start with the market state, top risks, and what deserves attention." },
    { href: "/opportunities?tab=full&firstRun=1", label: "Rank the universe", text: "Use risk/reward filters to compare the broad scan without hiding risk." },
    { href: "/symbol/AMD?firstRun=1", label: "Open evidence", text: "Review one symbol's timing, late-entry risk, large-move history, and what could break the setup." },
  ],
  beginner: [
    { href: "/terminal?firstRun=1", label: "Read the market read", text: "Check what matters now before opening any symbol." },
    { href: "/opportunities?firstRun=1", label: "Review one idea", text: "Pick one card and read why it appears, what to wait for, and what could break it." },
    { href: "/account", label: "Build your watchlist", text: "Add 3-5 symbols so future visits show what changed." },
  ],
};

const CONCEPTS = [
  {
    label: "WAIT-first",
    text: "WAIT means patience is the current decision. The setup may be interesting, but timing or market support is not clean enough yet.",
  },
  {
    label: "Fragility",
    text: "How easily a setup can break if volatility, macro pressure, or price structure weakens.",
  },
  {
    label: "Asymmetry",
    text: "Whether the historical upside potential looks meaningfully better than the downside risk.",
  },
  {
    label: "Shock opportunity",
    text: "A high-volatility research setup with similar past moves. It is speculative, not a main TradeVeto signal.",
  },
  {
    label: "Risk / reward controls",
    text: "Switch between safer, balanced, or aggressive research lists without changing the core risk-first decision.",
  },
  {
    label: "What Matters Most",
    text: "The daily shortcut: top opportunities, top risks, biggest changes, and what deserves attention now.",
  },
];

const CHECKPOINTS = ["Understand the market state", "Review one opportunity", "Save symbols to revisit"];

export function FirstRunStarterCard() {
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [path, setPath] = useState<StarterPath>("beginner");

  useEffect(() => {
    const explicitFirstRun = new URLSearchParams(window.location.search).get("firstRun") === "1";
    const hidden = window.localStorage.getItem(HIDE_KEY) === "true";
    const completed = window.localStorage.getItem(TOUR_COMPLETE_KEY) === "true";
    const storedPath = window.localStorage.getItem(PATH_KEY);
    if (storedPath === "advanced" || storedPath === "beginner") setPath(storedPath);
    setVisible(explicitFirstRun || (!hidden && !completed));
  }, []);

  if (!visible) return null;

  const steps = STARTER_STEPS[path];

  function selectPath(nextPath: StarterPath) {
    window.localStorage.setItem(PATH_KEY, nextPath);
    setPath(nextPath);
    trackAnalyticsEvent("detail_expand", { detail: "first_run_path_select", path: nextPath }, { source: "first_run_starter" });
  }

  function hideCard() {
    window.localStorage.setItem(HIDE_KEY, "true");
    setVisible(false);
    trackAnalyticsEvent("onboarding_skip", { onboarding: "first_run_starter" }, { source: "first_run_starter" });
  }

  function startTour() {
    trackAnalyticsEvent("detail_expand", { detail: "first_run_walkthrough" }, { source: "first_run_starter" });
    if (pathname !== "/terminal") {
      markOnboardingReplayPending();
      router.push("/terminal?firstRun=1");
      return;
    }
    replayMarketOnboarding();
  }

  return (
    <section
      className="mb-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.045] p-4 shadow-2xl shadow-cyan-950/10 sm:p-5"
      data-onboarding-target="start-here"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Start here</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Understand TradeVeto in 3 minutes</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Start with one market read, review one opportunity, then save a small watchlist. TradeVeto looks for opportunity, but it explains risk, timing, and evidence before action.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CHECKPOINTS.map((checkpoint, index) => (
              <span className="rounded-full border border-cyan-300/15 bg-slate-950/35 px-3 py-1.5 text-[11px] font-semibold text-cyan-50/90" key={checkpoint}>
                {index + 1}. {checkpoint}
              </span>
            ))}
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            className={`rounded-full border px-3 py-2 text-xs font-bold transition ${path === "beginner" ? "border-cyan-300/50 bg-cyan-300 text-slate-950" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35 hover:text-cyan-100"}`}
            onClick={() => selectPath("beginner")}
            type="button"
          >
            Beginner path
          </button>
          <button
            className={`rounded-full border px-3 py-2 text-xs font-bold transition ${path === "advanced" ? "border-cyan-300/50 bg-cyan-300 text-slate-950" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35 hover:text-cyan-100"}`}
            onClick={() => selectPath("advanced")}
            type="button"
          >
            Advanced path
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {steps.map((step, index) => (
          <Link className="rounded-xl border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.055]" href={step.href} key={step.label}>
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-cyan-300/25 bg-cyan-400/10 font-mono text-[11px] font-black text-cyan-100">{index + 1}</span>
              <span className="text-sm font-semibold text-slate-100">{step.label}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{step.text}</p>
          </Link>
        ))}
      </div>

      <details className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-3 text-sm text-slate-300">
        <summary className="min-h-9 cursor-pointer list-none font-semibold text-slate-100">
          Plain-English guide to the terms you will see
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {CONCEPTS.map((concept) => (
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3" key={concept.label}>
              <div className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">{concept.label}</div>
              <p className="mt-2 text-xs leading-5 text-slate-400">{concept.text}</p>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200" onClick={startTour} type="button">
          Start walkthrough
        </button>
        <Link className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100" href="/opportunities?firstRun=1">
          Review first opportunity
        </Link>
        <Link className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100" href="/symbol/AMD?firstRun=1">
          Open example symbol
        </Link>
        <button className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-500 transition hover:border-white/20 hover:text-slate-200" onClick={hideCard} type="button">
          Hide
        </button>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        Free preview states may show limited data. Premium unlocks full-universe ranking, deeper evidence, replay, and personalized watchlist intelligence.
      </p>
    </section>
  );
}
