import { ManualPaperTradeForm } from "@/components/paper/ManualPaperTradeForm";
import { TerminalShell } from "@/components/terminal/TerminalShell";
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

const TRUST_GROUP_TYPES = new Set(["setup_type", "final_decision", "recommendation_quality", "symbol"]);

type TrustMetrics = {
  avgRMultiple: number | null;
  bestSetup: PaperAnalyticsGroupRow | null;
  openRisk: number;
  realizedPnl: number;
  totalReturn: number | null;
  unrealizedPnl: number;
  winRate: number;
  worstSetup: PaperAnalyticsGroupRow | null;
};

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

function numberText(value: unknown, digits = 2) {
  const parsed = finiteNumber(value);
  if (parsed === null) return "N/A";
  return parsed.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function percentText(value: unknown, digits = 1) {
  const parsed = finiteNumber(value);
  if (parsed === null) return "N/A";
  return `${(parsed * 100).toFixed(digits)}%`;
}

function timeText(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
}

function cleanText(value: unknown, fallback = "N/A") {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined"].includes(text.toLowerCase())) return fallback;
  return text;
}

function labelText(value: unknown) {
  const text = cleanText(value, "Unknown");
  return text
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function systemConfidenceStatus(closedTrades: number) {
  if (closedTrades < 5) return "System confidence: Low (insufficient data)";
  if (closedTrades <= 20) return "System confidence: Developing";
  return "System confidence: Established";
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
  if (text === "MANUAL") return "border-sky-400/30 bg-sky-400/10 text-sky-100";
  return "border-slate-700 bg-slate-900/70 text-slate-300";
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-7 text-center text-sm text-slate-400">{message}</div>;
}

function isManualTrade(position: PaperPositionRow) {
  return [position.final_decision, position.recommendation_quality, position.entry_status, position.setup_type, position.rating]
    .some((value) => String(value ?? "").trim().toUpperCase() === "MANUAL");
}

function riskDollars(position: PaperPositionRow) {
  if (!position.stop_loss || position.entry_price <= 0 || position.quantity <= 0) return null;
  const riskPerShare = position.entry_price - position.stop_loss;
  if (!Number.isFinite(riskPerShare) || riskPerShare <= 0) return null;
  return riskPerShare * position.quantity;
}

function rewardDollars(position: PaperPositionRow) {
  if (!position.target_price || position.entry_price <= 0 || position.quantity <= 0) return null;
  const rewardPerShare = position.target_price - position.entry_price;
  if (!Number.isFinite(rewardPerShare) || rewardPerShare <= 0) return null;
  return rewardPerShare * position.quantity;
}

function rMultiple(position: PaperPositionRow) {
  const risk = riskDollars(position);
  const pnl = finiteNumber(position.realized_pnl);
  if (risk === null || risk <= 0 || pnl === null) return null;
  return pnl / risk;
}

function riskReward(position: PaperPositionRow) {
  const risk = riskDollars(position);
  const reward = rewardDollars(position);
  if (risk === null || reward === null || risk <= 0) return null;
  return reward / risk;
}

function buildTrustMetrics(summary: PaperAnalyticsSummary, positions: PaperPositionRow[], groups: PaperAnalyticsGroupRow[], totalAccountValue: number | null): TrustMetrics {
  const closed = positions.filter((position) => position.status.toUpperCase() === "CLOSED");
  const rValues = closed.map(rMultiple).filter((value): value is number => value !== null);
  const setupGroups = groups.filter((group) => group.group_type === "setup_type" && group.count > 0);
  const rankedSetups = [...setupGroups].sort((left, right) => right.total_pnl - left.total_pnl || right.avg_return_pct - left.avg_return_pct);
  const realizedPnl = summary.total_realized_pnl;
  const unrealizedPnl = summary.total_unrealized_pnl;
  const totalPnl = realizedPnl + unrealizedPnl;
  const startingValue = totalAccountValue !== null ? totalAccountValue - totalPnl : null;
  return {
    avgRMultiple: rValues.length ? rValues.reduce((total, value) => total + value, 0) / rValues.length : null,
    bestSetup: rankedSetups[0] ?? null,
    openRisk: positions.filter((position) => position.status.toUpperCase() === "OPEN").reduce((total, position) => total + (riskDollars(position) ?? 0), 0),
    realizedPnl,
    totalReturn: startingValue !== null && startingValue > 0 ? totalPnl / startingValue : null,
    unrealizedPnl,
    winRate: summary.win_rate,
    worstSetup: rankedSetups.length ? rankedSetups[rankedSetups.length - 1] : null,
  };
}

function TrustHeadlineCards({ metrics }: { metrics: TrustMetrics }) {
  const cards = [
    { label: "Total Return", value: percentText(metrics.totalReturn), meta: "realized + open", tone: metrics.totalReturn },
    { label: "Realized PnL", value: money(metrics.realizedPnl), meta: "closed trades", tone: metrics.realizedPnl },
    { label: "Unrealized PnL", value: money(metrics.unrealizedPnl), meta: "open positions", tone: metrics.unrealizedPnl },
    { label: "Win Rate", value: percentText(metrics.winRate), meta: "closed trades" },
    {
      label: "Average R Multiple",
      value: metrics.avgRMultiple === null ? "No closed trades yet" : `${numberText(metrics.avgRMultiple, 2)}R`,
      meta: metrics.avgRMultiple === null ? "Run more paper trades to measure performance" : "risk-normalized",
    },
    { label: "Open Risk", value: money(metrics.openRisk), meta: "active stop risk", tone: -metrics.openRisk },
    { label: "Best Setup", value: setupLabel(metrics.bestSetup), meta: setupMeta(metrics.bestSetup), tone: metrics.bestSetup?.total_pnl },
    { label: "Worst Setup", value: setupLabel(metrics.worstSetup), meta: setupMeta(metrics.worstSetup), tone: metrics.worstSetup?.total_pnl },
  ];
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl" key={card.label}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{card.label}</div>
          <div className={`mt-2 truncate font-mono text-2xl font-black ${card.tone === undefined ? "text-slate-50" : pnlTone(card.tone)}`}>{card.value}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{card.meta}</div>
        </div>
      ))}
    </section>
  );
}

