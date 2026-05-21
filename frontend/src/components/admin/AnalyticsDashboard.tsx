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
  const dominanceProof = analytics.realUserProof.dominanceProof;
  const realUserProofSeries = [
    {
      color: COLORS.cyan,
      label: "Feature Events",
      values: analytics.realUserProof.engagementTrends.map((point) => ({ bucket: point.bucket, value: point.featureEvents })),
    },
    {
      color: COLORS.emerald,
      label: "Active Users",
      values: analytics.realUserProof.engagementTrends.map((point) => ({ bucket: point.bucket, value: point.activeUsers })),
    },
    {
      color: COLORS.violet,
      label: "Workflow Continuity",
      values: analytics.realUserProof.engagementTrends.map((point) => ({ bucket: point.bucket, value: point.workflowContinuity })),
    },
    {
      color: COLORS.rose,
      label: "Friction",
      values: analytics.realUserProof.engagementTrends.map((point) => ({ bucket: point.bucket, value: point.frictionEvents })),
    },
  ];
  const retentionCurveSeries = [
    {
      color: COLORS.emerald,
      label: "Retained Users",
      values: analytics.realUserProof.retentionCurve.map((point) => ({ bucket: `D${point.dayOffset}`, value: point.retainedUsers })),
    },
    {
      color: COLORS.cyan,
      label: "Retention Rate",
      values: analytics.realUserProof.retentionCurve.map((point) => ({ bucket: `D${point.dayOffset}`, value: Math.round(point.retentionRatePct ?? 0) })),
    },
  ];
  const adoptionRows = analytics.realUserProof.featureAdoption.map((row) => ({ label: `${row.feature} · ${formatPct(row.adoptionRatePct)}`, value: row.events }));

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

      <section className="overflow-hidden rounded-3xl border border-cyan-300/18 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.16),transparent_28rem),radial-gradient(circle_at_86%_12%,rgba(167,139,250,0.12),transparent_24rem),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.82))] p-4 shadow-2xl shadow-cyan-950/20 ring-1 ring-white/5 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Real User Intelligence Proof</div>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">Engagement, workflow continuity, and product learning</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              This proof layer uses first-party, privacy-sanitized product behavior only. It shows whether users reach useful actions, return with watchlists, move through core workflows, engage with living intelligence, and encounter friction.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[520px]">
            <ProofMetric label="DAU / WAU" value={`${analytics.retention.dau.toLocaleString()} / ${analytics.retention.wau.toLocaleString()}`} />
            <ProofMetric label="Sticky Sessions" value={formatPct(analytics.realUserProof.workflowStickiness.stickySessionRatePct)} />
            <ProofMetric label="Proof Score" value={`${dominanceProof.proofScore}/100`} />
          </div>
        </div>
        <div className={`mt-5 rounded-2xl border p-4 ${statusPanelClass(dominanceProof.status)}`}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/70">Dominance Certification</div>
              <div className="mt-1 text-xl font-black uppercase text-white">{dominanceProof.verdictLabel}</div>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-200">{dominanceProof.summary}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[520px]">
              <ProofMetric label="Sample" value={`${analytics.retention.activeUsers.toLocaleString()} users`} />
              <ProofMetric label="First Useful" value={analytics.uxInsights.firstUsefulAction.count.toLocaleString()} />
              <ProofMetric label="Friction" value={`${analytics.uxInsights.interactionQuality.rageClicks + analytics.uxInsights.interactionQuality.failedActions + analytics.uxInsights.interactionQuality.modalAbandons + analytics.uxInsights.interactionQuality.scrollAbandons}`} />
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <ChartPanel subtitle="Feature events, active users, workflow continuity, and friction over time." title="Engagement Trend">
            {hasPremiumChartData(realUserProofSeries) ? (
              <PremiumEChart ariaLabel="Real user proof engagement trend" height={300} option={buildPremiumTimeSeriesOption({ series: realUserProofSeries })} />
            ) : (
              <EmptyState>No engagement trend has been recorded for this window yet.</EmptyState>
            )}
          </ChartPanel>
          <ChartPanel subtitle="Scanner, feed, replay, strategy, watchlist, notifications, and mobile adoption." title="Feature Adoption">
            {hasDistributionData(adoptionRows) ? (
              <PremiumEChart ariaLabel="Feature adoption" height={300} option={buildDistributionBarOption({ rows: adoptionRows, vertical: true })} />
            ) : (
              <EmptyState>No feature adoption events have been recorded yet.</EmptyState>
            )}
          </ChartPanel>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <ChartPanel subtitle="Cohort retention by day offset. D0 is the activation baseline; later offsets require eligible older cohorts." title="Retention Curve">
            {hasPremiumChartData(retentionCurveSeries) ? (
              <PremiumEChart ariaLabel="Real user retention curve" height={270} option={buildPremiumTimeSeriesOption({ series: retentionCurveSeries })} />
            ) : (
              <EmptyState>No eligible retention cohorts have been recorded yet.</EmptyState>
            )}
          </ChartPanel>
          <ChartPanel subtitle="Hard gates for real-world dominance proof. Failed gates are blockers, not cosmetic warnings." title="Dominance Proof Gates">
            <div className="grid gap-2 md:grid-cols-2">
              {dominanceProof.gates.map((gate) => (
                <div className={`rounded-xl border p-3 ${tonePanelClass(gate.tone)}`} key={gate.key}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-100">{gate.label}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-300">{gate.evidence}</div>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase text-white">
                      {gate.passed ? "Pass" : "Gap"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-black/18 p-2">
                      <div className="text-slate-500">Current</div>
                      <div className="font-mono font-black text-white">{gate.value}</div>
                    </div>
                    <div className="rounded-lg bg-black/18 p-2">
                      <div className="text-slate-500">Target</div>
                      <div className="font-mono font-black text-white">{gate.target}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ChartPanel>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {dominanceProof.signals.map((signal) => (
            <div className={`rounded-2xl border p-3 ${tonePanelClass(signal.tone)}`} key={signal.label}>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">{signal.label}</div>
              <div className="mt-1 font-mono text-lg font-black text-white">{signal.value}</div>
              <div className="mt-2 text-xs leading-5 text-slate-300">{signal.interpretation}</div>
            </div>
          ))}
        </div>
        {dominanceProof.blockers.length ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.055] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">Remaining Proof Blockers</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {dominanceProof.blockers.map((blocker) => (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-amber-50" key={blocker}>
                  {blocker}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ProofPanel
            rows={[
              ["Multi-workflow sessions", analytics.realUserProof.workflowStickiness.multiWorkflowSessions],
              ["Scanner -> Symbol", analytics.realUserProof.workflowStickiness.scannerToSymbolSessions],
              ["Feed -> Watchlist", analytics.realUserProof.workflowStickiness.feedToWatchlistSessions],
              ["Replay -> Strategy", analytics.realUserProof.workflowStickiness.replayToStrategySessions],
            ]}
            title="Workflow Stickiness"
          />
          <ProofPanel
            rows={[
              ["Watchlist users", analytics.realUserProof.watchlistRetention.watchlistUsers],
              ["Returning users", analytics.realUserProof.watchlistRetention.returningWatchlistUsers],
              ["Retained sessions", analytics.realUserProof.watchlistRetention.retainedSessions],
              ["Retention rate", formatPct(analytics.realUserProof.watchlistRetention.retentionRatePct)],
            ]}
            title="Watchlist Retention"
          />
          <ProofPanel
            rows={[
              ["Mobile users", analytics.realUserProof.mobileEngagement.activeUsers],
              ["Mobile share", formatPct(analytics.realUserProof.mobileEngagement.mobileSharePct)],
              ["Mobile useful actions", analytics.realUserProof.mobileEngagement.firstUsefulActions],
              ["Mobile friction", analytics.realUserProof.mobileEngagement.frictionEvents],
            ]}
            title="Mobile Engagement"
          />
          <ProofPanel
            rows={[
              ["Useful interactions", analytics.realUserProof.notificationUsefulness.usefulInteractions],
              ["Eligible signals", analytics.realUserProof.notificationUsefulness.eligibleSignals],
              ["Usefulness rate", formatPct(analytics.realUserProof.notificationUsefulness.usefulnessRatePct)],
              ["Preference updates", analytics.realUserProof.notificationUsefulness.preferenceUpdates],
            ]}
            title="Notification Usefulness"
          />
        </div>
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

      <section className="grid gap-5 xl:grid-cols-3">
        <MetricGroup
          rows={[
            ["Rage clicks", analytics.uxInsights.interactionQuality.rageClicks],
            ["Duplicate clicks", analytics.uxInsights.interactionQuality.duplicateClicks],
            ["Failed actions", analytics.uxInsights.interactionQuality.failedActions],
            ["Back navigation", analytics.uxInsights.interactionQuality.backNavigations],
          ]}
          title="UX Friction Signals"
        />
        <MetricGroup
          rows={[
            ["First useful actions", analytics.uxInsights.firstUsefulAction.count],
            ["Avg time to value", formatDuration(analytics.uxInsights.firstUsefulAction.averageElapsedSeconds)],
            ["Modal abandons", analytics.uxInsights.interactionQuality.modalAbandons],
            ["Scroll abandons", analytics.uxInsights.interactionQuality.scrollAbandons],
          ]}
          title="Activation Quality"
        />
        <MetricGroup
          rows={[
            ["Feed engagement", analytics.livingTelemetry.feedEngagement],
            ["Watchlist usage", analytics.livingTelemetry.watchlistUsage],
            ["Scanner usage", analytics.livingTelemetry.scannerUsage],
            ["Notifications", analytics.livingTelemetry.notificationEngagement],
          ]}
          title="Living Intelligence Usage"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <MetricGroup
          rows={[
            ["First useful action", analytics.livingTelemetry.firstUsefulAction],
            ["Replay usage", analytics.livingTelemetry.replayUsage],
            ["Strategy usage", analytics.livingTelemetry.strategyUsage],
            ["Scanner usage", analytics.livingTelemetry.scannerUsage],
          ]}
          title="Core Workflow Telemetry"
        />
        <ChartPanel subtitle="Behavior events are first-party, privacy-sanitized, and never include raw Copilot prompts." title="Telemetry Boundaries">
          <div className="grid gap-2 text-sm leading-6 text-slate-300">
            <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.06] p-3">Tracks product behavior, not brokerage credentials, payment data, or private financial data.</div>
            <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/[0.06] p-3">Copilot questions are counted by length, mode, and source only.</div>
            <div className="rounded-xl border border-violet-300/15 bg-violet-400/[0.06] p-3">Feature flags and local opt-out can disable client telemetry without breaking the app.</div>
          </div>
        </ChartPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Friction Hotspots">
          {analytics.uxInsights.frictionHotspots.length ? (
            <div className="space-y-2">
              {analytics.uxInsights.frictionHotspots.map((row) => (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={`${row.eventName}-${row.pagePath}-${row.component}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-semibold text-slate-100">{humanizeLabel(row.component)}</span>
                    <span className="font-mono text-xs text-cyan-100">{row.count.toLocaleString()}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{humanizeLabel(row.eventName)}</span>
                    <span>{row.pagePath}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No friction hotspots detected for this window.</EmptyState>
          )}
        </ChartPanel>
        <ChartPanel title="First Useful Action">
          {analytics.uxInsights.firstUsefulAction.topActions.length ? (
            <div className="space-y-2">
              {analytics.uxInsights.firstUsefulAction.topActions.map((row) => (
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" key={row.action}>
                  <span className="min-w-0 truncate text-sm font-semibold text-slate-100">{humanizeLabel(row.action)}</span>
                  <span className="font-mono text-xs text-cyan-100">{row.count.toLocaleString()}</span>
                  <span className="font-mono text-xs text-slate-400">{formatDuration(row.averageElapsedSeconds)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No first-useful-action events recorded yet.</EmptyState>
          )}
        </ChartPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ListPanel rows={analytics.uxInsights.flowAbandonment.map((row) => [`${humanizeLabel(row.eventName)} · ${row.pagePath}`, row.count])} title="Flow Abandonment" />
        <ListPanel rows={analytics.uxInsights.experimentExposure.map((row) => [`${humanizeLabel(row.experiment)} · ${row.variant}`, row.count])} title="Experiment Exposure" />
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

function ProofMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">{label}</div>
      <div className="mt-1 font-mono text-xl font-black text-white">{value}</div>
    </div>
  );
}

function ProofPanel({ rows, title }: { rows: Array<[string, number | string]>; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/42 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</div>
      <div className="mt-3 grid gap-2">
        {rows.map(([label, value]) => (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" key={label}>
            <span className="text-xs font-semibold text-slate-300">{label}</span>
            <span className="font-mono text-xs font-black text-cyan-100">{typeof value === "number" ? value.toLocaleString() : value}</span>
          </div>
        ))}
      </div>
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

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${Math.round(value)}%`;
}

function deviceColor(value: string): string {
  if (value === "mobile") return COLORS.cyan;
  if (value === "tablet") return COLORS.violet;
  if (value === "desktop") return COLORS.emerald;
  return COLORS.slate;
}

function statusPanelClass(status: string): string {
  if (status === "proven") return "border-emerald-300/25 bg-emerald-400/[0.08] shadow-emerald-950/20";
  if (status === "insufficient_data") return "border-amber-300/25 bg-amber-400/[0.08] shadow-amber-950/20";
  return "border-cyan-300/20 bg-cyan-400/[0.06] shadow-cyan-950/20";
}

function tonePanelClass(tone: string): string {
  if (tone === "positive") return "border-emerald-300/20 bg-emerald-400/[0.06]";
  if (tone === "critical") return "border-rose-300/24 bg-rose-400/[0.07]";
  if (tone === "warning") return "border-amber-300/22 bg-amber-400/[0.06]";
  return "border-white/10 bg-white/[0.03]";
}

function geoLabel(row: { city: string | null; country: string; region: string | null }): string {
  return [row.city, row.region, row.country].filter(Boolean).join(", ") || "Unknown";
}
