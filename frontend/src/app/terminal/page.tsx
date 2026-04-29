import { AICopilotPanel } from "@/components/terminal/AICopilotPanel";
import { BestTradeNowCard } from "@/components/terminal/BestTradeNowCard";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { MarketRegimeRadar } from "@/components/terminal/MarketRegimeRadar";
import { MetricCard } from "@/components/terminal/MetricCard";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";
import { SignalCard } from "@/components/terminal/SignalCard";
import { SignalHeatmap } from "@/components/terminal/SignalHeatmap";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { buildEdgeLookup, selectBestTradeNow } from "@/lib/trading/conviction";
import { formatMoney, formatPercent } from "@/lib/ui/formatters";

export const dynamic = "force-dynamic";

export default async function TerminalPage() {
  const adapter = new ScannerDataAdapter();
  const [snapshot, performance] = await Promise.all([
    adapter.getTerminalSnapshot(),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
  ]);
  const edges = buildEdgeLookup(snapshot.signals, performance);
  const best = selectBestTradeNow(snapshot.signals, edges);
  const leader = best?.row ?? snapshot.topSignals[0] ?? snapshot.signals[0];
  const enterCount = snapshot.signals.filter((row) => String(row.final_decision ?? "").toUpperCase() === "ENTER").length;
  const avoidCount = snapshot.signals.filter((row) => String(row.final_decision ?? "").toUpperCase() === "AVOID").length;

  return (
    <TerminalShell>
      <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
        <div className="space-y-4">
          <BestTradeNowCard best={best} edges={edges} regime={snapshot.marketRegime} />

          <GlassPanel className="overflow-hidden p-5">
            <div className="grid gap-5">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-300">Command Center</div>
                <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-50">Decision-first market intelligence</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                  Scanner signals, market regime, mock execution, and paper performance are unified into one premium trading workflow.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MetricCard label="Signals" value={snapshot.signals.length.toLocaleString()} meta="latest scan" />
                  <MetricCard label="ENTER" value={enterCount} meta="trade ready" />
                  <MetricCard label="AVOID" value={avoidCount} meta="blocked" />
                  <MetricCard label="Paper PnL" value={formatMoney(snapshot.paperSummary.totalPnl)} meta={`${snapshot.paperSummary.totalTrades} trades`} tone="pnl" />
                </div>
              </div>
              <MarketRegimeRadar regime={snapshot.marketRegime} rows={snapshot.signals} />
            </div>
          </GlassPanel>

          <GlassPanel className="p-5">
            <SectionTitle eyebrow="Top Opportunities" title="What Should I Buy?" meta="scanner-ranked" />
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.topSignals.slice(0, 6).map((row) => <SignalCard edge={edges[row.symbol.toUpperCase()]} key={row.symbol} row={row} />)}
            </div>
          </GlassPanel>

          <SignalHeatmap rows={snapshot.signals} />

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
            <GlassPanel className="p-5">
              <SectionTitle eyebrow="Watchlist Radar" title="High-Intent Names" />
              <div className="mt-4 flex flex-wrap gap-2">
                {snapshot.topSignals.slice(0, 14).map((row) => <a className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-slate-200 hover:bg-white/10" href={`/symbol/${row.symbol}`} key={row.symbol}>{row.symbol}</a>)}
              </div>
            </GlassPanel>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          {leader ? <AICopilotPanel signal={leader} /> : null}
        </div>
      </div>
    </TerminalShell>
  );
}
