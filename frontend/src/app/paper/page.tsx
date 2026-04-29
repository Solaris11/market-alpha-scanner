import { MetricStrip } from "@/components/metric-strip";
import { TerminalShell } from "@/components/shell";
import { getPaperData, type PaperPositionRow, type PaperTradeEventRow } from "@/lib/paper-data";

export const dynamic = "force-dynamic";

function money(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "N/A";
  return parsed.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function numberText(value: unknown, digits = 4) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "N/A";
  return parsed.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function percentText(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "N/A";
  return `${(parsed * 100).toFixed(2)}%`;
}

function timeText(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
}

function pnlTone(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) return "text-slate-300";
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

function EmptyState({ message }: { message: string }) {
  return <div className="rounded border border-dashed border-slate-700/70 px-3 py-6 text-center text-xs text-slate-500">{message}</div>;
}

function OpenPositionsTable({ positions }: { positions: PaperPositionRow[] }) {
  const openPositions = positions.filter((position) => position.status === "OPEN");
  if (!openPositions.length) return <EmptyState message="No open paper positions." />;

  return (
    <div className="overflow-x-auto rounded-md border border-slate-800">
      <table className="w-full min-w-[980px] table-fixed border-collapse text-xs">
        <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="w-20 px-2 py-2 text-left">Symbol</th>
            <th className="w-24 px-2 py-2 text-right">Entry</th>
            <th className="w-24 px-2 py-2 text-right">Last</th>
            <th className="w-24 px-2 py-2 text-right">Qty</th>
            <th className="w-24 px-2 py-2 text-right">Stop</th>
            <th className="w-24 px-2 py-2 text-right">Target</th>
            <th className="w-28 px-2 py-2 text-right">Unrealized</th>
            <th className="w-32 px-2 py-2 text-left">Decision</th>
            <th className="w-24 px-2 py-2 text-right">Close Risk</th>
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
              <td className="px-2 py-2">
                <span className={`inline-flex max-w-full rounded border px-2 py-0.5 text-[11px] font-semibold ${decisionTone(position.final_decision)}`}>
                  {position.final_decision ?? "N/A"}
                </span>
              </td>
              <td className="px-2 py-2 text-right font-mono text-slate-300">{closeRisk(position)}</td>
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
  const data = await getPaperData();
  const account = data.account;

  return (
    <TerminalShell>
      <div className="space-y-3">
        <MetricStrip
          metrics={[
            { label: "Cash", value: account ? money(account.cash_balance) : "N/A", meta: "paper" },
            { label: "Equity", value: account ? money(account.equity_value) : "N/A", meta: "open value" },
            { label: "Realized PnL", value: account ? money(account.realized_pnl) : "N/A", meta: "closed trades" },
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
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Open Positions</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Simulated Positions</h2>
          <div className="mt-3">
            <OpenPositionsTable positions={data.positions} />
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
