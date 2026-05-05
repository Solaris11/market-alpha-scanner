import { AICopilotPanel } from "@/components/terminal/AICopilotPanel";
import { BestTradeNowCard } from "@/components/terminal/BestTradeNowCard";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { MarketOnboarding } from "@/components/onboarding/MarketOnboarding";
import { PublicSignalPreviewList } from "@/components/premium/PublicSignalPreview";
import { PremiumAccessCta } from "@/components/premium/PremiumAccessCta";
import { DailyActionCard } from "@/components/terminal/DailyActionCard";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { MarketRegimeRadar } from "@/components/terminal/MarketRegimeRadar";
import { MetricCard } from "@/components/terminal/MetricCard";
import { MyWatchlistWidget } from "@/components/terminal/MyWatchlistWidget";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";
import { SignalCard } from "@/components/terminal/SignalCard";
import { SignalHeatmap } from "@/components/terminal/SignalHeatmap";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { TerminalRightRail } from "@/components/terminal/TerminalRightRail";
import { getActiveAlertMatches } from "@/lib/active-alert-matches";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { assertNoPremiumFields } from "@/lib/server/premium-preview";
import { getPublicMarketSummary } from "@/lib/server/public-signal-data";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { premiumAccessState } from "@/lib/security/premium-access-state";
import { buildEdgeLookup, selectBestTradeNow } from "@/lib/trading/conviction";
import { dailyActionBlocksTradeUi, getDailyAction, noTradeActionCopy } from "@/lib/trading/daily-action";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { formatMoney, formatPercent } from "@/lib/ui/formatters";
import { decisionLabel, humanizeLabel } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

