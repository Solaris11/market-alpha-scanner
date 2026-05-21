"use client";

import type { EChartsOption, EChartsType } from "echarts";
import { useEffect, useRef, useState } from "react";

export function PremiumEChart({
  ariaLabel,
  className = "",
  deferUntilVisible = true,
  emptyMessage,
  height = 240,
  loadingMessage = "Preparing chart...",
  option,
}: {
  ariaLabel: string;
  className?: string;
  deferUntilVisible?: boolean;
  emptyMessage?: string;
  height?: number;
  loadingMessage?: string;
  option: EChartsOption;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const optionRef = useRef<EChartsOption>(option);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(!deferUntilVisible);

  optionRef.current = option;

  useEffect(() => {
    if (!deferUntilVisible) {
      setShouldLoad(true);
      return;
    }

    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "280px 0px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [deferUntilVisible]);

  useEffect(() => {
    if (!shouldLoad) return;

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    import("echarts")
      .then((echarts) => {
        if (disposed || !containerRef.current) return;
        const chart = echarts.init(containerRef.current, undefined, { renderer: "canvas" });
        chartRef.current = chart;
        chart.setOption(optionRef.current, true);
        setRendererReady(true);
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => chart.resize());
          resizeObserver.observe(containerRef.current);
        }
      })
      .catch(() => {
        if (!disposed) setLoadError("Chart renderer could not be loaded.");
      });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [shouldLoad]);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  if (loadError) {
    return (
      <div className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400 ${className}`}>
        {emptyMessage ?? loadError}
      </div>
    );
  }

  return (
    <div
      aria-label={ariaLabel}
      className={`tv-governed-chart relative min-w-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/75 p-2 ${className}`}
      role="img"
    >
      <div ref={containerRef} style={{ height: `${height}px`, width: "100%" }} />
      {!rendererReady ? (
        <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border border-white/10 bg-slate-950/85" aria-hidden="true">
          <div className="w-full max-w-sm px-4">
            <div className="mx-auto h-3 w-28 rounded-full bg-cyan-300/20" />
            <div className="mt-5 grid h-28 grid-cols-6 items-end gap-2">
              {[35, 58, 42, 74, 51, 66].map((barHeight, index) => (
                <div className="rounded-t bg-white/[0.08]" key={`${barHeight}-${index}`} style={{ height: `${barHeight}%` }} />
              ))}
            </div>
            <div className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{loadingMessage}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
