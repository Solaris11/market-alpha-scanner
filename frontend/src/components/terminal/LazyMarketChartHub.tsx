"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketChartHubItem } from "@/lib/interactive-chart-data";
import { MarketChartHub } from "./MarketChartHub";

type Props = { marketCondition: string; updatedAt?: string | null };

type LoadState = "idle" | "loading" | "ready" | "empty" | "error";

// P2.6 hardening: defer the heavy cross-asset chart hub. Its raw points
// (~1.5-2MB) no longer ship in the initial terminal document; they load from
// /api/terminal/market-charts when the section scrolls near the viewport. The
// first-screen decision (WHAT/WHERE/WHICH) and the market-command summary are
// unaffected -- only this below-the-fold visual is progressively disclosed.
export function LazyMarketChartHub({ marketCondition, updatedAt }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);
  const [charts, setCharts] = useState<MarketChartHubItem[] | null>(null);
  const [state, setState] = useState<LoadState>("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      // No observer available: load immediately so nothing is hidden.
      void load();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void load();
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();

    async function load() {
      if (startedRef.current) return;
      startedRef.current = true;
      setState("loading");
      try {
        const res = await fetch("/api/terminal/market-charts", { credentials: "include" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { charts?: MarketChartHubItem[] };
        const next = Array.isArray(data.charts) ? data.charts : [];
        setCharts(next);
        setState(next.length ? "ready" : "empty");
      } catch {
        startedRef.current = false; // allow a retry if it scrolls back into view
        setState("error");
      }
    }
  }, []);

  if (state === "ready" && charts && charts.length) {
    return <MarketChartHub charts={charts} marketCondition={marketCondition} updatedAt={updatedAt} />;
  }

  return (
    <section
      ref={ref}
      id="market-charts"
      className="rounded-3xl border border-cyan-300/16 bg-slate-950/45 p-6 text-sm text-slate-400 shadow-2xl shadow-black/20"
    >
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Cross-asset charts</div>
      <p className="mt-2">
        {state === "error"
          ? "Cross-asset market charts are temporarily unavailable."
          : state === "empty"
            ? "No validated cross-asset charts are available yet."
            : "Loading cross-asset market charts…"}
      </p>
    </section>
  );
}
