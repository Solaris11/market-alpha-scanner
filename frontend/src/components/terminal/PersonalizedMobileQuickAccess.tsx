"use client";

import Link from "next/link";
import { ArrowRight, Clock, Star } from "lucide-react";
import { useWorkspacePreferences } from "@/hooks/useWorkspacePreferences";
import { moduleLabel, type WorkspaceModuleId } from "@/lib/trading/workspace-preferences";

const MODULE_HREFS: Record<WorkspaceModuleId, string> = {
  alerts: "/alerts",
  best_setups: "/opportunities",
  copilot: "/terminal#copilot",
  dangerous: "/opportunities?tab=dangerous",
  macro: "/intelligence/macro-regime",
  replay: "/history",
  shock_watch: "/opportunities?tab=shock",
  watchlist: "/terminal#mobile-watchlist",
  what_matters_now: "/terminal",
};

export function PersonalizedMobileQuickAccess() {
  const { preferences } = useWorkspacePreferences();
  const modules = preferences.pinnedMobileCards.filter((moduleId) => !preferences.hiddenModules.includes(moduleId)).slice(0, 5);

  if (!modules.length && !preferences.mobileLastViewedSymbol && !preferences.favoriteSymbols.length) return null;

  return (
    <section
      aria-label="Personal mobile quick access"
      className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 xl:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-mobile-gesture-ignore="true"
    >
      {preferences.mobileLastViewedSymbol ? (
        <Link
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 text-xs font-black text-emerald-50 shadow-[0_0_24px_rgba(52,211,153,0.08)]"
          href={`/symbol/${preferences.mobileLastViewedSymbol}`}
        >
          <Clock className="h-4 w-4" />
          Last: {preferences.mobileLastViewedSymbol}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
      {preferences.favoriteSymbols.slice(0, 3).map((symbol) => (
        <Link
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 font-mono text-xs font-black text-cyan-50"
          href={`/symbol/${symbol}`}
          key={symbol}
        >
          <Star className="h-4 w-4" />
          {symbol}
        </Link>
      ))}
      {modules.map((moduleId) => (
        <Link
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 text-xs font-black text-slate-200"
          href={MODULE_HREFS[moduleId]}
          key={moduleId}
        >
          {moduleLabel(moduleId)}
        </Link>
      ))}
    </section>
  );
}
