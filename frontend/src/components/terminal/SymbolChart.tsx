import type { ScannerScalar } from "@/lib/types";
import { EmptyState } from "./ui/EmptyState";

export type ChartMarker = { time: string; label: string; tone: "enter" | "wait" | "exit" | "target" | "stop" };

function point(row: Record<string, ScannerScalar>) {
  const value = typeof row.close === "number" ? row.close : typeof row.price === "number" ? row.price : null;
  const time = String(row.date ?? row.datetime ?? row.timestamp_utc ?? "");
  return value !== null && time ? { value, time } : null;
}

export function SymbolChart({ priceSeries, markers }: { priceSeries: Record<string, ScannerScalar>[]; markers: ChartMarker[] }) {
  const points = priceSeries.map(point).filter((item): item is { value: number; time: string } => Boolean(item)).slice(-90);
  if (!points.length) return <EmptyState title="Price history unavailable" message="Scanner data is still available." />;
  const min = Math.min(...points.map((item) => item.value));
  const max = Math.max(...points.map((item) => item.value));
  const span = Math.max(1, max - min);
  const path = points
    .map((item, index) => `${index === 0 ? "M" : "L"} ${(index / Math.max(1, points.length - 1)) * 1000} ${220 - ((item.value - min) / span) * 180}`)
    .join(" ");
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <svg className="h-72 w-full overflow-visible" viewBox="0 0 1000 240" preserveAspectRatio="none">
        <path d={path} fill="none" stroke="url(#chartGradient)" strokeWidth="4" vectorEffect="non-scaling-stroke" />
        <defs><linearGradient id="chartGradient"><stop stopColor="#22d3ee" /><stop offset="1" stopColor="#34d399" /></linearGradient></defs>
      </svg>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-400">
        {markers.map((marker) => <span className="rounded-full bg-white/[0.04] px-2 py-1" key={`${marker.time}-${marker.label}`}>{marker.label}</span>)}
      </div>
    </div>
  );
}
