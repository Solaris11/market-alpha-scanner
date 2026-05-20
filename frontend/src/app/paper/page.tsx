import Link from "next/link";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { GhostPortfolioCard } from "@/components/paper/GhostPortfolioCard";
import { ManualPortfolioScenarioLab } from "@/components/paper/ManualPortfolioScenarioLab";
import { ManualPaperTradeForm } from "@/components/paper/ManualPaperTradeForm";
import { PortfolioIntelligencePanel } from "@/components/paper/PortfolioIntelligencePanel";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { ResponsiveAdvancedDetails } from "@/components/ui/ResponsiveAdvancedDetails";
import { SimpleAdvancedTabs } from "@/components/ui/SimpleAdvancedTabs";
import {
  CinematicClusterMosaic,
  CinematicHeatMatrix,
  CinematicTimeline,
  type CinematicCluster,
  type CinematicHeatCell,
  type CinematicTimelineItem,
} from "@/components/visual/CinematicIntelligencePanels";
import type { ScoreFactor, VisualTone } from "@/components/visual/MiniVisuals";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import {
  getPaperAnalytics,
  getPaperData,
  type PaperAnalyticsGroupRow,
  type PaperAnalyticsSummary,
  type PaperPositionRow,
  type PaperTradeEventRow,
} from "@/lib/paper-data";
import { getPerformanceData } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { buildPortfolioIntelligenceSystem } from "@/lib/trading/portfolio-intelligence";
import { buildScenarioIntelligenceSystem } from "@/lib/trading/scenario-intelligence";
import { buildSimulatedAiPortfolioSystem, type SimulatedAiPortfolioSystem, type SimulatedPortfolioModeResult } from "@/lib/trading/simulated-ai-portfolio";
import { buildStrategyIntelligenceSystem } from "@/lib/trading/strategy-intelligence";
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

type PaperTradeLifecycleStep = {
  date: string;
  detail: string;
  label: string;
  tone: "cyan" | "emerald" | "rose" | "amber" | "slate";
  value: string;
};

type PaperTradeAutopsyModel = {
  confidence: string;
  lifecycle: PaperTradeLifecycleStep[];
  macroContext: string;
  positionSize: string;
  replayContext: string;
  systemLearned: string;
  whatFailed: string[];
  whatWorked: string[];
};