function setupLabel(group: PaperAnalyticsGroupRow | null) {
  return group ? labelText(group.group_value) : "Not enough data yet";
}

function setupMeta(group: PaperAnalyticsGroupRow | null) {
  return group ? `${money(group.total_pnl)} / ${group.count} trades` : "Requires closed trades";
}

function EquityCurve({ timeline }: { timeline: PaperAnalyticsTimelinePoint[] }) {
  if (timeline.length < 2) return <EmptyState message="Not enough closed trades yet. Keep paper trading to build system confidence." />;
  const width = 720;
  const height = 220;
  const values = timeline.map((point) => point.cumulative_pnl);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const range = Math.max(1, maxValue - minValue);
  const points = timeline.map((point, index) => {
    const x = timeline.length === 1 ? 0 : (index / (timeline.length - 1)) * width;
    const y = height - ((point.cumulative_pnl - minValue) / range) * height;
    return { point, x, y };
  });
  const path = points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const zeroY = height - ((0 - minValue) / range) * height;
  const latest = timeline[timeline.length - 1];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Equity Curve</div>
          <div className={`mt-1 font-mono text-2xl font-black ${pnlTone(latest.cumulative_pnl)}`}>{money(latest.cumulative_pnl)}</div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>{timeline[0].date} to {latest.date}</div>
          <div>{timeline.length.toLocaleString()} closed-trade days</div>
        </div>
      </div>
      <svg aria-label="Daily cumulative paper PnL" className="mt-4 h-56 w-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`} role="img">
        <line stroke="rgba(148,163,184,0.2)" strokeDasharray="5 5" strokeWidth="1" x1="0" x2={width} y1={zeroY} y2={zeroY} />
        <path d={path} fill="none" stroke="rgb(34,211,238)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" vectorEffect="non-scaling-stroke" />
        {points.slice(-12).map(({ point, x, y }) => (
          <circle cx={x} cy={y} fill={point.cumulative_pnl >= 0 ? "rgb(110,231,183)" : "rgb(253,164,175)"} key={point.date} r="3.5" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {timeline.slice(-3).map((point) => (
          <div className="rounded-xl bg-slate-950/50 p-3" key={point.date}>
            <div className="text-xs text-slate-500">{point.date}</div>
            <div className={`mt-1 font-mono text-sm font-semibold ${pnlTone(point.daily_pnl)}`}>{money(point.daily_pnl)}</div>
            <div className="mt-0.5 text-xs text-slate-500">Cumulative {money(point.cumulative_pnl)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupPerformance({ groups }: { groups: PaperAnalyticsGroupRow[] }) {
  const rows = groups
    .filter((group) => TRUST_GROUP_TYPES.has(group.group_type) && group.count > 0)
    .sort((left, right) => groupRank(left.group_type) - groupRank(right.group_type) || right.total_pnl - left.total_pnl || left.group_value.localeCompare(right.group_value));
  if (!rows.length) return <EmptyState message="Not enough closed trades yet. Keep paper trading to build system confidence." />;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {rows.map((group) => (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" key={`${group.group_type}:${group.group_value}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{groupTypeLabel(group.group_type)}</div>
              <div className="mt-1 truncate text-lg font-semibold text-slate-50">{labelText(group.group_value)}</div>
            </div>
            <div className={`shrink-0 font-mono text-sm font-bold ${pnlTone(group.total_pnl)}`}>{money(group.total_pnl)}</div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <MiniMetric label="Trades" value={group.count.toLocaleString()} />
            <MiniMetric label="Win Rate" value={percentText(group.win_rate)} />
            <MiniMetric label="Avg Return" tone={group.avg_return_pct} value={percentText(group.avg_return_pct)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function groupRank(type: string) {
  if (type === "setup_type") return 0;
  if (type === "final_decision") return 1;
  if (type === "recommendation_quality") return 2;
  if (type === "symbol") return 3;
  return 4;
}

function groupTypeLabel(type: string) {
  if (type === "setup_type") return "Setup Type";
  if (type === "final_decision") return "Decision";
  if (type === "recommendation_quality") return "Recommendation Quality";
  if (type === "symbol") return "Symbol";
  return labelText(type);
}

function TradeAutopsy({ positions }: { positions: PaperPositionRow[] }) {
  const closed = positions
    .filter((position) => position.status.toUpperCase() === "CLOSED")
    .sort((left, right) => String(right.closed_at ?? "").localeCompare(String(left.closed_at ?? "")))
    .slice(0, 10);
  if (!closed.length) return <EmptyState message="Not enough closed trades yet. Keep paper trading to build system confidence." />;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {closed.map((position) => (
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" key={position.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-2xl font-black text-slate-50">{position.symbol}</div>
              <div className="mt-1 text-xs text-slate-500">{timeText(position.closed_at)}</div>
            </div>
            <div className={`rounded-full border px-3 py-1 text-xs font-bold ${decisionTone(position.final_decision)}`}>{labelText(position.final_decision)}</div>
          </div>
          {isManualTrade(position) ? <div className="mt-3 inline-flex rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-100">Manual trade</div> : null}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <MiniMetric label="Entry" value={money(position.entry_price)} />
            <MiniMetric label="Exit" value={money(position.exit_price)} />
            <MiniMetric label="PnL" tone={position.realized_pnl} value={money(position.realized_pnl)} />
            <MiniMetric label="Return" tone={position.return_pct} value={percentText(position.return_pct)} />
          </div>
          <div className="mt-4 rounded-xl bg-slate-950/50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Reason Closed</div>
            <div className="mt-1 text-sm text-slate-200">{labelText(position.close_reason)}</div>
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-300">{tradeLesson(position)}</div>
        </article>
      ))}
    </div>
  );
}

function tradeLesson(position: PaperPositionRow) {
  if (isManualTrade(position)) return "Manual trade; excluded from scanner edge.";
  const reason = String(position.close_reason ?? "").toUpperCase();
  if (reason.includes("TARGET")) return "Target hit after valid entry.";
  if (reason.includes("STOP")) return "Stopped out after high volatility.";
  if (reason.includes("EXIT")) return "Exit signal protected the paper account.";
  const pnl = finiteNumber(position.realized_pnl);
  if (pnl !== null && pnl > 0) return "Positive close; review whether the setup followed the plan.";
  if (pnl !== null && pnl < 0) return "Loss taken; check entry timing and stop placement.";
  return "Closed trade recorded; more samples will sharpen system confidence.";
}

function OpenRiskSection({ positions }: { positions: PaperPositionRow[] }) {
  const open = positions.filter((position) => position.status.toUpperCase() === "OPEN");
  if (!open.length) return <EmptyState message="No open paper positions. New paper trades will appear here with live risk context." />;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {open.map((position) => {
        const risk = riskDollars(position);
        const reward = rewardDollars(position);
        const rr = riskReward(position);
        return (
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" key={position.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-2xl font-black text-slate-50">{position.symbol}</div>
                <div className="mt-1 text-xs text-slate-500">Opened {timeText(position.opened_at)}</div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-bold ${decisionTone(position.final_decision)}`}>{labelText(position.final_decision)}</div>
            </div>
            {isManualTrade(position) ? <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">Manual trade; monitor separately from scanner edge.</div> : null}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <MiniMetric label="Current / Entry" value={`${money(position.current_price ?? position.entry_price)} / ${money(position.entry_price)}`} />
              <MiniMetric label="Stop" value={money(position.stop_loss)} />
              <MiniMetric label="Max Risk" tone={risk === null ? undefined : -risk} value={money(risk)} />
              <MiniMetric label="Target Reward" tone={reward} value={money(reward)} />
              <MiniMetric label="R/R" value={rr === null ? "N/A" : `${numberText(rr, 2)}R`} />
              <MiniMetric label="Quantity" value={numberText(position.quantity, 4)} />
              <MiniMetric label="Unrealized" tone={position.unrealized_pnl} value={money(position.unrealized_pnl)} />
              <MiniMetric label="Setup" value={labelText(position.setup_type)} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RawActivity({ events }: { events: PaperTradeEventRow[] }) {
  return (
    <details className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
      <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.22em] text-slate-400">Advanced / Raw Activity</summary>
      <div className="mt-4">
        {events.length ? (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[880px] table-fixed border-collapse text-xs">
              <thead className="border-b border-white/10 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="w-36 px-3 py-2 text-left">Time</th>
                  <th className="w-20 px-3 py-2 text-left">Symbol</th>
                  <th className="w-28 px-3 py-2 text-left">Event</th>
                  <th className="w-36 px-3 py-2 text-left">Reason</th>
                  <th className="w-24 px-3 py-2 text-right">Price</th>
                  <th className="w-24 px-3 py-2 text-right">Qty</th>
                  <th className="w-28 px-3 py-2 text-right">PnL Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {events.map((event) => (
                  <tr className="hover:bg-cyan-400/5" key={event.id}>
                    <td className="px-3 py-2 text-slate-400">{timeText(event.created_at)}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-slate-100">{event.symbol}</td>
                    <td className="px-3 py-2 text-slate-300">{labelText(event.event_type)}</td>
                    <td className="px-3 py-2 text-slate-400">{labelText(event.event_reason)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">{money(event.price)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">{numberText(event.quantity, 4)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${pnlTone(event.pnl_delta)}`}>{money(event.pnl_delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No paper trade activity yet." />
        )}
      </div>
    </details>
  );
}

function MiniMetric({ label, tone, value }: { label: string; tone?: number | null; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-950/50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`mt-1 truncate font-mono text-sm font-semibold ${tone === undefined || tone === null ? "text-slate-100" : pnlTone(tone)}`}>{value}</div>
    </div>
  );
}

function SectionShell({ children, eyebrow, title }: { children: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</div>
      <h2 className="mt-1 text-lg font-semibold text-slate-50">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function PaperPage() {
  const [data, analytics] = await Promise.all([getPaperData(), getPaperAnalytics()]);
  const account = data.account;
  const trustMetrics = buildTrustMetrics(analytics.summary, data.positions, analytics.groups, account?.total_account_value ?? null);
  const confidenceStatus = systemConfidenceStatus(analytics.summary.closed_trades);

  return (
    <TerminalShell>
      <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
          <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Paper Trust Layer</div>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-50">System confidence from paper evidence</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Closed trades, open risk, setup behavior, and paper PnL are summarized into a decision dashboard. No real broker execution is connected.
              </p>
              <div className="mt-4 inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                {confidenceStatus}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
              <div className="text-xs text-slate-500">Paper Account Value</div>
              <div className="font-mono text-xl font-black text-slate-50">{money(account?.total_account_value)}</div>
            </div>
          </div>
        </section>

        {!data.configured || data.error || !account ? (
          <SectionShell eyebrow="Paper Account" title="Paper Account Unavailable">
            <p className="max-w-3xl text-sm text-slate-400">{data.error ?? "Run the scanner with paper trading enabled to create the default account."}</p>
          </SectionShell>
        ) : null}

        <TrustHeadlineCards metrics={trustMetrics} />

        <SectionShell eyebrow="Trust Curve" title="Equity Curve">
          <EquityCurve timeline={analytics.timeline} />
        </SectionShell>

        <SectionShell eyebrow="Setup Evidence" title="Setup Performance">
          <SetupPerformance groups={analytics.groups} />
        </SectionShell>

        <SectionShell eyebrow="Trade Autopsy" title="Last 10 Closed Trades">
          <TradeAutopsy positions={data.positions} />
        </SectionShell>

        <SectionShell eyebrow="Open Risk" title="Active Paper Risk">
          <OpenRiskSection positions={data.positions} />
        </SectionShell>

        <ManualPaperTradeForm cashBalance={account?.cash_balance ?? null} />

        <RawActivity events={data.events} />

        {analytics.error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">{analytics.error}</div> : null}
      </div>
    </TerminalShell>
  );
}
