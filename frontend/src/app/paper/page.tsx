import { MetricStrip } from "@/components/metric-strip";
import { TerminalShell } from "@/components/shell";
import {
  getPaperAnalytics,
  getPaperData,
  type PaperAnalyticsGroupRow,
  type PaperAnalyticsSummary,
  type PaperAnalyticsTimelinePoint,
  type PaperPositionRow,
  type PaperTradeEventRow,
} from "@/lib/paper-data";

export const dynamic = "force-dynamic";

function finiteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: unknown) {
  const parsed = finiteNumber(value);
  if (parsed === null) return "N/A";
  return parsed.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function numberText(value: unknown, digits = 4) {
  const parsed = finiteNumber(value);
  if (parsed === null) return "N/A";
  return parsed.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function percentText(value: unknown) {
  const parsed = finiteNumber(value);
  if (parsed === null) return "N/A";
  return `${(parsed * 100).toFixed(2)}%`;
}

function timeText(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
}

function pnlTone(value: unknown) {
  const parsed = finiteNumber(value);
  if (parsed === null || parsed === 0) return "text-slate-300";
  return parsed > 0 ? "text-emerald-300" : "text-rose-300";
}

function decisionTone(value: string | null) {
  const text = String(value ?? "").toUpperCase();
  if (text === "ENTER") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (text === "WAIT_PULLBACK") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  if (text === "AVOID" || text === "EXIT") return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  return "border-slate-700 bg-slate-900/70 text-slate-300";
}

function closeRisk(position: PaperPositionRow) {
  const current = position.current_price ?? position.entry_price;
  if (!position.stop_loss || current <= 0) return "N/A";
  return percentText((current - position.stop_loss) / current);
}

function rewardDistance(position: PaperPositionRow) {
  const current = position.current_price ?? position.entry_price;
  if (!position.target_price || current <= 0) return "N/A";
  return percentText((position.target_price - current) / current);
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded border border-dashed border-slate-700/70 px-3 py-6 text-center text-xs text-slate-500">{message}</div>;
}

function PerformanceMetricGrid({ summary }: { summary: PaperAnalyticsSummary }) {
  const metrics: Array<{ label: string; value: string; meta: string; toneValue?: number }> = [
    { label: "Total Trades", value: summary.total_trades.toLocaleString(), meta: `${summary.closed_trades} closed` },
    { label: "Win Rate", value: percentText(summary.win_rate), meta: "closed trades" },
    { label: "Avg Return", value: percentText(summary.avg_return_pct), meta: "per closed trade", toneValue: summary.avg_return_pct },
    { label: "Total PnL", value: money(summary.total_pnl), meta: "realized + open", toneValue: summary.total_pnl },
    { label: "Unrealized", value: money(summary.total_unrealized_pnl), meta: `${summary.open_trades} open`, toneValue: summary.total_unrealized_pnl },
    { label: "Max Drawdown", value: money(summary.max_drawdown), meta: "cumulative pnl", toneValue: summary.max_drawdown },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => (
        <div className="min-w-0 rounded border border-slate-800 bg-slate-950/40 px-3 py-2" key={metric.label}>
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</div>
          <div className={`mt-1 truncate font-mono text-sm font-semibold ${metric.toneValue === undefined ? "text-slate-100" : pnlTone(metric.toneValue)}`}>
            {metric.value}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-500">{metric.meta}</div>
        </div>
      ))}
    </div>
  );
}