export default async function TerminalPage() {
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) {
    return (
      <TerminalShell>
        <LegalAcceptanceRequiredState />
      </TerminalShell>
    );
  }

  if (!hasPremiumAccess(entitlement)) {
    const publicPreview = await getPublicMarketSummary();
    const accessState = premiumAccessState(entitlement);
    const publicAction = {
      action: "WAIT" as const,
      label: "WAIT",
      reason: publicPreview.scanSafety.active ? publicPreview.scanSafety.reason : entitlement.authenticated ? "Upgrade to Premium to unlock today's trade plan." : "Sign in with Premium to unlock today's trade plan.",
      symbol: null,
      tone: "wait" as const,
    };
    assertNoPremiumFields({ publicAction, summary: publicPreview.summary });

    return (
      <TerminalShell>
        <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
          <div className="space-y-4">
            <DailyActionCard
              action={publicAction}
              dataStatus={publicPreview.summary.scannerStatus}
              decisionDistribution={[
                { label: "WATCH", value: 0 },
                { label: "WAIT", value: 0 },
                { label: "AVOID", value: 0 },
              ]}
              whyReasons={["Premium rows are hidden in public preview.", "Decision details unlock after entitlement checks.", "Research only. Not financial advice."]}
            />
            <PublicSignalPreviewList accessState={accessState} authenticated={entitlement.authenticated} refreshOnPremium summary={publicPreview.summary} title="Market Preview" />
          </div>
          <GlassPanel className="p-5 xl:sticky xl:top-4 xl:self-start">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Premium</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">Trade plans are locked</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Account access determines whether this preview unlocks checkout or the full Premium terminal. Trade plans stay hidden until entitlement is confirmed.
            </p>
            <div className="mt-4">
              <PremiumAccessCta initialState={accessState} refreshOnPremium />
            </div>
          </GlassPanel>
        </div>
        <MarketOnboarding tradePlanHref="/opportunities" />
      </TerminalShell>
    );
  }

  const adapter = new ScannerDataAdapter();
  const [snapshot, performance, scanSafety, watchlistSymbols, activeAlertMatches] = await Promise.all([
    adapter.getTerminalSnapshot(),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    getCurrentScanSafety(),
    entitlement.user?.id ? readUserWatchlist(entitlement.user.id).catch(() => []) : Promise.resolve([]),
    getActiveAlertMatches(entitlement.user?.id ?? null).then((result) => result.matches).catch(() => []),
  ]);
  const edges = buildEdgeLookup(snapshot.signals, performance);
  const opportunityModel = buildOpportunitiesPageModel(snapshot.signals, performance);
  const best = selectBestTradeNow(snapshot.signals, edges);
  const leader = best?.row ?? snapshot.topSignals[0] ?? snapshot.signals[0];
  const dailyAction = getDailyAction({ best, fallbackRow: leader, marketRegime: snapshot.marketRegime, scanSafety });
  const tradePlanHref = leader?.symbol ? `/symbol/${leader.symbol}` : "/opportunities";
  const enterCount = snapshot.signals.filter((row) => String(row.final_decision ?? "").toUpperCase() === "ENTER").length;
  const avoidCount = snapshot.signals.filter((row) => String(row.final_decision ?? "").toUpperCase() === "AVOID").length;
  const actionBlocksTradeUi = dailyActionBlocksTradeUi(dailyAction);
  const noTradeCopy = noTradeActionCopy(dailyAction);
  const decisionDistribution = buildDecisionDistribution(snapshot.signals);
  const contextReasons = buildTodayActionReasons({ actionBlocksTradeUi, marketState: snapshot.marketRegime.label, scanSafetyStatus: scanSafety.status });

  return (
    <TerminalShell>
      <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
        <div className="space-y-4">
          <DailyActionCard action={dailyAction} dataStatus={humanizeLabel(scanSafety.status)} decisionDistribution={decisionDistribution} marketState={snapshot.marketRegime.label} whyReasons={contextReasons} />
          {actionBlocksTradeUi ? (
            <GlassPanel className="border-amber-300/25 bg-amber-400/[0.08] p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">Decision Lock</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">{noTradeCopy.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                {noTradeCopy.reason} The daily action is the source of truth. Entry levels, execution planning, and simulator CTAs are hidden until the system returns to research-signal mode.
              </p>
              <div className="mt-4 inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-100">Correct action: do nothing</div>
            </GlassPanel>
          ) : (
            <BestTradeNowCard best={best} edges={edges} regime={snapshot.marketRegime} />
          )}

          <GlassPanel className="overflow-hidden p-5">
            <div className="grid gap-5">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-300">Command Center</div>
                <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-50">Decision-first market intelligence</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                  Scanner signals, market regime, paper simulation, and risk controls are unified into one premium research workflow.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MetricCard label="Signals" value={snapshot.signals.length.toLocaleString()} meta="latest scan" />
                  {actionBlocksTradeUi ? (
                    <>
                      <MetricCard label="Mode" value="Research" meta="read-only" />
                      <MetricCard label="Action" value="No trade" meta="daily decision" />
                    </>
                  ) : (
                    <>
                      <MetricCard label="Research Signals" value={enterCount} meta="candidate count" />
                      <MetricCard label="Blocked" value={avoidCount} meta="risk filters" />
                    </>
                  )}
                  <MetricCard label="Paper PnL" value={formatMoney(snapshot.paperSummary.totalPnl)} meta={`${snapshot.paperSummary.totalTrades} trades`} tone="pnl" />
                </div>
              </div>
              <MarketRegimeRadar regime={snapshot.marketRegime} researchMode={actionBlocksTradeUi} rows={snapshot.signals} />
            </div>
          </GlassPanel>

          {!actionBlocksTradeUi ? (
            <GlassPanel className="p-5">
              <SectionTitle eyebrow="Research Queue" title="Setups to Review" meta="scanner-ranked" />
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {snapshot.topSignals.slice(0, 2).map((row) => <SignalCard edge={edges[row.symbol.toUpperCase()]} key={row.symbol} row={row} />)}
              </div>
            </GlassPanel>
          ) : null}

          {!actionBlocksTradeUi ? <SignalHeatmap rows={snapshot.signals} /> : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel className="p-5">
              <SectionTitle eyebrow="Paper Performance" title="Simulation Pulse" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MetricCard label="Trades" value={snapshot.paperSummary.totalTrades} meta="paper only" />
                <MetricCard label="Open" value={snapshot.paperSummary.openTrades} meta="positions" />
                <MetricCard label="Win Rate" value={formatPercent(snapshot.paperSummary.winRate)} meta="closed" />
                <MetricCard label="Total PnL" value={formatMoney(snapshot.paperSummary.totalPnl)} meta="realized + open" tone="pnl" />
              </div>
            </GlassPanel>
            {!actionBlocksTradeUi ? (
              <MyWatchlistWidget rows={opportunityModel.rows} />
            ) : (
              <GlassPanel className="p-5">
                <SectionTitle eyebrow="Watchlist" title="Research Mode" />
                <p className="mt-4 text-sm leading-6 text-slate-400">Watchlist entry levels are hidden while the daily action says no active trade. Review symbols without acting.</p>
              </GlassPanel>
            )}
          </div>

          <TerminalMonitoringBrief
            rows={snapshot.signals}
            scanStatus={humanizeLabel(scanSafety.status)}
            topWatchRows={opportunityModel.rows}
          />
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <TerminalRightRail
            alertMatches={activeAlertMatches}
            marketRegime={snapshot.marketRegime}
            rows={snapshot.signals}
            scanSafety={scanSafety}
            watchlistSymbols={watchlistSymbols}
          />
          {leader ? <AICopilotPanel contextLocked={actionBlocksTradeUi} lockedReason={noTradeCopy.reason} signal={leader} /> : null}
        </div>
      </div>
      <MarketOnboarding tradePlanHref={tradePlanHref} />
    </TerminalShell>
  );
}

