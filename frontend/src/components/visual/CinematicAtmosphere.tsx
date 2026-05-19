"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Activity, BrainCircuit, Radio, Radar, ShieldAlert, Sparkles } from "lucide-react";

type AtmosphereTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

type AtmosphereModel = {
  kicker: string;
  story: string;
  tone: AtmosphereTone;
};

function atmosphereForRoute(pathname: string | null): AtmosphereModel {
  const route = pathname ?? "";

  if (route.includes("shock") || route.includes("danger") || route.includes("alerts")) {
    return {
      kicker: "Risk atmosphere",
      story: "Elevated context receives warmer focus while evidence remains explicit.",
      tone: "rose",
    };
  }

  if (route.includes("macro") || route.includes("market")) {
    return {
      kicker: "Macro atmosphere",
      story: "Market, liquidity, volatility, and breadth context shape the visual field.",
      tone: "amber",
    };
  }

  if (route.includes("memory") || route.includes("replay") || route.includes("history")) {
    return {
      kicker: "Memory atmosphere",
      story: "Historical context, replay evidence, and state transitions get layered emphasis.",
      tone: "violet",
    };
  }

  if (route.includes("watch") || route.includes("opportunit")) {
    return {
      kicker: "Scanner atmosphere",
      story: "Setup discovery, watchlist shifts, and scanner freshness guide the composition.",
      tone: "emerald",
    };
  }

  if (route.includes("paper") || route.includes("strategy") || route.includes("performance")) {
    return {
      kicker: "Simulation atmosphere",
      story: "Evidence, behavior, drawdown, and scenario context are visually grouped.",
      tone: "violet",
    };
  }

  return {
    kicker: "Intelligence atmosphere",
    story: "TradeVeto keeps market context, risk, replay, and watchlist evidence visually connected.",
    tone: "cyan",
  };
}

export function CinematicAtmosphere() {
  const pathname = usePathname();
  const atmosphere = useMemo(() => atmosphereForRoute(pathname), [pathname]);

  return (
    <div aria-hidden="true" className={`tv-cinematic-atmosphere tv-cinematic-atmosphere--${atmosphere.tone}`}>
      <div className="tv-atmosphere-grid" />
      <div className="tv-atmosphere-scanline" />
      <div className="tv-atmosphere-light tv-atmosphere-light--primary" />
      <div className="tv-atmosphere-light tv-atmosphere-light--secondary" />
      <div className="tv-atmosphere-orbit" />
      <div className="tv-atmosphere-focus tv-atmosphere-focus--left">
        <Activity className="h-5 w-5" />
        <Radar className="h-5 w-5" />
        <ShieldAlert className="h-5 w-5" />
      </div>
      <div className="tv-atmosphere-focus tv-atmosphere-focus--right">
        <BrainCircuit className="h-5 w-5" />
        <Sparkles className="h-5 w-5" />
        <Radio className="h-5 w-5" />
      </div>
      <div className="tv-atmosphere-status">
        <span className="tv-atmosphere-status__pulse" />
        <span className="tv-atmosphere-status__kicker">{atmosphere.kicker}</span>
        <span className="tv-atmosphere-status__story">{atmosphere.story}</span>
      </div>
    </div>
  );
}