function topBottomGroups(groups: PaperAnalyticsGroupRow[]) {
  const nonEmptyGroups = groups.filter((group) => group.count > 0);
  const byPnlDesc = [...nonEmptyGroups].sort((a, b) => b.total_pnl - a.total_pnl);
  const rows: PaperAnalyticsGroupRow[] = [];
  const seen = new Set<string>();
  for (const group of [...byPnlDesc.slice(0, 5), ...byPnlDesc.slice(-5).reverse()]) {
    const key = `${group.group_type}:${group.group_value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(group);
  }
  return rows;
}

function AnalyticsGroupsTable({ groups }: { groups: PaperAnalyticsGroupRow[] }) {
  const rows = topBottomGroups(groups);
  if (!rows.length) return <EmptyState message="No closed trades available for grouped performance yet." />;

  return (
    <div className="overflow-x-auto rounded-md border border-slate-800">
      <table className="w-full min-w-[820px] table-fixed border-collapse text-xs">
        <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="w-40 px-2 py-2 text-left">Group Type</th>
            <th className="w-44 px-2 py-2 text-left">Value</th>
            <th className="w-20 px-2 py-2 text-right">Trades</th>
            <th className="w-28 px-2 py-2 text-right">Avg Return</th>
            <th className="w-24 px-2 py-2 text-right">Win Rate</th>
            <th className="w-28 px-2 py-2 text-right">Total PnL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/90">
          {rows.map((group) => (
            <tr className="hover:bg-sky-400/5" key={`${group.group_type}:${group.group_value}`}>
              <td className="px-2 py-2 text-slate-300">{group.group_type}</td>
              <td className="px-2 py-2 font-mono font-semibold text-slate-100">{group.group_value}</td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{group.count.toLocaleString()}</td>
              <td className={`px-2 py-2 text-right font-mono ${pnlTone(group.avg_return_pct)}`}>{percentText(group.avg_return_pct)}</td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{percentText(group.win_rate)}</td>
              <td className={`px-2 py-2 text-right font-mono ${pnlTone(group.total_pnl)}`}>{money(group.total_pnl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineList({ timeline }: { timeline: PaperAnalyticsTimelinePoint[] }) {
  const rows = timeline.slice(-14).reverse();
  if (!rows.length) return <EmptyState message="No closed-trade timeline yet." />;

  return (
    <div className="overflow-x-auto rounded-md border border-slate-800">
      <table className="w-full min-w-[460px] table-fixed border-collapse text-xs">
        <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="w-36 px-2 py-2 text-left">Date</th>
            <th className="w-28 px-2 py-2 text-right">Daily PnL</th>
            <th className="w-32 px-2 py-2 text-right">Cumulative</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/90">
          {rows.map((point) => (
            <tr className="hover:bg-sky-400/5" key={point.date}>
              <td className="px-2 py-2 text-slate-300">{point.date}</td>
              <td className={`px-2 py-2 text-right font-mono ${pnlTone(point.daily_pnl)}`}>{money(point.daily_pnl)}</td>
              <td className={`px-2 py-2 text-right font-mono ${pnlTone(point.cumulative_pnl)}`}>{money(point.cumulative_pnl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpenPositionsTable({ positions }: { positions: PaperPositionRow[] }) {
  const openPositions = positions.filter((position) => position.status === "OPEN");
  if (!openPositions.length) return <EmptyState message="No open paper positions." />;

  return (
    <div className="overflow-x-auto rounded-md border border-slate-800">
      <table className="w-full min-w-[1160px] table-fixed border-collapse text-xs">
        <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="w-20 px-2 py-2 text-left">Symbol</th>
            <th className="w-24 px-2 py-2 text-right">Entry</th>
            <th className="w-24 px-2 py-2 text-right">Last</th>
            <th className="w-24 px-2 py-2 text-right">Qty</th>
            <th className="w-24 px-2 py-2 text-right">Stop</th>
            <th className="w-24 px-2 py-2 text-right">Target</th>
            <th className="w-28 px-2 py-2 text-right">Unrealized</th>
            <th className="w-24 px-2 py-2 text-right">Return</th>
            <th className="w-32 px-2 py-2 text-left">Decision</th>
            <th className="w-24 px-2 py-2 text-right">Risk</th>
            <th className="w-24 px-2 py-2 text-right">Reward</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/90">
          {openPositions.map((position) => (
            <tr className="hover:bg-sky-400/5" key={position.id}>
              <td className="px-2 py-2 font-mono font-semibold text-slate-100">{position.symbol}</td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{numberText(position.entry_price, 2)}</td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{numberText(position.current_price, 2)}</td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{numberText(position.quantity, 4)}</td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{numberText(position.stop_loss, 2)}</td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{numberText(position.target_price, 2)}</td>
              <td className={`px-2 py-2 text-right font-mono ${pnlTone(position.unrealized_pnl)}`}>{money(position.unrealized_pnl)}</td>
              <td className={`px-2 py-2 text-right font-mono ${pnlTone(position.return_pct)}`}>{percentText(position.return_pct)}</td>
              <td className="px-2 py-2">
                <span className={`inline-flex max-w-full rounded border px-2 py-0.5 text-[11px] font-semibold ${decisionTone(position.final_decision)}`}>
                  {position.final_decision ?? "N/A"}
                </span>
              </td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{closeRisk(position)}</td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{rewardDistance(position)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClosedPositionsTable({ positions }: { positions: PaperPositionRow[] }) {
  const closedPositions = positions.filter((position) => position.status === "CLOSED").slice(0, 20);
  if (!closedPositions.length) return <EmptyState message="No closed paper trades yet." />;

  return (
    <div className="overflow-x-auto rounded-md border border-slate-800">
      <table className="w-full min-w-[760px] table-fixed border-collapse text-xs">
        <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="w-20 px-2 py-2 text-left">Symbol</th>
            <th className="w-24 px-2 py-2 text-right">Entry</th>
            <th className="w-24 px-2 py-2 text-right">Exit</th>
            <th className="w-28 px-2 py-2 text-right">PnL</th>
            <th className="w-24 px-2 py-2 text-right">Return</th>
            <th className="w-32 px-2 py-2 text-left">Reason</th>
            <th className="w-36 px-2 py-2 text-left">Closed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/90">
          {closedPositions.map((position) => (
            <tr className="hover:bg-sky-400/5" key={position.id}>
              <td className="px-2 py-2 font-mono font-semibold text-slate-100">{position.symbol}</td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{numberText(position.entry_price, 2)}</td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{numberText(position.exit_price, 2)}</td>
              <td className={`px-2 py-2 text-right font-mono ${pnlTone(position.realized_pnl)}`}>{money(position.realized_pnl)}</td>
              <td className={`px-2 py-2 text-right font-mono ${pnlTone(position.return_pct)}`}>{percentText(position.return_pct)}</td>
              <td className="px-2 py-2 text-slate-300">{position.close_reason ?? "N/A"}</td>
              <td className="px-2 py-2 text-slate-400">{timeText(position.closed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentEventsTable({ events }: { events: PaperTradeEventRow[] }) {
  if (!events.length) return <EmptyState message="No paper trade events yet." />;

  return (
    <div className="overflow-x-auto rounded-md border border-slate-800">
      <table className="w-full min-w-[880px] table-fixed border-collapse text-xs">
        <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="w-36 px-2 py-2 text-left">Time</th>
            <th className="w-20 px-2 py-2 text-left">Symbol</th>
            <th className="w-28 px-2 py-2 text-left">Event</th>
            <th className="w-32 px-2 py-2 text-left">Reason</th>
            <th className="w-24 px-2 py-2 text-right">Price</th>
            <th className="w-24 px-2 py-2 text-right">Qty</th>
            <th className="w-28 px-2 py-2 text-right">PnL Delta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/90">
          {events.map((event) => (
            <tr className="hover:bg-sky-400/5" key={event.id}>
              <td className="px-2 py-2 text-slate-400">{timeText(event.created_at)}</td>
              <td className="px-2 py-2 font-mono font-semibold text-slate-100">{event.symbol}</td>
              <td className="px-2 py-2 text-slate-300">{event.event_type}</td>
              <td className="px-2 py-2 text-slate-400">{event.event_reason ?? "N/A"}</td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{numberText(event.price, 2)}</td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{numberText(event.quantity, 4)}</td>
              <td className={`px-2 py-2 text-right font-mono ${pnlTone(event.pnl_delta)}`}>{money(event.pnl_delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PaperPage() {
  const [data, analytics] = await Promise.all([getPaperData(), getPaperAnalytics()]);
  const account = data.account;

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Cash", value: account ? money(account.cash_balance) : "N/A", meta: "paper" },
            { label: "Equity", value: account ? money(account.equity_value) : "N/A", meta: "open value" },
            { label: "Unrealized PnL", value: account ? money(account.unrealized_pnl) : "N/A", meta: "open trades" },
            { label: "Realized PnL", value: account ? money(account.realized_pnl) : "N/A", meta: "closed trades" },
            { label: "Total PnL", value: account ? money(account.total_pnl) : "N/A", meta: "realized + open" },
            { label: "Total Value", value: account ? money(account.total_account_value) : "N/A", meta: "cash + equity" },
            { label: "Open", value: account ? account.open_positions_count.toLocaleString() : "N/A", meta: "positions" },
          ]}
        />

        {!data.configured || data.error || !account ? (
          <section className="terminal-panel rounded-md p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Paper Trading</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Paper Account Unavailable</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              {data.error ?? "Run the scanner with paper trading enabled to create the default account."}
            </p>
          </section>
        ) : null}

        <section className="terminal-panel rounded-md p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Paper Performance</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Performance Analytics</h2>
          {analytics.error ? <p className="mt-2 text-sm text-rose-300">{analytics.error}</p> : null}
          <div className="mt-3">
            <PerformanceMetricGrid summary={analytics.summary} />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)]">
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Top / Bottom Groups</div>
              <AnalyticsGroupsTable groups={analytics.groups} />
            </div>
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Daily PnL</div>
              <TimelineList timeline={analytics.timeline} />
            </div>
          </div>
        </section>

        <section className="terminal-panel rounded-md p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Open Positions</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Simulated Positions</h2>
          <div className="mt-3">
            <OpenPositionsTable positions={data.positions} />
          </div>
        </section>

        <section className="terminal-panel rounded-md p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Closed Positions</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Last 20 Closed Trades</h2>
          <div className="mt-3">
            <ClosedPositionsTable positions={data.positions} />
          </div>
        </section>

        <section className="terminal-panel rounded-md p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Recent Trade Events</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Paper Event Log</h2>
          <div className="mt-3">
            <RecentEventsTable events={data.events} />
          </div>
        </section>
      </div>
    </TerminalShell>
  );
}
