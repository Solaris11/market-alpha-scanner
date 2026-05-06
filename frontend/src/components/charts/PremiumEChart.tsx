"use client";

import type { EChartsOption, EChartsType } from "echarts";
import { useEffect, useRef, useState } from "react";

export function PremiumEChart({
  ariaLabel,
  className = "",
  emptyMessage,
  height = 240,
  option,
}: {
  ariaLabel: string;
  className?: string;
  emptyMessage?: string;
  height?: number;
  option: EChartsOption;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const optionRef = useRef<EChartsOption>(option);
  const [loadError, setLoadError] = useState<string | null>(null);

  optionRef.current = option;

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    import("echarts")
      .then((echarts) => {
        if (disposed || !containerRef.current) return;
        const chart = echarts.init(containerRef.current, undefined, { renderer: "canvas" });
        chartRef.current = chart;
        chart.setOption(optionRef.current, true);
        resizeObserver = new ResizeObserver(() => chart.resize());
        resizeObserver.observe(containerRef.current);
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
  }, []);

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
      className={`min-w-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/75 p-2 ${className}`}
      role="img"
    >
      <div ref={containerRef} style={{ height: `${height}px`, width: "100%" }} />
    </div>
  );
}
