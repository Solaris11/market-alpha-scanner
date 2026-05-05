import Link from "next/link";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { GhostPortfolioCard } from "@/components/paper/GhostPortfolioCard";
import { ManualPaperTradeForm } from "@/components/paper/ManualPaperTradeForm";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { SimpleAdvancedTabs } from "@/components/ui/SimpleAdvancedTabs";
import {
  getPaperAnalytics,
  getPaperData,
  type PaperAnalyticsGroupRow,
  type PaperAnalyticsSummary,
  type PaperPositionRow,
  type PaperTradeEventRow,
} from "@/lib/paper-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { humanizeLabel } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

const TRUST_GROUP_TYPES = new Set(["setup_type", "final_decision", "recommendation_quality", "symbol"]);

type TrustMetrics = {
  avgRMultiple: number | null;
  bestSetup: PaperAnalyticsGroupRow | null;
  closedTrades: number;
  expectancy: ExpectancyMetrics;
  openRisk: number;
  realizedPnl: number;
  totalReturn: number | null;
  unrealizedPnl: number;
  winRate: number;
  worstSetup: PaperAnalyticsGroupRow | null;
};

type EquityPoint = {
  time: string;
  value: number;
};

type ExpectancyMetrics = {
  avgLoss: number | null;
  avgWin: number | null;
  expectancy: number | null;
  losses: number;
  totalTrades: number;
  winRate: number | null;
  wins: number;
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boundedReturnFraction(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  return Math.max(parsed, -1);
}

function money(value: unknown): string {
  const parsed = finiteNumber(value);
  if (parsed === null) return "N/A";
  return parsed.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function numberText(value: unknown, digits = 2): string {
  const parsed = finiteNumber(value);
  if (parsed === null) return "N/A";
  return parsed.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function percentText(value: unknown, digits = 1): string {
  const parsed = boundedReturnFraction(value);
  if (parsed === null) return "N/A";
  return `${(parsed * 100).toFixed(digits)}%`;
}

function signedPercentText(value: unknown, digits = 1): string {
  const parsed = boundedReturnFraction(value);
  if (parsed === null) return "N/A";
  const sign = parsed > 0 ? "+" : "";
  return `${sign}${(parsed * 100).toFixed(digits)}%`;
}

function rMultipleText(value: unknown, digits = 2): string {
  const parsed = finiteNumber(value);
  if (parsed === null) return "N/A";
  return `${parsed.toFixed(digits)}R`;
}

function timeText(value: string | null): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
}

function cleanText(value: unknown, fallback = "N/A"): string {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined"].includes(text.toLowerCase())) return fallback;
  return text;
}

function labelText(value: unknown): string {
  return humanizeLabel(value, "Unknown");
}

function systemConfidenceStatus(closedTrades: number): string {
  if (closedTrades < 5) return "System confidence: Low (insufficient data)";
  if (closedTrades <= 20) return "System confidence: Developing";
  return "System confidence: Established";
}

function pnlTone(value: unknown): string {
  const parsed = finiteNumber(value);
  if (parsed === null || parsed === 0) return "text-slate-300";
  return parsed > 0 ? "text-emerald-300" : "text-rose-300";
}

function decisionTone(value: string | null): string {
  const text = String(value ?? "").toUpperCase();
  if (text === "ENTER") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (text === "WAIT_PULLBACK") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  if (text === "AVOID" || text === "EXIT") return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  if (text === "MANUAL") return "border-sky-400/30 bg-sky-400/10 text-sky-100";
  return "border-slate-700 bg-slate-900/70 text-slate-300";
}

function EmptyState({ ctaHref, ctaLabel, message }: { ctaHref?: string; ctaLabel?: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-7 text-center text-sm text-slate-400">
      <div>{message}</div>
      {ctaHref && ctaLabel ? (
        <Link className="mt-4 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href={ctaHref}>
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

function isManualTrade(position: PaperPositionRow): boolean {
  return [position.final_decision, position.recommendation_quality, position.entry_status, position.setup_type, position.rating]
    .some((value) => String(value ?? "").trim().toUpperCase() === "MANUAL");
}

function riskDollars(position: PaperPositionRow): number | null {
  if (!position.stop_loss || position.entry_price <= 0 || position.quantity <= 0) return null;
  const riskPerShare = position.entry_price - position.stop_loss;
  if (!Number.isFinite(riskPerShare) || riskPerShare <= 0) return null;
  return riskPerShare * position.quantity;
}

function rewardDollars(position: PaperPositionRow): number | null {
  if (!position.target_price || position.entry_price <= 0 || position.quantity <= 0) return null;
  const rewardPerShare = position.target_price - position.entry_price;
  if (!Number.isFinite(rewardPerShare) || rewardPerShare <= 0) return null;
  return rewardPerShare * position.quantity;
}

function rMultiple(position: PaperPositionRow): number | null {
  const risk = riskDollars(position);
  const pnl = finiteNumber(position.realized_pnl);
  if (risk === null || risk <= 0 || pnl === null) return null;
  return pnl / risk;
}

function riskReward(position: PaperPositionRow): number | null {
  const risk = riskDollars(position);
  const reward = rewardDollars(position);
  if (risk === null || reward === null || risk <= 0) return null;
  return reward / risk;
}

function closedPaperPositions(positions: PaperPositionRow[]): PaperPositionRow[] {
  return positions
    .filter((position) => position.status.toUpperCase() === "CLOSED")
    .sort((left, right) => closedTradeTime(left).localeCompare(closedTradeTime(right)));
}

function closedTradeTime(position: PaperPositionRow): string {
  return position.closed_at || position.opened_at || position.id;
}

function tradePnl(position: PaperPositionRow): number {
  const entry = finiteNumber(position.entry_price);
  const exit = finiteNumber(position.exit_price);
  const quantity = finiteNumber(position.quantity);
  if (entry === null || exit === null || quantity === null || quantity <= 0) {
    return finiteNumber(position.realized_pnl) ?? 0;
  }
  return (exit - entry) * quantity;
}

function tradeReturnFraction(position: PaperPositionRow): number | null {
  const storedReturn = boundedReturnFraction(position.return_pct);
  if (storedReturn !== null) return storedReturn;

  const entry = finiteNumber(position.entry_price);
  const exit = finiteNumber(position.exit_price);
  if (entry !== null && exit !== null && entry > 0) {
    return boundedReturnFraction((exit - entry) / entry);
  }

  const realizedPnl = finiteNumber(position.realized_pnl);
  const quantity = finiteNumber(position.quantity);
  if (entry !== null && realizedPnl !== null && quantity !== null && entry > 0 && quantity > 0) {
    return boundedReturnFraction(realizedPnl / (entry * quantity));
  }

  return null;
}

function buildEquityPoints(closed: PaperPositionRow[]): EquityPoint[] {
  let cumulativePnl = 0;
  const points: EquityPoint[] = [];
  for (const position of closed) {
    const pnl = tradePnl(position);
    cumulativePnl += pnl;
    points.push({ time: closedTradeTime(position), value: cumulativePnl });
  }
  return points;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function buildExpectancy(closed: PaperPositionRow[]): ExpectancyMetrics {
  const returns = closed.map(tradeReturnFraction).filter((value): value is number => value !== null);
  const wins = returns.filter((value) => value > 0);
  const losses = returns.filter((value) => value <= 0);
  const winRate = returns.length ? wins.length / returns.length : null;
  const avgWin = average(wins);
  const avgLoss = average(losses.map((value) => Math.abs(value)));
  const expectancy = returns.length >= 3 && winRate !== null ? (winRate * (avgWin ?? 0)) - ((1 - winRate) * (avgLoss ?? 0)) : null;
  return {
    avgLoss,
    avgWin,
    expectancy,
    losses: losses.length,
    totalTrades: returns.length,
    winRate,
    wins: wins.length,
  };
}

function buildTrustMetrics(
  summary: PaperAnalyticsSummary,
  positions: PaperPositionRow[],
  groups: PaperAnalyticsGroupRow[],
  totalAccountValue: number | null,
  expectancy: ExpectancyMetrics,
): TrustMetrics {
  const closed = closedPaperPositions(positions);
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
    closedTrades: closed.length,
    expectancy,
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
    { label: "Win Rate", value: percentText(metrics.winRate), meta: "closed trades", warning: metrics.closedTrades < 3 ? "Low sample size" : null },
    {
      label: "Expected Return per Trade",
      value: metrics.expectancy.expectancy === null ? "Not enough data yet" : signedPercentText(metrics.expectancy.expectancy),
      meta: metrics.expectancy.expectancy === null ? "Requires 3 closed trades" : `${metrics.expectancy.wins} wins / ${metrics.expectancy.losses} losses`,
      tone: metrics.expectancy.expectancy,
    },
    {
      label: "Average R Multiple",
      value: metrics.avgRMultiple === null ? "No closed trades yet" : rMultipleText(metrics.avgRMultiple),
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
          <div
            className={`mt-2 truncate ${
              card.value.includes("yet") || card.value.includes("No closed") ? "text-sm font-semibold leading-6" : "font-mono text-2xl font-black"
            } ${card.tone === undefined ? "text-slate-50" : pnlTone(card.tone)}`}
          >
            {card.value}
          </div>
          <div className="mt-1 truncate text-xs text-slate-500">{card.meta}</div>
          {card.warning ? <div className="mt-2 inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-100">{card.warning}</div> : null}
        </div>
      ))}
    </section>
  );
}

function setupLabel(group: PaperAnalyticsGroupRow | null): string {
  return group ? labelText(group.group_value) : "Not enough data yet";
}

function setupMeta(group: PaperAnalyticsGroupRow | null): string {
  if (!group) return "Requires closed trades";
  return `${money(group.total_pnl)} | Based on ${group.count} ${group.count === 1 ? "trade" : "trades"}`;
}

function EquityCurve({ points }: { points: EquityPoint[] }) {
  if (!points.length) return <EmptyState message="Not enough closed trades yet. Keep paper trading to build system confidence." />;
  const width = 720;
  const height = 220;
  const paddingY = 16;
  const chartHeight = height - (paddingY * 2);
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const range = Math.max(1, maxValue - minValue);
  const chartPoints = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = points.length === 1 ? height / 2 : paddingY + chartHeight - ((point.value - minValue) / range) * chartHeight;
    return { point, x, y };
  });
  const lineY = chartPoints[0]?.y ?? height / 2;
  const path = points.length === 1
    ? `M 0 ${lineY.toFixed(2)} L ${width} ${lineY.toFixed(2)}`
    : chartPoints.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const rawZeroY = paddingY + chartHeight - ((0 - minValue) / range) * chartHeight;
  const zeroY = Math.min(height - paddingY, Math.max(paddingY, rawZeroY));
  const latest = points[points.length - 1];
  const earliest = points[0];
  const earlyData = points.length < 5;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" title={earlyData ? "Based on limited sample size" : undefined}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{points.length === 1 ? "Equity Curve (early data)" : "Equity Curve"}</div>
          <div className={`mt-1 font-mono text-2xl font-black ${pnlTone(latest.value)}`}>{money(latest.value)}</div>
        </div>
        <div className="flex flex-col items-start gap-2 text-xs text-slate-500 sm:items-end">
          {earlyData ? (
            <div className="group relative inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
              Limited sample
              <div className="pointer-events-none absolute right-0 top-8 z-10 w-56 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-left text-xs text-slate-300 opacity-0 shadow-2xl shadow-black/40 transition-opacity group-hover:opacity-100">
                Based on limited sample size
              </div>
            </div>
          ) : null}
          <div className="text-left sm:text-right">
            <div>{timeText(earliest.time)} to {timeText(latest.time)}</div>
            <div>{points.length.toLocaleString()} closed {points.length === 1 ? "trade" : "trades"}</div>
          </div>
        </div>
      </div>
      <svg aria-label="Daily cumulative paper PnL" className="mt-4 h-56 w-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <filter height="160%" id="paper-equity-glow" width="160%" x="-30%" y="-30%">
            <feGaussianBlur result="coloredBlur" stdDeviation="4" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="paper-equity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(34,211,238,0.22)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </linearGradient>
        </defs>
        <line stroke="rgba(148,163,184,0.2)" strokeDasharray="5 5" strokeWidth="1" x1="0" x2={width} y1={zeroY} y2={zeroY} />
        <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="url(#paper-equity-fill)" opacity="0.9" />
        <path d={path} fill="none" filter="url(#paper-equity-glow)" stroke="rgb(34,211,238)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" vectorEffect="non-scaling-stroke" />
        {chartPoints.slice(-12).map(({ point, x, y }, index) => (
          <circle cx={x} cy={y} fill={point.value >= 0 ? "rgb(110,231,183)" : "rgb(253,164,175)"} key={`${point.time}:${index}`} r="3.5" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {points.slice(-3).map((point, index) => (
          <div className="rounded-xl bg-slate-950/50 p-3" key={`${point.time}:summary:${index}`}>
            <div className="text-xs text-slate-500">{timeText(point.time)}</div>
            <div className={`mt-1 font-mono text-sm font-semibold ${pnlTone(point.value)}`}>{money(point.value)}</div>
            <div className="mt-0.5 text-xs text-slate-500">Cumulative paper PnL</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupPerformance({ groups }: { groups: PaperAnalyticsGroupRow[] }) {
  const rows = dedupeSetupGroups(groups)
    .sort((left, right) => groupRank(left.group_type) - groupRank(right.group_type) || right.total_pnl - left.total_pnl || left.group_value.localeCompare(right.group_value));
  if (!rows.length) return <EmptyState message="Not enough closed trades yet. Keep paper trading to build system confidence." />;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {rows.map((group) => (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" key={setupGroupKey(group)}>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{groupTypeLabel(group.group_type)}</div>
              <div className="mt-1 text-lg font-semibold text-slate-50">{labelText(group.group_value)}</div>
            </div>
            <div className={`font-mono text-sm font-bold ${pnlTone(group.total_pnl)}`}>{money(group.total_pnl)}</div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <MiniMetric label="Trades" value={group.count.toLocaleString()} />
            <MiniMetric label="Win Rate" value={percentText(group.win_rate)} />
            <MiniMetric label="Avg Return" tone={group.avg_return_pct} value={percentText(group.avg_return_pct)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function dedupeSetupGroups(groups: PaperAnalyticsGroupRow[]): PaperAnalyticsGroupRow[] {
  const deduped = new Map<string, PaperAnalyticsGroupRow>();

  for (const group of groups) {
    if (!TRUST_GROUP_TYPES.has(group.group_type) || group.count <= 0) continue;

    const key = setupGroupKey(group);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, group);
      continue;
    }

    const count = existing.count + group.count;
    deduped.set(key, {
      ...existing,
      count,
      avg_return_pct: weightedAverage(existing.avg_return_pct, existing.count, group.avg_return_pct, group.count),
      total_pnl: existing.total_pnl + group.total_pnl,
      win_rate: weightedAverage(existing.win_rate, existing.count, group.win_rate, group.count),
    });
  }

  return [...deduped.values()];
}

function setupGroupKey(group: PaperAnalyticsGroupRow): string {
  return `${group.group_type.trim().toLowerCase()}:${cleanText(group.group_value, "unknown").trim().toLowerCase()}`;
}

function weightedAverage(leftValue: number, leftCount: number, rightValue: number, rightCount: number): number {
  const totalCount = leftCount + rightCount;
  if (totalCount <= 0) return 0;
  return ((leftValue * leftCount) + (rightValue * rightCount)) / totalCount;
}

function groupRank(type: string): number {
  if (type === "setup_type") return 0;
  if (type === "final_decision") return 1;
  if (type === "recommendation_quality") return 2;
  if (type === "symbol") return 3;
  return 4;
}

function groupTypeLabel(type: string): string {
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
  if (!closed.length) return <EmptyState ctaHref="/symbol/TSM" ctaLabel="Open Simulator" message="Start your first What-If simulation to build trading confidence" />;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {closed.map((position) => (
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" key={position.id}>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="font-mono text-2xl font-black text-slate-50">{position.symbol}</div>
              <div className="mt-1 text-xs text-slate-500">{timeText(position.closed_at)}</div>
            </div>
            <div className={`rounded-full border px-3 py-1 text-xs font-bold ${decisionTone(position.final_decision)}`}>{labelText(position.final_decision)}</div>
          </div>
          {isManualTrade(position) ? <div className="mt-3 inline-flex rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-100">Manual trade</div> : null}
          <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <MiniMetric label="Entry" value={money(position.entry_price)} />
            <MiniMetric label="Exit" value={money(position.exit_price)} />
            <MiniMetric label="PnL" tone={position.realized_pnl} value={money(position.realized_pnl)} />
            <MiniMetric label="Return" tone={tradeReturnFraction(position)} value={signedPercentText(tradeReturnFraction(position))} />
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

function tradeLesson(position: PaperPositionRow): string {
  if (isManualTrade(position)) return "Manual trade; excluded from scanner edge.";
  const reason = String(position.close_reason ?? "").toUpperCase();
  if (reason === "TARGET_HIT" || reason.includes("TARGET")) return "Trade reached target after valid entry.";
  if (reason === "STOP_LOSS" || reason.includes("STOP")) return "Trade stopped out due to volatility.";
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
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="font-mono text-2xl font-black text-slate-50">{position.symbol}</div>
                <div className="mt-1 text-xs text-slate-500">Opened {timeText(position.opened_at)}</div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-bold ${decisionTone(position.final_decision)}`}>{labelText(position.final_decision)}</div>
            </div>
            {isManualTrade(position) ? <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">Manual trade; monitor separately from scanner edge.</div> : null}
            <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 md:grid-cols-4">
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
      <div className={`mt-1 font-mono text-sm font-semibold ${tone === undefined || tone === null ? "text-slate-100" : pnlTone(tone)}`}>{value}</div>
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
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) {
    return (
      <TerminalShell>
        <LegalAcceptanceRequiredState />
      </TerminalShell>
    );
  }

  const premiumAccess = hasPremiumAccess(entitlement);
  const paperScope = { userId: entitlement.user?.id ?? null };
  const [data, analytics] = await Promise.all([getPaperData(paperScope), premiumAccess ? getPaperAnalytics(paperScope) : Promise.resolve(null)]);
  const account = data.account;
  const closedPositions = closedPaperPositions(data.positions);
  const equityPoints = buildEquityPoints(closedPositions);
  const expectancy = buildExpectancy(closedPositions);
  const trustMetrics = analytics ? buildTrustMetrics(analytics.summary, data.positions, analytics.groups, account?.total_account_value ?? null, expectancy) : null;
  const confidenceStatus = systemConfidenceStatus(closedPositions.length);

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
            <p className="max-w-3xl text-sm text-slate-400">{paperErrorMessage(data.error)}</p>
          </SectionShell>
        ) : null}

        <SimpleAdvancedTabs
          simple={(
            <div className="space-y-5">
              {premiumAccess && analytics && trustMetrics ? (
                <>
                  <TrustHeadlineCards metrics={trustMetrics} />

                  <SectionShell eyebrow="Trust Curve" title={equityPoints.length === 1 ? "Equity Curve (early data)" : "Equity Curve"}>
                    <EquityCurve points={equityPoints} />
                  </SectionShell>

                  <SectionShell eyebrow="Setup Evidence" title="Setup Performance">
                    <SetupPerformance groups={analytics.groups} />
                  </SectionShell>

                  <SectionShell eyebrow="Trade Autopsy" title="Last 10 Closed Trades">
                    <TradeAutopsy positions={data.positions} />
                  </SectionShell>

                  <GhostPortfolioCard positions={data.positions} />
                </>
              ) : (
                <PremiumLockedState
                  authenticated={entitlement.authenticated}
                  compact
                  description="Paper analytics, trade autopsy, setup evidence, equity curve, and ghost portfolio are premium retention tools. Basic paper practice remains available."
                  previewItems={["Trust metrics and expectancy", "Trade autopsy and setup breakdowns", "Ghost portfolio discipline review"]}
                  title={entitlement.authenticated ? "Paper analytics are available on Premium" : "Sign in to preview paper analytics"}
                />
              )}

              <SectionShell eyebrow="Open Risk" title="Active Paper Risk">
                <OpenRiskSection positions={data.positions} />
              </SectionShell>

              <ManualPaperTradeForm cashBalance={account?.cash_balance ?? null} />
            </div>
          )}
          advanced={premiumAccess ? (
            <RawActivity events={data.events} />
          ) : (
            <PremiumLockedState
              authenticated={entitlement.authenticated}
              compact
              description="Advanced paper activity tables are premium. Keep practicing with the simulator and open risk tools, then upgrade when billing is available."
              previewItems={["Raw trade event history", "Closed-trade diagnostics", "Advanced paper audit trail"]}
              title="Advanced paper analytics are locked"
            />
          )}
        />

        {analytics?.error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">{paperErrorMessage(analytics.error)}</div> : null}
      </div>
    </TerminalShell>
  );
}

function paperErrorMessage(error: string | undefined): string {
  if (error === "paper_account_unavailable") return "Paper account data is temporarily unavailable.";
  if (error === "paper_analytics_unavailable") return "Paper analytics are temporarily unavailable.";
  return "Start your first What-If simulation to build trading confidence.";
}
