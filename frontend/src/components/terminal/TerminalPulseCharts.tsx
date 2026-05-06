"use client";

import { PremiumEChart } from "@/components/charts/PremiumEChart";
import { buildDistributionBarOption, buildDonutOption, hasDistributionData, type DistributionRow } from "@/lib/echarts-options";

export function TerminalPulseCharts({
  confidenceRows,
  decisionRows,
  setupRows,
}: {
  confidenceRows: DistributionRow[];
  decisionRows: DistributionRow[];
  setupRows: DistributionRow[];
}) {
  if (!hasDistributionData(confidenceRows) && !hasDistributionData(decisionRows) && !hasDistributionData(setupRows)) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
        Scanner pulse visualization will appear after data is available.
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
        {hasDistributionData(decisionRows) ? (
          <PremiumEChart
            ariaLabel="Terminal decision distribution donut"
            height={215}
            option={buildDonutOption({ centerLabel: "Latest scan", rows: decisionRows, title: "Decision Mix" })}
          />
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No decision mix available.</div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
          {hasDistributionData(setupRows) ? (
            <PremiumEChart
              ariaLabel="Terminal setup distribution chart"
              height={215}
              option={buildDistributionBarOption({ rows: setupRows, title: "Setup Distribution" })}
            />
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No setup distribution available.</div>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
          {hasDistributionData(confidenceRows) ? (
            <PremiumEChart
              ariaLabel="Terminal confidence distribution chart"
              height={215}
              option={buildDistributionBarOption({ rows: confidenceRows, title: "Confidence Distribution" })}
            />
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No confidence distribution available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
