"use client";

import { PremiumEChart } from "@/components/charts/PremiumEChart";
import type { AnalyticsSummary } from "@/lib/server/analytics";
import { buildDistributionBarOption, buildPremiumTimeSeriesOption, hasDistributionData, hasPremiumChartData } from "@/lib/echarts-options";
import { humanizeLabel } from "@/lib/ui/labels";

const COLORS = {
  amber: "#fbbf24",
  cyan: "#67e8f9",
  emerald: "#34d399",
  rose: "#fb7185",
  slate: "#94a3b8",
  violet: "#a78bfa",
};

export function AnalyticsDashboard({ analytics }: { analytics: AnalyticsSummary }) {
  const visitorSeries = [
    {
      color: COLORS.cyan,
      label: "Page Views",
      values: analytics.visitorInsights.pageViewsByDay.map((point) => ({ bucket: point.bucket, value: point.pageViews })),
    },
    {
      color: COLORS.emerald,
      label: "Unique Visitors",
      values: analytics.visitorInsights.pageViewsByDay.map((point) => ({ bucket: point.bucket, value: point.uniqueVisitors })),
    },
    {
      color: COLORS.violet,
      label: "Sessions",
      values: analytics.visitorInsights.pageViewsByDay.map((point) => ({ bucket: point.bucket, value: point.sessions })),
    },
  ];
  const topPagesRows = analytics.topPages.map((row) => ({ label: compactPath(row.pagePath), value: row.count }));
  const deviceRows = analytics.visitorInsights.deviceBreakdown.map((row) => ({ color: deviceColor(row.deviceType), label: humanizeLabel(row.deviceType), value: row.count }));
  const browserRows = analytics.visitorInsights.browserBreakdown.map((row) => ({ label: humanizeLabel(row.browserFamily), value: row.count }));

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Page Views" value={analytics.visitorInsights.totalPageViews.toLocaleString()} />
        <MetricCard label="Unique Visitors" value={analytics.visitorInsights.uniqueVisitors.toLocaleString()} />
        <MetricCard label="Signed-In Users" value={analytics.visitorInsights.signedInUsers.toLocaleString()} />
        <MetricCard label="Anonymous Visitors" value={analytics.visitorInsights.anonymousVisitors.toLocaleString()} />
        <MetricCard label="Repeat Visitors" value={analytics.visitorInsights.repeatVisitorCount.toLocaleString()} />
        <MetricCard label="Avg Session" value={formatDuration(analytics.visitorInsights.averageSessionDurationSeconds)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <ChartPanel subtitle="Page views, unique visitors, and sessions from first-party analytics events." title="Page Views & Traffic">
          {hasPremiumChartData(visitorSeries) ? (
            <PremiumEChart
              ariaLabel="Page views and visitor trend"
              height={310}
              option={buildPremiumTimeSeriesOption({ series: visitorSeries })}
            />
          ) : (
            <EmptyState>No page view data yet for this range.</EmptyState>
          )}
        </ChartPanel>
        <ChartPanel subtitle="Top pages in the selected beta window." title="Top Visited Pages">
          {hasDistributionData(topPagesRows) ? (
            <PremiumEChart
              ariaLabel="Top visited pages"
              height={310}
              option={buildDistributionBarOption({ rows: topPagesRows })}
            />
          ) : (
            <EmptyState>No page views recorded yet.</EmptyState>
          )}
        </ChartPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ListPanel rows={analytics.visitorInsights.topEntryPages.map((row) => [row.pagePath, row.count])} title="Top Entry Pages" />
        <ListPanel rows={analytics.visitorInsights.topExitPages.map((row) => [row.pagePath, row.count])} title="Top Exit Pages" />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <ChartPanel title="Device Mix">
          {hasDistributionData(deviceRows) ? <PremiumEChart ariaLabel="Device mix" height={240} option={buildDistributionBarOption({ rows: deviceRows, vertical: true })} /> : <EmptyState>No device data yet.</EmptyState>}
        </ChartPanel>
        <ChartPanel title="Browser Families">
          {hasDistributionData(browserRows) ? <PremiumEChart ariaLabel="Browser family mix" height={240} option={buildDistributionBarOption({ rows: browserRows, vertical: true })} /> : <EmptyState>No browser data yet.</EmptyState>}
        </ChartPanel>
        <ChartPanel title="Geography">
          {analytics.visitorInsights.geography.length ? (
            <div className="space-y-2">
              {analytics.visitorInsights.geography.map((row) => (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={`${row.country}-${row.region}-${row.city}-${row.timezone}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-100">{geoLabel(row)}</span>
                    <span className="font-mono text-xs text-cyan-100">{row.count.toLocaleString()}</span>
                  </div>
                  {row.timezone ? <div className="mt-1 text-xs text-slate-500">{row.timezone}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No coarse geography headers available yet.</EmptyState>
          )}
        </ChartPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <MetricGroup
          rows={[
            ["DAU", analytics.retention.dau],
            ["WAU", analytics.retention.wau],
            ["Sessions", analytics.retention.totalSessions],
            ["Avg depth", analytics.retention.averageSessionDepth === null ? "N/A" : analytics.retention.averageSessionDepth.toFixed(1)],
          ]}
          title="Retention Overview"
        />
        <MetricGroup
          rows={[
            ["WAIT engagement", analytics.waitFirst.waitEngagement],
            ["Veto opens", analytics.waitFirst.vetoExplanationOpens],
            ["Readiness opens", analytics.waitFirst.readinessOpens],
            ["Signal drilldowns", analytics.waitFirst.signalDrilldowns],
          ]}
          title="WAIT-First Adoption"
        />
        <MetricGroup
          rows={[
            ["Prompts", analytics.supportUsage.promptClicks],
            ["Messages", analytics.supportUsage.messages],
            ["Helpful", analytics.supportUsage.helpful],
            ["Not helpful", analytics.supportUsage.unhelpful],
          ]}
          title="Support AI Usage"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ListPanel rows={analytics.topEvents.map((row) => [humanizeLabel(row.eventName), row.count])} title="Feature Engagement" />
        <ListPanel rows={analytics.topSymbols.map((row) => [row.symbol, row.count])} title="Top Symbols" />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="User Journey Signals">
          <div className="space-y-2">
            {analytics.journey.map((item) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={item.key}>
                <div className="text-sm font-semibold text-slate-100">{item.description}</div>
                <div className="mt-1 font-mono text-lg text-cyan-100">{item.count.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </ChartPanel>
        <ChartPanel title="Beta Feedback">
          <div className="mb-3 flex flex-wrap gap-2">
            {analytics.feedback.typeCounts.map((row) => (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-slate-300" key={row.feedbackType}>
                {humanizeLabel(row.feedbackType)} · {row.count}
              </span>
            ))}
          </div>
          {analytics.feedback.recent.length ? (
            <div className="space-y-2">
              {analytics.feedback.recent.map((row) => (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={`${row.createdAt}-${row.feedbackType}-${row.pagePath}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-cyan-100">{humanizeLabel(row.feedbackType)}</span>
                    <span className="text-xs text-slate-500">{row.pagePath ?? "unknown page"}</span>
                    {row.symbol ? <span className="font-mono text-xs text-slate-400">{row.symbol}</span> : null}
                  </div>
                  {row.message ? <p className="mt-2 text-sm leading-6 text-slate-300">{row.message}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No beta feedback submitted yet.</EmptyState>
          )}
        </ChartPanel>
      </section>
    </div>
  );
}

function ChartPanel({ children, subtitle, title }: { children: React.ReactNode; subtitle?: string; title: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold text-slate-50">{value}</div>
    </div>
  );
}

function MetricGroup({ rows, title }: { rows: Array<[string, number | string]>; title: string }) {
  return (
    <ChartPanel title={title}>
      <div className="grid grid-cols-2 gap-2">
        {rows.map(([label, value]) => (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={label}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
            <div className="mt-1 font-mono text-lg font-semibold text-slate-100">{typeof value === "number" ? value.toLocaleString() : value}</div>
          </div>
        ))}
      </div>
    </ChartPanel>
  );
}

function ListPanel({ rows, title }: { rows: Array<[string, number]>; title: string }) {
  return (
    <ChartPanel title={title}>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map(([label, value]) => (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" key={label}>
              <span className="min-w-0 truncate text-sm font-semibold text-slate-100">{label}</span>
              <span className="font-mono text-xs text-cyan-100">{value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>No rows yet for this window.</EmptyState>
      )}
    </ChartPanel>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-5 text-sm text-slate-500">{children}</div>;
}

function compactPath(value: string): string {
  if (value.length <= 32) return value;
  return `${value.slice(0, 29)}...`;
}

function formatDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  if (value < 60) return `${Math.round(value)}s`;
  const minutes = value / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

function deviceColor(value: string): string {
  if (value === "mobile") return COLORS.cyan;
  if (value === "tablet") return COLORS.violet;
  if (value === "desktop") return COLORS.emerald;
  return COLORS.slate;
}

function geoLabel(row: { city: string | null; country: string; region: string | null }): string {
  return [row.city, row.region, row.country].filter(Boolean).join(", ") || "Unknown";
}