function TerminalMonitoringBrief({
  rows,
  scanStatus,
  topWatchRows,
}: {
  rows: Array<{ final_decision?: unknown; symbol: string; decision_reason_codes?: unknown; decision_reason?: unknown; confidence_score?: unknown; final_score?: unknown }>;
  scanStatus: string;
  topWatchRows: Array<{ confidenceLabel: string; conviction: number; final_decision: string | null; final_score: number | null; symbol: string }>;
}) {
  const watchRows = topWatchRows
    .filter((row) => ["WATCH", "WAIT_PULLBACK", "AVOID"].includes(String(row.final_decision ?? "").toUpperCase()))
    .slice(0, 4);
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Next Monitor" title="Compact Market Context" meta={`Scanner ${scanStatus}`} />
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.85fr)]">
        <div className="grid gap-2 sm:grid-cols-2">
          {watchRows.length ? watchRows.map((row) => (
            <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3" key={row.symbol}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-lg font-black text-slate-50">{row.symbol}</div>
                <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300">{decisionLabel(row.final_decision)}</div>
              </div>
              <div className="mt-2 text-xs text-slate-400">Score {formatPercentLike(row.final_score)} · readiness {row.conviction} {row.confidenceLabel}</div>
            </div>
          )) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-400">No watch candidates in the latest scan. Scanner remains in research context.</div>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">What to monitor next</div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
            <li>- Whether overheated symbols cool toward cleaner risk context.</li>
            <li>- Whether WATCH rows improve confidence without new vetoes.</li>
            <li>- Whether the next scanner run keeps data freshness OK.</li>
          </ul>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400">
            {buildDecisionDistribution(rows).map((item) => (
              <div className="rounded-lg bg-white/[0.04] p-2" key={item.label}>
                <div className="font-mono text-base font-black text-slate-100">{item.value}</div>
                <div className="truncate">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function buildDecisionDistribution(rows: Array<{ final_decision?: unknown }>): Array<{ label: string; value: number }> {
  return ["WATCH", "WAIT_PULLBACK", "AVOID"].map((label) => ({
    label: decisionLabel(label),
    value: rows.filter((row) => String(row.final_decision ?? "").toUpperCase() === label).length,
  }));
}

function buildTodayActionReasons({ actionBlocksTradeUi, marketState, scanSafetyStatus }: { actionBlocksTradeUi: boolean; marketState: string; scanSafetyStatus: string }): string[] {
  if (scanSafetyStatus !== "fresh") return ["Data freshness is not ideal.", "Scanner decisions are reduced until freshness returns.", "Research only. Not financial advice."];
  if (actionBlocksTradeUi) return ["Market is overheated.", "Risk filters are blocking trade-ready context.", "No trade-ready setup passed every gate."];
  return [`Market regime: ${marketState}.`, "Review only setups with clean risk context.", "Research only. Not financial advice."];
}

function formatPercentLike(value: number | null): string {
  return value === null ? "N/A" : Math.round(value).toString();
}
