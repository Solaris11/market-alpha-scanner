"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Target, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocalWatchlist } from "@/hooks/useLocalWatchlist";
import {
  readClientActivationScoreModel,
  trackActivationMilestone,
  trackAnalyticsEvent,
  trackFirstUsefulAction,
} from "@/lib/client/analytics";
import type { ActivationPrompt, ActivationScoreModel } from "@/lib/activation-recovery";

const DISMISSED_KEY = "tv_activation_recovery_nudge_dismissed";
const VIEWED_KEY = "tv_activation_recovery_nudge_viewed";

export function ActivationRecoveryNudge() {
  const pathname = usePathname();
  const { add, watchlist } = useLocalWatchlist();
  const [dismissed, setDismissed] = useState(false);
  const [model, setModel] = useState<ActivationScoreModel | null>(null);

  const hidden = useMemo(() => shouldHideActivationNudge(pathname ?? "/"), [pathname]);
  const visiblePrompts = model?.prompts.slice(0, 2) ?? [];
  const topPrompt = visiblePrompts[0] ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.sessionStorage.getItem(DISMISSED_KEY) === "true");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || hidden) return;
    const next = readClientActivationScoreModel();
    setModel(next);
  }, [hidden, pathname, watchlist.length]);

  useEffect(() => {
    if (typeof window === "undefined" || hidden || dismissed || !model || model.level === "activated" || !topPrompt) return;
    const viewKey = `${VIEWED_KEY}:${topPrompt.telemetryAction}:${model.level}`;
    if (window.sessionStorage.getItem(viewKey) === "true") return;
    window.sessionStorage.setItem(viewKey, "true");
    trackAnalyticsEvent("activation_nudge_view", {
      completedActions: model.completedActions.length,
      level: model.level,
      missingActions: model.missingActions.length,
      prompt: topPrompt.telemetryAction,
      score: model.score,
    }, { source: "activation_recovery_nudge" });
  }, [dismissed, hidden, model, topPrompt]);

  if (hidden || dismissed || !model || model.level === "activated" || !visiblePrompts.length) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // The nudge is best-effort and must not depend on storage availability.
    }
    trackAnalyticsEvent("activation_nudge_dismiss", {
      level: model?.level ?? "unknown",
      prompt: topPrompt?.telemetryAction ?? "none",
      score: model?.score ?? 0,
    }, { source: "activation_recovery_nudge" });
  }

  function trackPromptClick(prompt: ActivationPrompt) {
    trackAnalyticsEvent("activation_nudge_click", {
      action: prompt.action,
      prompt: prompt.telemetryAction,
      score: model?.score ?? 0,
    }, { source: "activation_recovery_nudge" });
  }

  function trackFirstSymbol() {
    const prompt = visiblePrompts.find((item) => item.action === "watchlist") ?? topPrompt;
    if (prompt) trackPromptClick(prompt);
    add("AMD");
    trackActivationMilestone("watchlist", { prompt: prompt?.telemetryAction ?? "prompt_first_watchlist", symbol: "AMD" }, { source: "activation_recovery_nudge", symbol: "AMD" });
    trackFirstUsefulAction("watchlist_add", { prompt: prompt?.telemetryAction ?? "prompt_first_watchlist", symbol: "AMD" }, { source: "activation_recovery_nudge", symbol: "AMD" });
    setModel(readClientActivationScoreModel());
  }

  return (
    <aside
      aria-label="Activation recovery prompt"
      className="fixed bottom-[calc(var(--tv-mobile-nav-clearance)+0.5rem)] left-3 right-3 z-[65] rounded-2xl border border-cyan-300/25 bg-slate-950/95 p-3 shadow-2xl shadow-black/45 ring-1 ring-white/10 backdrop-blur-xl md:bottom-5 md:left-auto md:right-5 md:w-[26rem]"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
          <Target className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">Start Here</div>
              <div className="mt-1 text-sm font-black text-white">Most useful next action</div>
            </div>
            <button
              aria-label="Dismiss activation prompt"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-white/25 hover:text-white"
              onClick={dismiss}
              type="button"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-300">{model.summary}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {visiblePrompts.map((prompt) => (
          <PromptAction addFirstSymbol={trackFirstSymbol} key={prompt.telemetryAction} prompt={prompt} trackPromptClick={trackPromptClick} />
        ))}
      </div>
    </aside>
  );
}

function PromptAction({
  addFirstSymbol,
  prompt,
  trackPromptClick,
}: {
  addFirstSymbol: () => void;
  prompt: ActivationPrompt;
  trackPromptClick: (prompt: ActivationPrompt) => void;
}) {
  const className = `group flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${toneClass(prompt.tone)}`;
  if (prompt.action === "watchlist") {
    return (
      <button className={className} onClick={addFirstSymbol} type="button">
        <span className="min-w-0">
          <span className="block text-xs font-black text-white">{prompt.label}</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-slate-300">{prompt.detail}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-white/80 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    );
  }
  return (
    <Link className={className} href={prompt.href} onClick={() => trackPromptClick(prompt)}>
      <span className="min-w-0">
        <span className="block text-xs font-black text-white">{prompt.label}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-slate-300">{prompt.detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-white/80 transition group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

function shouldHideActivationNudge(pathname: string): boolean {
  if (pathname === "/" || pathname.startsWith("/register") || pathname.startsWith("/join") || pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/account") || pathname.startsWith("/settings") || pathname.startsWith("/support") || pathname.startsWith("/status")) return true;
  return false;
}

function toneClass(tone: ActivationPrompt["tone"]): string {
  if (tone === "amber") return "border-amber-300/20 bg-amber-300/[0.06] hover:border-amber-200/35";
  if (tone === "emerald") return "border-emerald-300/20 bg-emerald-300/[0.06] hover:border-emerald-200/35";
  if (tone === "rose") return "border-rose-300/22 bg-rose-300/[0.07] hover:border-rose-200/35";
  if (tone === "violet") return "border-violet-300/20 bg-violet-300/[0.06] hover:border-violet-200/35";
  return "border-cyan-300/20 bg-cyan-300/[0.06] hover:border-cyan-200/35";
}