type PaperRiskConcentrationItem = {
  detail: string;
  label: string;
  symbols: string[];
  tone: "cyan" | "emerald" | "rose" | "amber" | "slate";
  value: string;
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
    { label: "Win Rate", value: percentText(metrics.winRate), meta: "closed trades", warning: metrics.closedTrades < 3 ? "Early/low evidence" : null },
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

function paperPositionNotional(position: PaperPositionRow): number | null {
  const entry = finiteNumber(position.entry_price);
  const quantity = finiteNumber(position.quantity);
  if (entry === null || quantity === null || entry <= 0 || quantity <= 0) return null;
  return entry * quantity;
}

function paperConfidenceContext(position: PaperPositionRow): string {
  const rating = cleanText(position.rating, "");
  if (rating) return labelText(rating);
  const quality = cleanText(position.recommendation_quality, "");
  if (quality) return labelText(quality);
  const decision = cleanText(position.final_decision, "");
  if (decision) return labelText(decision);
  return "Limited confidence evidence";
}

function paperReplayContext(position: PaperPositionRow): string {
  const setup = cleanText(position.setup_type, "");
  if (!setup || isManualTrade(position)) return "No replay packet is attached to this paper row; review symbol replay separately before treating the sample as pattern evidence.";
  return `${labelText(setup)} paper sample. Replay analog detail is not stored on the paper row, so this is setup-context evidence rather than validated replay proof.`;
}

function paperMacroContext(position: PaperPositionRow): string {
  const decision = cleanText(position.final_decision, "");
  const quality = cleanText(position.recommendation_quality, "");
  if (!decision && !quality) return "No macro snapshot is stored on this paper trade row.";
  return `Decision snapshot: ${decision ? labelText(decision) : "Limited"}. Recommendation quality: ${quality ? labelText(quality) : "Limited"}. Macro-specific attribution is not stored on this paper row.`;
}

function paperTradeAutopsy(position: PaperPositionRow): PaperTradeAutopsyModel {
  const pnl = tradePnl(position);
  const returnFraction = tradeReturnFraction(position);
  const notional = paperPositionNotional(position);
  const rr = riskReward(position);
  const worked: string[] = [];
  const failed: string[] = [];
  const closeReason = String(position.close_reason ?? "").toUpperCase();
  if (pnl > 0) worked.push(`Paper trade closed with positive P/L of ${money(pnl)}.`);
  if (returnFraction !== null && returnFraction > 0) worked.push(`Return was ${signedPercentText(returnFraction)} on the planned entry.`);
  if (closeReason.includes("TARGET")) worked.push("Exit reason indicates the target plan was reached.");
  if (position.stop_loss !== null) worked.push("A stop level was recorded before review.");
  if (position.target_price !== null) worked.push("A target level was recorded before review.");
  if (rr !== null && rr >= 2) worked.push(`Planned reward/risk was favorable at ${rMultipleText(rr)}.`);

  if (pnl < 0) failed.push(`Paper trade closed with negative P/L of ${money(pnl)}.`);
  if (closeReason.includes("STOP")) failed.push("Exit reason indicates stop-loss pressure.");
  if (position.stop_loss === null) failed.push("No stop level was stored, so risk discipline evidence is limited.");
  if (position.target_price === null) failed.push("No target level was stored, so reward discipline evidence is limited.");
  if (rr !== null && rr < 1.5) failed.push(`Planned reward/risk was thin at ${rMultipleText(rr)}.`);
  if (isManualTrade(position)) failed.push("Manual trade; scanner and replay context were not the primary entry evidence.");

  const systemLearned = isManualTrade(position)
    ? "Keep manual trades separated from scanner-driven edge so strategy confidence is not overstated."
    : pnl < 0
      ? "Reduce repetition of similar paper entries until timing, stop placement, or evidence quality improves."
      : "Preserve the entry discipline that produced a positive paper outcome, while still requiring more samples.";

  return {
    confidence: paperConfidenceContext(position),
    lifecycle: paperLifecycleFor(position, systemLearned),
    macroContext: paperMacroContext(position),
    positionSize: `${numberText(position.quantity, 4)} shares / ${money(notional)} notional`,
    replayContext: paperReplayContext(position),
    systemLearned,
    whatFailed: failed.length ? failed.slice(0, 5) : ["No major failure field was visible on this paper row; evidence remains sample-limited."],
    whatWorked: worked.length ? worked.slice(0, 5) : ["Closed paper trade is recorded, but stored fields do not show a dominant strength yet."],
  };
}

function paperLifecycleFor(position: PaperPositionRow, systemLearned: string): PaperTradeLifecycleStep[] {
  return [
    {
      date: timeText(position.opened_at),
      detail: `${numberText(position.quantity, 4)} shares were opened at ${money(position.entry_price)}.`,
      label: "Entry",
      tone: "cyan",
      value: money(paperPositionNotional(position)),
    },
    {
      date: timeText(position.opened_at),
      detail: `Stop ${money(position.stop_loss)} / target ${money(position.target_price)} / reward-risk ${riskReward(position) === null ? "N/A" : rMultipleText(riskReward(position))}.`,
      label: "Risk plan",
      tone: riskDollars(position) === null ? "amber" : "emerald",
      value: money(riskDollars(position)),
    },
    {
      date: timeText(position.closed_at),
      detail: `Closed at ${money(position.exit_price)} with reason ${labelText(position.close_reason)}.`,
      label: "Exit",
      tone: tradePnl(position) > 0 ? "emerald" : tradePnl(position) < 0 ? "rose" : "slate",
      value: money(tradePnl(position)),
    },
    {
      date: timeText(position.closed_at),
      detail: systemLearned,
      label: "Learning",
      tone: tradePnl(position) >= 0 ? "emerald" : "amber",
      value: paperConfidenceContext(position),
    },
  ];
}

function TradeAutopsy({ positions }: { positions: PaperPositionRow[] }) {
  const closed = positions
    .filter((position) => position.status.toUpperCase() === "CLOSED")
    .sort((left, right) => String(right.closed_at ?? "").localeCompare(String(left.closed_at ?? "")))
    .slice(0, 10);
  if (!closed.length) return <EmptyState ctaHref="/symbol/TSM" ctaLabel="Open Simulator" message="Start your first What-If simulation to build trading confidence" />;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {closed.map((position) => {
        const autopsy = paperTradeAutopsy(position);
        return (
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
              <MiniMetric label="Position Size" value={autopsy.positionSize} />
              <MiniMetric label="Confidence" value={autopsy.confidence} />
              <MiniMetric label="PnL" tone={tradePnl(position)} value={money(tradePnl(position))} />
              <MiniMetric label="Return" tone={tradeReturnFraction(position)} value={signedPercentText(tradeReturnFraction(position))} />
            </div>
            <div className="mt-4 grid gap-2">
              {autopsy.lifecycle.map((step) => (
                <div className={`rounded-xl border p-3 ${paperToneClass(step.tone)}`} key={`${position.id}:${step.label}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{step.label}</div>
                      <div className="mt-1 text-xs text-slate-400">{step.date}</div>
                    </div>
                    <div className="font-mono text-xs font-black text-slate-100">{step.value}</div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{step.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              <PaperAutopsyBlock items={autopsy.whatWorked} title="What worked" tone="emerald" />
              <PaperAutopsyBlock items={autopsy.whatFailed} title="What failed / limited" tone="rose" />
              <div className="rounded-xl border border-violet-300/18 bg-violet-400/[0.06] p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-100">Replay context</div>
                <p className="mt-1 text-xs leading-5 text-slate-300">{autopsy.replayContext}</p>
                <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-100">Macro context</div>
                <p className="mt-1 text-xs leading-5 text-slate-300">{autopsy.macroContext}</p>
              </div>
              <div className="rounded-xl border border-cyan-300/18 bg-cyan-400/[0.06] p-3 text-sm leading-6 text-slate-300">{autopsy.systemLearned}</div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function PaperAutopsyBlock({ items, title, tone }: { items: string[]; title: string; tone: PaperTradeLifecycleStep["tone"] }) {
  return (
    <div className={`rounded-xl border p-3 ${paperToneClass(tone)}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</div>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-300">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function paperToneClass(tone: PaperTradeLifecycleStep["tone"]): string {
  if (tone === "emerald") return "border-emerald-300/18 bg-emerald-400/[0.055]";
  if (tone === "rose") return "border-rose-300/18 bg-rose-400/[0.055]";
  if (tone === "amber") return "border-amber-300/18 bg-amber-400/[0.055]";
  if (tone === "cyan") return "border-cyan-300/18 bg-cyan-400/[0.055]";
  return "border-white/10 bg-slate-950/50";
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

function PaperHowToUse() {
  return (
    <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.055] p-5 shadow-xl shadow-black/20 ring-1 ring-cyan-300/10 backdrop-blur-xl">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">How to use this page</div>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Practice the process before real money</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
        Use Paper Trading to test entry, stop, target, and position size ideas. The page tracks simulated behavior so you can review discipline, risk, and setup quality without treating it as advice.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ["1. Create a paper trade", "Choose a symbol, planned entry, stop, target, and size."],
          ["2. Monitor open risk", "Watch exposure and invalidation before adding new simulated positions."],
          ["3. Review closed trades", "Use the trade review to learn what worked, what failed, and why."],
        ].map(([title, copy]) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3" key={title}>
            <div className="text-sm font-semibold text-slate-100">{title}</div>
            <p className="mt-1 text-xs leading-5 text-slate-400">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function paperClampScore(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function paperEvidenceScore(count: number): number | null {
  if (count <= 0) return null;
  return paperClampScore(Math.min(100, count * 12));
}

function paperReturnScore(value: number | null): number | null {
  if (value === null) return null;
  return paperClampScore(50 + value * 500);
}

function paperRiskPressure(openRisk: number | null, accountValue: number | null): number | null {
  if (openRisk === null || accountValue === null || accountValue <= 0) return null;
  return paperClampScore((openRisk / accountValue) * 1000);
}

function paperFactor(label: string, value: number | null, tone: VisualTone): ScoreFactor {
  return { label, tone, value };
}

function PaperCinematicSimulationSystem({
  accountValue,
  closedPositions,
  equityPoints,
  events,
  positions,
  trustMetrics,
}: {
  accountValue: number | null;
  closedPositions: PaperPositionRow[];
  equityPoints: EquityPoint[];
  events: PaperTradeEventRow[];
  positions: PaperPositionRow[];
  trustMetrics: TrustMetrics | null;
}) {
  const openPositions = positions.filter((position) => position.status.toUpperCase() === "OPEN");
  const openRisk = trustMetrics?.openRisk ?? openPositions.reduce((total, position) => total + (riskDollars(position) ?? 0), 0);
  const riskPressure = paperRiskPressure(openRisk, accountValue);
  const expectancyScore = paperReturnScore(trustMetrics?.expectancy.expectancy ?? null);
  const equityValues = equityPoints.map((point) => point.value);
  const clusters: CinematicCluster[] = [
    {
      emptyMessage: "Close paper trades to build a validated equity path.",
      eyebrow: "Simulation equity",
      factors: [
        paperFactor("Closed Evidence", paperEvidenceScore(closedPositions.length), "cyan"),
        paperFactor("Total Return", paperReturnScore(trustMetrics?.totalReturn ?? null), "emerald"),
        paperFactor("Win Rate", trustMetrics?.winRate === undefined ? null : (trustMetrics.winRate * 100), "emerald"),
      ],
      footer: "Paper trading only. Not live brokerage execution.",
      icon: <span className="font-mono text-lg font-black">EQ</span>,
      items: closedPositions.slice(-6).reverse().map((position) => ({
        detail: `${timeText(position.closed_at)} - ${labelText(position.close_reason)}`,
        href: `/symbol/${encodeURIComponent(position.symbol)}`,
        label: position.symbol,
        tone: tradePnl(position) >= 0 ? "emerald" : "rose",
        value: money(tradePnl(position)),
      })),
      metric: money(equityValues.at(-1) ?? null),
      metricLabel: "paper pnl",
      score: paperEvidenceScore(closedPositions.length),
      summary: closedPositions.length ? `${closedPositions.length} closed paper trades are shaping the simulated equity path.` : "No closed paper trades yet.",
      title: "Paper Equity Evolution",
      tone: "cyan",
      values: equityValues,
    },
    {
      emptyMessage: "Open simulated positions will appear here with stop-risk context.",
      eyebrow: "Open risk",
      factors: [
        paperFactor("Open Risk", riskPressure, "rose"),
        paperFactor("Open Positions", openPositions.length ? Math.min(100, openPositions.length * 18) : null, "amber"),
      ],
      icon: <span className="font-mono text-lg font-black">R</span>,
      items: openPositions.slice(0, 6).map((position) => ({
        detail: `Entry ${money(position.entry_price)} / stop ${money(position.stop_loss)} / target ${money(position.target_price)}`,
        href: `/symbol/${encodeURIComponent(position.symbol)}`,
        label: position.symbol,
        tone: "amber",
        value: money(riskDollars(position)),
      })),
      metric: money(openRisk),
      metricLabel: "open stop risk",
      score: riskPressure,
      summary: openPositions.length ? `${openPositions.length} open paper positions carry simulated stop-risk context.` : "No open paper risk right now.",
      title: "Open Risk Exposure",
      tone: "amber",
      values: openPositions.map((position) => riskDollars(position)),
    },
    {
      emptyMessage: "At least three closed trades are needed before expectancy becomes useful.",
      eyebrow: "Outcome behavior",
      factors: [
        paperFactor("Expectancy", expectancyScore, "violet"),
        paperFactor("Wins", trustMetrics ? paperEvidenceScore(trustMetrics.expectancy.wins) : null, "emerald"),
        paperFactor("Losses", trustMetrics ? paperEvidenceScore(trustMetrics.expectancy.losses) : null, "rose"),
      ],
      icon: <span className="font-mono text-lg font-black">EX</span>,
      items: [
        {
          detail: "Average simulated return after win/loss mix.",
          label: "Expected return/trade",
          tone: expectancyScore !== null && expectancyScore >= 50 ? "emerald" : "amber",
          value: trustMetrics?.expectancy.expectancy === null || trustMetrics === null ? "Limited" : signedPercentText(trustMetrics.expectancy.expectancy),
        },
        {
          detail: "Risk-normalized paper outcome.",
          label: "Average R multiple",
          tone: (trustMetrics?.avgRMultiple ?? 0) >= 0 ? "emerald" : "rose",
          value: trustMetrics?.avgRMultiple === null || trustMetrics === null ? "Limited" : rMultipleText(trustMetrics.avgRMultiple),
        },
      ],
      metric: trustMetrics?.expectancy.expectancy === null || trustMetrics === null ? "Limited" : signedPercentText(trustMetrics.expectancy.expectancy),
      metricLabel: "expectancy",
      score: expectancyScore,
      summary: "Expectancy stays hidden behind evidence quality; early samples are explicitly labeled as limited.",
      title: "Expectancy and Discipline Cluster",
      tone: "violet",
      values: [trustMetrics?.expectancy.winRate ? trustMetrics.expectancy.winRate * 100 : null, expectancyScore, paperEvidenceScore(closedPositions.length)],
    },
    {
      emptyMessage: "Setup behavior needs closed paper trade samples.",
      eyebrow: "Behavior memory",
      factors: [
        paperFactor("Best Setup", trustMetrics?.bestSetup ? paperReturnScore(trustMetrics.bestSetup.avg_return_pct) : null, "emerald"),
        paperFactor("Weakest Setup", trustMetrics?.worstSetup ? paperReturnScore(trustMetrics.worstSetup.avg_return_pct) : null, "rose"),
      ],
      icon: <span className="font-mono text-lg font-black">M</span>,
      items: [
        trustMetrics?.bestSetup ? {
          detail: setupMeta(trustMetrics.bestSetup),
          label: `Best: ${setupLabel(trustMetrics.bestSetup)}`,
          tone: "emerald" as const,
          value: money(trustMetrics.bestSetup.total_pnl),
        } : null,
        trustMetrics?.worstSetup ? {
          detail: setupMeta(trustMetrics.worstSetup),
          label: `Weak: ${setupLabel(trustMetrics.worstSetup)}`,
          tone: "rose" as const,
          value: money(trustMetrics.worstSetup.total_pnl),
        } : null,
      ].filter((item): item is NonNullable<typeof item> => item !== null),
      metric: closedPositions.length.toLocaleString(),
      metricLabel: "closed samples",
      score: paperEvidenceScore(closedPositions.length),
      summary: "Closed paper trades build a behavior memory for setups, decisions, and symbols.",
      title: "Paper Behavior Memory",
      tone: "emerald",
      values: [
        paperReturnScore(trustMetrics?.bestSetup?.avg_return_pct ?? null),
        paperReturnScore(trustMetrics?.worstSetup?.avg_return_pct ?? null),
      ],
    },
  ];
  const heatCells: CinematicHeatCell[] = [
    { detail: "Closed paper trades available for review.", label: "Closed evidence", tone: "cyan", value: paperEvidenceScore(closedPositions.length) },
    { detail: "Current simulated stop-risk pressure.", label: "Open risk", tone: "rose", value: riskPressure },
    { detail: "Win rate from closed paper trades.", label: "Win rate", tone: "emerald", value: trustMetrics ? trustMetrics.winRate * 100 : null },
    { detail: "Expected return per paper trade after enough samples.", label: "Expectancy", tone: "violet", value: expectancyScore },
    { detail: "Open simulated position count.", label: "Open positions", tone: "amber", value: openPositions.length ? Math.min(100, openPositions.length * 18) : null },
    { detail: "Account value availability for risk context.", label: "Account context", tone: "cyan", value: accountValue === null ? null : 100 },
  ];
  const timelineItems: CinematicTimelineItem[] = events
    .slice()
    .sort((left, right) => String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")))
    .slice(0, 7)
    .map((event) => ({
      detail: `${labelText(event.event_type)} - ${labelText(event.event_reason)} at ${money(event.price)}`,
      href: event.symbol ? `/symbol/${encodeURIComponent(event.symbol)}` : undefined,
      label: event.symbol || "Paper event",
      timestamp: timeText(event.created_at),
      tone: (finiteNumber(event.pnl_delta) ?? 0) >= 0 ? "emerald" : "rose",
    }));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
      <CinematicClusterMosaic
        clusters={clusters}
        eyebrow="Paper simulation command layer"
        summary="A denser paper-trading view that combines equity path, open risk, expectancy, and behavior memory without inventing performance."
        title="Simulation Command Center"
      />
      <div className="grid gap-4">
        <CinematicHeatMatrix cells={heatCells} title="Paper Risk Heat" />
        <CinematicTimeline emptyMessage="No paper trade events have been recorded yet." items={timelineItems} title="Paper Event Timeline" />
      </div>
    </div>
  );
}

function PaperPortfolioRealismPanel({
  accountValue,
  positions,
}: {
  accountValue: number | null;
  positions: PaperPositionRow[];
}) {
  const open = positions.filter((position) => position.status.toUpperCase() === "OPEN");
  const closed = closedPaperPositions(positions).slice(-6).reverse();
  const openNotional = open.reduce((sum, position) => sum + (paperPositionNotional(position) ?? 0), 0);
  const openRisk = open.reduce((sum, position) => sum + (riskDollars(position) ?? 0), 0);
  const closedPnl = closed.reduce((sum, position) => sum + tradePnl(position), 0);
  const concentrations = paperRiskConcentrations(positions, accountValue);

  return (
    <section className="poster-panel poster-panel-lab rounded-3xl border border-cyan-300/18 p-5 shadow-2xl shadow-black/25 ring-1 ring-white/5">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">Portfolio realism layer</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Paper capital, lifecycle, and concentration are tracked explicitly.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            This panel uses stored paper positions only: quantity, entry, stop, target, exit, realized P/L, and available TradeVeto decision labels.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:w-[620px]">
          <MiniMetric label="Open Notional" value={money(openNotional)} />
          <MiniMetric label="Open Stop Risk" tone={-openRisk} value={money(openRisk)} />
          <MiniMetric label="Recent Closed PnL" tone={closedPnl} value={money(closedPnl)} />
          <MiniMetric label="Account Coverage" value={accountValue === null || accountValue <= 0 ? "Limited" : `${((openNotional / accountValue) * 100).toFixed(1)}%`} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Real allocation history</div>
              <div className="mt-1 text-sm font-semibold text-slate-100">Current paper deployment by position</div>
            </div>
            <div className="text-xs text-slate-500">{open.length} open position(s)</div>
          </div>
          {open.length ? (
            <div className="mt-4 space-y-2">
              {open.slice(0, 8).map((position) => {
                const notional = paperPositionNotional(position);
                const stopRisk = riskDollars(position);
                const accountPct = accountValue !== null && accountValue > 0 && notional !== null ? (notional / accountValue) * 100 : null;
                return (
                  <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3" key={position.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-black text-slate-50">{position.symbol}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">{labelText(position.setup_type)} / {labelText(position.final_decision)}</div>
                      </div>
                      <div className="text-right font-mono text-xs font-black text-cyan-100">{accountPct === null ? "Limited" : `${accountPct.toFixed(1)}%`}</div>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-800">
                      <div className="h-2 rounded-full bg-cyan-300" style={{ width: `${Math.min(100, Math.max(0, accountPct ?? 0))}%` }} />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                      <MiniMetric label="Notional" value={money(notional)} />
                      <MiniMetric label="Stop Risk" tone={stopRisk === null ? null : -stopRisk} value={money(stopRisk)} />
                      <MiniMetric label="Confidence" value={paperConfidenceContext(position)} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState message="No open paper allocation is available. Open positions will show notional, stop risk, confidence label, and account exposure here." />
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-amber-300/16 bg-amber-400/[0.045] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">Risk concentration tracking</div>
            <div className="mt-3 grid gap-2">
              {concentrations.map((item) => (
                <div className={`rounded-xl border p-3 ${paperToneClass(item.tone)}`} key={item.label}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-50">{item.label}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
                    </div>
                    <div className="shrink-0 font-mono text-xs font-black text-slate-100">{item.value}</div>
                  </div>
                  {item.symbols.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.symbols.map((symbol) => <span className="rounded-full border border-white/10 bg-slate-950/55 px-2 py-1 font-mono text-[10px] font-black text-cyan-100" key={symbol}>{symbol}</span>)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-300/16 bg-violet-400/[0.045] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-100">Recent lifecycle reviews</div>
            <div className="mt-3 space-y-2">
              {closed.length ? closed.slice(0, 3).map((position) => {
                const autopsy = paperTradeAutopsy(position);
                return (
                  <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3" key={position.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-sm font-black text-slate-50">{position.symbol}</div>
                        <div className="mt-1 text-xs text-slate-500">{autopsy.confidence}</div>
                      </div>
                      <div className={`font-mono text-xs font-black ${pnlTone(tradePnl(position))}`}>{money(tradePnl(position))}</div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{autopsy.systemLearned}</p>
                  </div>
                );
              }) : <EmptyState message="Closed paper trades will create lifecycle reviews here." />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function paperRiskConcentrations(positions: PaperPositionRow[], accountValue: number | null): PaperRiskConcentrationItem[] {
  const open = positions.filter((position) => position.status.toUpperCase() === "OPEN");
  const totalNotional = open.reduce((sum, position) => sum + (paperPositionNotional(position) ?? 0), 0);
  const totalRisk = open.reduce((sum, position) => sum + (riskDollars(position) ?? 0), 0);
  const setup = largestPaperGroup(open, (position) => labelText(position.setup_type));
  const decision = largestPaperGroup(open, (position) => labelText(position.final_decision));
  const accountPct = accountValue !== null && accountValue > 0 ? (totalNotional / accountValue) * 100 : null;
  return [
    {
      detail: accountPct === null ? "Account value is unavailable, so deployment concentration is limited." : `${accountPct.toFixed(1)}% of the paper account is deployed across open positions.`,
      label: "Open deployment",
      symbols: open.map((position) => position.symbol).slice(0, 6),
      tone: accountPct === null ? "slate" : accountPct >= 65 ? "rose" : accountPct >= 35 ? "amber" : "emerald",
      value: accountPct === null ? "Limited" : `${accountPct.toFixed(1)}%`,
    },
    {
      detail: "Stored stop levels define the maximum planned risk for open paper positions.",
      label: "Stop-risk concentration",
      symbols: open.filter((position) => riskDollars(position) !== null).map((position) => position.symbol).slice(0, 6),
      tone: totalRisk > 0 ? "amber" : "slate",
      value: money(totalRisk),
    },
    {
      detail: setup === null ? "Open positions do not yet share a dominant setup label." : `${setup.label} is the largest open setup cluster.`,
      label: "Setup cluster",
      symbols: setup?.symbols ?? [],
      tone: setup === null ? "slate" : setup.count >= 3 ? "amber" : "cyan",
      value: setup === null ? "Limited" : `${setup.count}`,
    },
    {
      detail: decision === null ? "No dominant decision label is visible in open paper positions." : `${decision.label} is the most common open decision label.`,
      label: "Decision cluster",
      symbols: decision?.symbols ?? [],
      tone: decision === null ? "slate" : decision.label.toUpperCase().includes("AVOID") || decision.label.toUpperCase().includes("EXIT") ? "rose" : "cyan",
      value: decision === null ? "Limited" : `${decision.count}`,
    },
  ];
}

function largestPaperGroup(
  positions: PaperPositionRow[],
  labelFor: (position: PaperPositionRow) => string,
): { count: number; label: string; symbols: string[] } | null {
  const groups = new Map<string, { count: number; symbols: Set<string> }>();
  for (const position of positions) {
    const label = labelFor(position);
    if (!label || label === "Unknown") continue;
    const existing = groups.get(label) ?? { count: 0, symbols: new Set<string>() };
    existing.count += 1;
    existing.symbols.add(position.symbol);
    groups.set(label, existing);
  }
  return Array.from(groups.entries())
    .map(([label, value]) => ({ count: value.count, label, symbols: Array.from(value.symbols).slice(0, 6) }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))[0] ?? null;
}

function SimulatedEvidencePortfolioBridge({ sampleCount, system }: { sampleCount: number; system: SimulatedAiPortfolioSystem | null }) {
  if (!system || sampleCount <= 0) {
    return (
      <SectionShell eyebrow="Completed Evidence" title="Validated Simulation Evidence">
        <EmptyState message="Completed forward-return evidence is not available yet. Paper account results remain separated from system simulations." />
      </SectionShell>
    );
  }

  const result = system.modes.balanced;
  const equityValues = result.equityCurve.map((point) => point.value);
  const latestEquity = equityValues.at(-1) ?? system.startingCapital;
  const closed = result.closedTrades.slice(0, 6);

  return (
    <section className="poster-panel poster-panel-lab rounded-3xl border border-violet-300/20 p-5 shadow-2xl shadow-black/25 ring-1 ring-white/5">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-200">Completed Evidence Portfolio</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Practice portfolio from validated forward returns</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            This is a research simulation built from completed TradeVeto observations. It is not your paper account and does not represent live execution.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:w-[560px]">
          <MiniMetric label="Completed Samples" value={sampleCount.toLocaleString()} />
          <MiniMetric label="Closed Trades" value={result.stats.closedTradeCount.toLocaleString()} />
          <MiniMetric label="Win Rate" value={result.stats.winRatePct === null ? "Limited" : `${result.stats.winRatePct.toFixed(1)}%`} />
          <MiniMetric label="Return" tone={result.stats.simulatedReturnPct === null ? null : result.stats.simulatedReturnPct / 100} value={result.stats.simulatedReturnPct === null ? "Limited" : `${result.stats.simulatedReturnPct >= 0 ? "+" : ""}${result.stats.simulatedReturnPct.toFixed(1)}%`} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Balanced evidence sleeve</div>
              <div className="mt-1 font-mono text-2xl font-black text-slate-50">{money(latestEquity)}</div>
            </div>
            <div className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              {system.primaryHorizon} horizon
            </div>
          </div>
          <SimulatedEvidenceCurve points={result.equityCurve} startingCapital={system.startingCapital} />
        </div>

        <div className="grid gap-3">
          <SimulatedEvidenceRiskSummary result={result} />
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Recent evidence trades</div>
            <div className="mt-3 space-y-2">
              {closed.length ? closed.map((trade) => (
                <Link
                  className="block rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/35 hover:bg-cyan-400/[0.06]"
                  href={`/symbol/${encodeURIComponent(trade.symbol)}`}
                  key={trade.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-sm font-black text-slate-50">{trade.symbol}</div>
                    <div className={`font-mono text-xs font-bold ${pnlTone(trade.realizedPnl)}`}>{money(trade.realizedPnl)}</div>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{trade.learning.lesson}</div>
                </Link>
              )) : <EmptyState message="The completed-evidence simulator needs more qualifying observations for this mode." />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SimulatedEvidenceRiskSummary({ result }: { result: SimulatedPortfolioModeResult }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Simulation risk memory</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniMetric label="Max Drawdown" tone={result.stats.maxDrawdownPct === null ? null : -Math.abs(result.stats.maxDrawdownPct) / 100} value={result.stats.maxDrawdownPct === null ? "Limited" : `${result.stats.maxDrawdownPct.toFixed(1)}%`} />
        <MiniMetric label="Volatility" value={result.stats.volatilityPct === null ? "Limited" : `${result.stats.volatilityPct.toFixed(1)}%`} />
        <MiniMetric label="Cash" value={`${result.stats.cashPct.toFixed(1)}%`} />
        <MiniMetric label="Quality" value={`${result.stats.strategyQualityScore}/100`} />
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{result.learning.portfolioStories[0] ?? result.summary}</p>
    </div>
  );
}

function SimulatedEvidenceCurve({ points, startingCapital }: { points: { label: string; value: number }[]; startingCapital: number }) {
  const width = 720;
  const height = 220;
  const values = points.length ? points.map((point) => point.value) : [startingCapital];
  const minValue = Math.min(...values, startingCapital);
  const maxValue = Math.max(...values, startingCapital);
  const range = Math.max(1, maxValue - minValue);
  const coordinates = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - minValue) / range) * (height - 24) - 12;
    return { x, y };
  });
  const path = coordinates.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");

  return (
    <svg aria-label="Completed evidence simulated portfolio equity curve" className="mt-4 h-56 w-full overflow-visible" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="paper-evidence-equity-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(168,85,247,0.2)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0)" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="url(#paper-evidence-equity-fill)" />
      <path d={path} fill="none" stroke="rgb(34,211,238)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" vectorEffect="non-scaling-stroke" />
      {coordinates.slice(-8).map((point, index) => (
        <circle cx={point.x} cy={point.y} fill="rgb(196,181,253)" key={`${point.x}:${point.y}:${index}`} r="3" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
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
  const adapter = new ScannerDataAdapter();
  const [data, analytics, scannerRows, performance] = await Promise.all([
    getPaperData(paperScope),
    premiumAccess ? getPaperAnalytics(paperScope) : Promise.resolve(null),
    premiumAccess ? adapter.getOverviewSignals().catch(() => []) : Promise.resolve([]),
    premiumAccess ? getPerformanceData({ forwardTailRows: 5000 }).catch(() => null) : Promise.resolve(null),
  ]);
  const scannerSymbols = scannerRows.map((row) => row.symbol);
  const [shockPatterns, narratives] = premiumAccess && scannerSymbols.length
    ? await Promise.all([
        getShockMovePatternMap(scannerSymbols).catch(() => new Map()),
        getNarrativeMap(scannerSymbols).catch(() => new Map()),
      ])
    : [new Map(), new Map()];
  const opportunitiesModel = buildOpportunitiesPageModel(scannerRows, performance, shockPatterns, narratives);
  const scenarioIntelligence = buildScenarioIntelligenceSystem({ rows: opportunitiesModel.rows });
  const strategySystem = premiumAccess ? buildStrategyIntelligenceSystem({
    forwardRows: performance?.forwardReturns.rows ?? [],
    opportunities: opportunitiesModel.rows,
  }) : null;
  const simulatedEvidencePortfolio = premiumAccess ? buildSimulatedAiPortfolioSystem({
    forwardRows: performance?.forwardReturns.rows ?? [],
    opportunities: opportunitiesModel.rows,
    startingCapital: data.account?.total_account_value ?? 100000,
    strategySystem,
  }) : null;
  const portfolioIntelligence = buildPortfolioIntelligenceSystem({
    accountValue: data.account?.total_account_value ?? null,
    opportunities: opportunitiesModel.rows,
    positions: data.positions,
    scenarioSystem: scenarioIntelligence,
  });
  const account = data.account;
  const closedPositions = closedPaperPositions(data.positions);
  const equityPoints = buildEquityPoints(closedPositions);
  const expectancy = buildExpectancy(closedPositions);
  const trustMetrics = analytics ? buildTrustMetrics(analytics.summary, data.positions, analytics.groups, account?.total_account_value ?? null, expectancy) : null;
  const confidenceStatus = systemConfidenceStatus(closedPositions.length);
  const completedEvidenceSamples = Math.max(0, (performance?.forwardReturns.lineCount ?? 0) - 1);

  return (
    <TerminalShell>
      <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl" id="guide">
          <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Paper Trust Layer</div>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-50">System confidence from paper evidence</h1>
              <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-400">
                Paper PnL, open risk, and setup behavior are summarized first. Deeper proof stays available on demand.
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

        <PaperHowToUse />

        <PaperCinematicSimulationSystem
          accountValue={account?.total_account_value ?? null}
          closedPositions={closedPositions}
          equityPoints={equityPoints}
          events={data.events}
          positions={data.positions}
          trustMetrics={trustMetrics}
        />

        <PaperPortfolioRealismPanel accountValue={account?.total_account_value ?? null} positions={data.positions} />

        {premiumAccess ? <SimulatedEvidencePortfolioBridge sampleCount={completedEvidenceSamples} system={simulatedEvidencePortfolio} /> : null}

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

                  <div id="simulator">
                  <ResponsiveAdvancedDetails
                    deferMount
                    eyebrow="Paper detail"
                    summary="Open for portfolio concentration, scenarios, setup evidence, trade autopsy, and ghost portfolio review."
                    title="Portfolio proof and trade review"
                  >
                    <PortfolioIntelligencePanel system={portfolioIntelligence} />
                    <ManualPortfolioScenarioLab accountValue={account?.total_account_value ?? null} opportunities={opportunitiesModel.rows} scenarioSystem={scenarioIntelligence} />

                    <SectionShell eyebrow="Setup Evidence" title="Setup Performance">
                      <SetupPerformance groups={analytics.groups} />
                    </SectionShell>

                    <SectionShell eyebrow="Trade Autopsy" title="Last 10 Closed Trades">
                      <TradeAutopsy positions={data.positions} />
                    </SectionShell>

                    <GhostPortfolioCard positions={data.positions} />
                  </ResponsiveAdvancedDetails>
                  </div>
                </>
              ) : (
                <PremiumLockedState
                  authenticated={entitlement.authenticated}
                  compact
                  description="Paper analytics, trade autopsy, setup evidence, equity curve, and ghost portfolio are premium retention tools. Basic paper practice remains available."
                  previewItems={["Trust metrics and expected-return context", "Trade autopsy and setup breakdowns", "Ghost portfolio discipline review"]}
                  title={entitlement.authenticated ? "Paper analytics are available on Premium" : "Sign in to preview paper analytics"}
                />
              )}

              <div id="positions">
              <SectionShell eyebrow="Open Risk" title="Active Paper Risk">
                <OpenRiskSection positions={data.positions} />
              </SectionShell>
              </div>

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
