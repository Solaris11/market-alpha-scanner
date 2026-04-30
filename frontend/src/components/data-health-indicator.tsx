import type { DataFreshness, DataFreshnessStatus } from "@/lib/data-health";

type IndicatorProps = {
  freshness: DataFreshness;
  compact?: boolean;
  className?: string;
};

export function DataHealthIndicator({ className = "", compact = false, freshness }: IndicatorProps) {
  const styles = statusStyles(freshness.status);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${styles.pill} ${className}`}
      title={freshness.lastUpdated ? `Last updated ${freshness.lastUpdated}` : freshness.message}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
      <span className="truncate">{freshness.label}</span>
      {!compact ? <span className={`truncate font-normal ${styles.subtle}`}>{freshness.humanAge}</span> : null}
    </span>
  );
}

export function DataHealthBanner({ freshness }: { freshness: DataFreshness }) {
  if (freshness.status === "fresh" || freshness.status === "slightly_stale") return null;

  const styles = statusStyles(freshness.status);
  return (
    <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm shadow-xl shadow-black/20 ${styles.banner}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`} />
          <div className="min-w-0">
            <div className="font-semibold text-slate-50">System data health: {freshness.label}</div>
            <div className="mt-0.5 text-xs text-slate-300">{freshness.message}</div>
          </div>
        </div>
        {freshness.lastUpdated ? <div className="font-mono text-xs text-slate-400">{freshness.humanAge}</div> : null}
      </div>
    </div>
  );
}

function statusStyles(status: DataFreshnessStatus) {
  if (status === "fresh") {
    return {
      banner: "border-emerald-400/25 bg-emerald-400/10",
      dot: "bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.7)]",
      pill: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
      subtle: "text-emerald-200/80",
    };
  }

  if (status === "slightly_stale") {
    return {
      banner: "border-amber-400/25 bg-amber-400/10",
      dot: "bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.65)]",
      pill: "border-amber-400/25 bg-amber-400/10 text-amber-100",
      subtle: "text-amber-200/80",
    };
  }

  return {
    banner: "border-rose-400/25 bg-rose-500/10",
    dot: "bg-rose-300 shadow-[0_0_16px_rgba(253,164,175,0.65)]",
    pill: "border-rose-400/25 bg-rose-500/10 text-rose-100",
    subtle: "text-rose-200/80",
  };
}
