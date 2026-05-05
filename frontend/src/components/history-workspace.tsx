"use client";

import { useEffect, useMemo, useState } from "react";
import { SimpleAdvancedTabs } from "@/components/ui/SimpleAdvancedTabs";
import { actionFor, formatNumber } from "@/lib/format";
import { nextSortDirection, stableSortRows, type SortConfig, type SortDirection } from "@/lib/table-sort";
import type { HistorySummary, SymbolHistoryRow } from "@/lib/types";

type Props = {
  defaultSymbol?: string;
  history: HistorySummary;
  symbols: string[];
};

type HistorySortKey = "timestamp_utc" | "price" | "final_score" | "final_score_adjusted" | "rating" | "action" | "recommendation_quality" | "entry_status" | "setup_type";
type HistoryInsightTab = "performance" | "signals" | "news" | "financials" | "events";
type QuickRange = "all" | "1d" | "3d" | "7d" | "14d";

const RATING_PRIORITY: Record<string, number> = {
  TOP: 0,
  ACTIONABLE: 1,
  WATCH: 2,
  PASS: 3,
};
const ACTION_PRIORITY: Record<string, number> = {
  "STRONG BUY": 0,
  BUY: 1,
  "WAIT / HOLD": 2,
  "WAIT/HOLD": 2,
  WAIT: 2,
  HOLD: 3,
  SELL: 4,
  "STRONG SELL": 5,
};
const QUALITY_PRIORITY: Record<string, number> = {
  TRADE_READY: 0,
  WAIT_PULLBACK: 1,
  LOW_EDGE: 2,
  AVOID: 3,
};
const ENTRY_PRIORITY: Record<string, number> = {
  "GOOD ENTRY": 0,
  "NEAR ENTRY": 1,
  "BUY ZONE": 2,
  REVIEW: 3,
  OVEREXTENDED: 4,
  "STOP RISK": 5,
  "STOP HIT": 6,
};

const HISTORY_COLUMNS: { align?: "left" | "right"; key: HistorySortKey; label: string }[] = [
  { key: "timestamp_utc", label: "Timestamp" },
  { align: "right", key: "price", label: "Price" },
  { align: "right", key: "final_score", label: "Score" },
  { align: "right", key: "final_score_adjusted", label: "Adjusted" },
  { key: "rating", label: "Rating" },
  { key: "action", label: "Action" },
  { key: "recommendation_quality", label: "Quality" },
  { key: "entry_status", label: "Entry" },
  { key: "setup_type", label: "Setup" },
];
const QUICK_RANGES: { label: string; value: QuickRange; days?: number }[] = [
  { label: "All time", value: "all" },
  { days: 1, label: "Last 1 day", value: "1d" },
  { days: 3, label: "Last 3 days", value: "3d" },
  { days: 7, label: "Last 7 days", value: "7d" },
  { days: 14, label: "Last 14 days", value: "14d" },
];
const INSIGHT_TABS: { label: string; value: HistoryInsightTab }[] = [
  { label: "Performance", value: "performance" },
  { label: "Signals", value: "signals" },
  { label: "News", value: "news" },
  { label: "Financials", value: "financials" },
  { label: "Events", value: "events" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";
  return String(value).replace("T", " ").replace("Z", " UTC");
}

function timestampMs(row: { timestamp_utc: string }) {
  const ms = Date.parse(row.timestamp_utc);
  return Number.isFinite(ms) ? ms : null;
}

function datetimeLocalMs(value: string) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function normalizeSymbol(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeSortText(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function formatDelta(value: number | null, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}${suffix}`;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[%,$]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercentValue(value: number | null) {
  if (value === null) return "N/A";
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  return `${percent.toFixed(1)}%`;
}

function cleanInsight(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text && !["nan", "none", "null", "n/a", "-"].includes(text.toLowerCase()) ? text : fallback;
}

function financialInterpretation(label: string, value: number | null) {
  if (value === null) return `${label}: not available for this symbol in scanner context.`;
  if (value > 0.08) return `${label}: growth input is constructive.`;
  if (value < -0.02) return `${label}: growth input is a risk factor.`;
  return `${label}: growth input is mixed or flat.`;
}

function valueFrom(row: SymbolHistoryRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function parseTradeLevel(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return { low: value, high: value };
  const text = String(value ?? "").trim();
  if (!text || ["N/A", "-", "nan", "none", "null"].includes(text.toLowerCase())) return null;
  const matches = text.match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return null;
  const numbers = matches.map(Number).filter((item) => Number.isFinite(item));
  if (!numbers.length) return null;
  return { low: Math.min(...numbers), high: Math.max(...numbers) };
}

function takeProfitDisplay(row: SymbolHistoryRow) {
  const value = valueFrom(row, ["take_profit_zone", "take_profit", "upside_target", "target_price", "target"]);
  const zone = parseTradeLevel(value);
  const currentPrice = typeof row.price === "number" ? row.price : null;
  if (currentPrice !== null && zone && zone.low > currentPrice && zone.high > currentPrice) return String(value ?? "N/A");

  const stopZone = parseTradeLevel(valueFrom(row, ["stop_loss", "invalidation_level"]));
  if (currentPrice === null || !stopZone || stopZone.low >= currentPrice) return "N/A";

  const risk = currentPrice - stopZone.low;
  return `${formatNumber(currentPrice + 2 * risk)}-${formatNumber(currentPrice + 3 * risk)}`;
}

function averageInterval(rows: SymbolHistoryRow[]) {
  const ordered = rows
    .map(timestampMs)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (ordered.length < 2) return null;
  const intervals = ordered.slice(1).map((value, index) => value - ordered[index]);
  return intervals.reduce((total, value) => total + value, 0) / intervals.length;
}

function formatDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms)) return "N/A";
  const minutes = Math.abs(ms) / 60_000;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function sortValue(row: SymbolHistoryRow, key: HistorySortKey) {
  if (key === "action") return actionFor(row);
  if (key === "recommendation_quality") return normalizeSymbol(row.recommendation_quality);
  if (key === "entry_status") return normalizeSortText(row.entry_status);
  return row[key];
}

function sortConfig(key: HistorySortKey): SortConfig {
  if (key === "timestamp_utc") return { type: "date" };
  if (key === "price" || key === "final_score" || key === "final_score_adjusted") return { type: "number" };
  if (key === "rating") return { priority: RATING_PRIORITY };
  if (key === "action") return { priority: ACTION_PRIORITY };
  if (key === "recommendation_quality") return { priority: QUALITY_PRIORITY };
  if (key === "entry_status") return { priority: ENTRY_PRIORITY };
  return { type: "string" };
}

function qualityBadgeClass(value: unknown) {
  const quality = normalizeSymbol(value);
  if (quality === "TRADE_READY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (quality === "WAIT_PULLBACK") return "border-amber-400/35 bg-amber-400/10 text-amber-200";
  if (quality === "AVOID") return "border-rose-400/35 bg-rose-400/10 text-rose-200";
  return "border-slate-500/30 bg-slate-500/12 text-slate-200";
}

function SortHeader({ align, label, onSort, sortDirection, sortKey, thisKey }: { align?: "left" | "right"; label: string; onSort: (key: HistorySortKey) => void; sortDirection: SortDirection; sortKey: HistorySortKey; thisKey: HistorySortKey }) {
  const active = sortKey === thisKey;
  return (
    <th className={`whitespace-nowrap px-2 py-1.5 ${align === "right" ? "text-right" : "text-left"}`}>
      <button className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap hover:text-sky-200 ${align === "right" ? "justify-end" : "justify-start"}`} onClick={() => onSort(thisKey)} type="button">
        <span>{label}</span>
        {active ? <span className="text-sky-300">{sortDirection === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

function CompanyIntelligenceTabs({
  activeTab,
  latest,
  onChange,
  priceChange,
  rows,
  scoreChange,
}: {
  activeTab: HistoryInsightTab;
  latest: SymbolHistoryRow | undefined;
  onChange: (tab: HistoryInsightTab) => void;
  priceChange: number | null;
  rows: SymbolHistoryRow[];
  scoreChange: number | null;
}) {
  return (
    <section className="terminal-panel rounded-2xl p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        {INSIGHT_TABS.map((tab) => (
          <button
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${activeTab === tab.value ? "border-sky-300/50 bg-sky-400/10 text-sky-100" : "border-slate-700/70 bg-slate-950/50 text-slate-400 hover:border-sky-300/35 hover:text-sky-100"}`}
            key={tab.value}
            onClick={() => onChange(tab.value)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "performance" ? <PerformanceInsight latest={latest} priceChange={priceChange} rows={rows} scoreChange={scoreChange} /> : null}
      {activeTab === "signals" ? <SignalsInsight latest={latest} rows={rows} /> : null}
      {activeTab === "news" ? <NewsInsight latest={latest} /> : null}
      {activeTab === "financials" ? <FinancialsInsight latest={latest} /> : null}
      {activeTab === "events" ? <EventsInsight latest={latest} /> : null}
    </section>
  );
}

function PerformanceInsight({ latest, priceChange, rows, scoreChange }: { latest: SymbolHistoryRow | undefined; priceChange: number | null; rows: SymbolHistoryRow[]; scoreChange: number | null }) {
  const interpretation = scoreChange !== null && scoreChange > 5
    ? "Score improved over the selected window, which means scanner inputs became more constructive."
    : scoreChange !== null && scoreChange < -5
      ? "Score weakened over the selected window, so the scanner is reducing conviction."
      : "Score is mostly stable over the selected window.";
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <InsightMetric label="Score change" value={formatDelta(scoreChange)} />
      <InsightMetric label="Price change" value={formatDelta(priceChange)} />
      <InsightMetric label="Latest decision" value={latest?.final_decision ?? latest?.rating ?? "N/A"} />
      <InterpretedPanel className="md:col-span-3" title="Performance interpretation" items={[interpretation, `Observed ${rows.length.toLocaleString()} signal snapshots in this range.`, "Use this as historical research context, not a prediction."]} />
    </div>
  );
}

function SignalsInsight({ latest, rows }: { latest: SymbolHistoryRow | undefined; rows: SymbolHistoryRow[] }) {
  const decisions = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.final_decision ?? row.rating ?? "UNKNOWN").toUpperCase();
    decisions.set(key, (decisions.get(key) ?? 0) + 1);
  }
  const items = Array.from(decisions.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([decision, count]) => `${decision}: ${count} observations`);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <InterpretedPanel title="Decision mix" items={items.length ? items : ["No signal mix available yet."]} />
      <InterpretedPanel title="Current reasoning" items={[cleanInsight(latest?.decision_reason ?? latest?.quality_reason, "Latest decision reasoning is not available."), cleanInsight(latest?.entry_status, "Entry state is not available."), cleanInsight(latest?.setup_type, "Setup type is not available.")]} />
    </div>
  );
}

function NewsInsight({ latest }: { latest: SymbolHistoryRow | undefined }) {
  const newsScore = numberOrNull(latest?.news_score);
  const sentiment = newsScore === null ? "Neutral / unavailable" : newsScore >= 56 ? "Supportive" : newsScore <= 44 ? "Cautious" : "Neutral";
  const impact = newsScore === null ? "No clear headline impact" : Math.abs(newsScore - 50) >= 12 ? "High impact" : Math.abs(newsScore - 50) >= 6 ? "Moderate impact" : "Low impact";
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <InterpretedPanel title="Headline context" items={[cleanInsight(latest?.headline_bias, "No recent headline signal."), cleanInsight(latest?.upside_driver, "No major event driver detected.")]} />
      <div className="grid gap-2">
        <InsightMetric label="Sentiment tag" value={sentiment} />
        <InsightMetric label="Impact tag" value={impact} />
        <InsightMetric label="Timestamp" value={formatDate(latest?.timestamp_utc)} />
      </div>
    </div>
  );
}

function FinancialsInsight({ latest }: { latest: SymbolHistoryRow | undefined }) {
  const revenueGrowth = numberOrNull(latest?.revenue_growth);
  const earningsGrowth = numberOrNull(latest?.earnings_growth);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <InsightMetric label="Revenue growth" value={formatPercentValue(revenueGrowth)} />
        <InsightMetric label="EPS / earnings growth" value={formatPercentValue(earningsGrowth)} />
        <InsightMetric label="Margins" value={formatPercentValue(numberOrNull(latest?.profit_margins ?? latest?.gross_margins))} />
        <InsightMetric label="Fundamental score" value={formatNumber(latest?.fundamental_score)} />
      </div>
      <InterpretedPanel title="Financial interpretation" items={[financialInterpretation("Revenue", revenueGrowth), financialInterpretation("Earnings", earningsGrowth), "Financial inputs are one part of the decision model and can be unavailable for ETFs, crypto proxies, or sparse data."]} />
    </div>
  );
}

function EventsInsight({ latest }: { latest: SymbolHistoryRow | undefined }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <InterpretedPanel title="Scheduled / corporate events" items={[
        latest?.earnings_date ? `Earnings: ${String(latest.earnings_date)}` : "Earnings: no near-term date in scanner context.",
        latest?.dividend_yield ? `Dividend yield: ${formatPercentValue(numberOrNull(latest.dividend_yield))}` : "Dividend: no yield signal in scanner context.",
        latest?.split_factor ? `Split factor: ${String(latest.split_factor)}` : "Splits: no split signal in scanner context.",
      ]} />
      <InterpretedPanel title="Decision connection" items={[cleanInsight(latest?.key_risk, "No event-specific key risk detected."), cleanInsight(latest?.upside_driver, "No event-specific upside driver detected."), "Corporate events can change risk quickly, so the scanner treats them as context rather than instructions."]} />
    </div>
  );
}

function InterpretedPanel({ className = "", items, title }: { className?: string; items: string[]; title: string }) {
  return (
    <div className={`rounded-xl border border-slate-700/70 bg-slate-950/45 p-3 ${className}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-300">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function TrendChart({ rows, field, label }: { rows: SymbolHistoryRow[]; field: "final_score" | "price"; label: string }) {
  const points = rows
    .map((row) => ({ time: timestampMs(row), value: typeof row[field] === "number" ? row[field] : null }))
    .filter((point): point is { time: number; value: number } => point.time !== null && point.value !== null);

  if (!points.length) {
    return <div className="rounded border border-dashed border-slate-700/70 px-3 py-8 text-center text-xs text-slate-500">{label} data not available.</div>;
  }

  const width = 520;
  const height = 150;
  const padding = 22;
  const minTime = Math.min(...points.map((point) => point.time));
  const maxTime = Math.max(...points.map((point) => point.time));
  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const timeSpan = Math.max(1, maxTime - minTime);
  const valueSpan = Math.max(1, maxValue - minValue);
  const plotted = points.map((point, index) => {
    const x = padding + ((point.time - minTime) / timeSpan) * (width - padding * 2);
    const y = height - padding - ((point.value - minValue) / valueSpan) * (height - padding * 2);
    if (points.length === 1) return { x: width / 2, y: height / 2, index };
    return { x, y, index };
  });
  const path = plotted.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");

  return (
    <div className="terminal-panel overflow-x-auto rounded-md p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="font-semibold uppercase tracking-[0.14em] text-sky-300">{label}</div>
        <div className="font-mono text-slate-400">
          {formatNumber(points[0].value)} → {formatNumber(points[points.length - 1].value)}
        </div>
      </div>
      <svg className="min-w-[520px]" height={height} role="img" viewBox={`0 0 ${width} ${height}`} width="100%">
        <title>{label} over time</title>
        <line stroke="rgba(148,163,184,0.22)" x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        <line stroke="rgba(148,163,184,0.22)" x1={padding} x2={padding} y1={padding} y2={height - padding} />
        <path d={path} fill="none" stroke={field === "price" ? "rgb(52,211,153)" : "rgb(125,211,252)"} strokeWidth="2" />
        {plotted.map((point) => (
          <circle cx={point.x} cy={point.y} fill="rgb(226,232,240)" key={point.index} r="2.8" />
        ))}
      </svg>
    </div>
  );
}

export function HistoryWorkspace({ defaultSymbol = "", history, symbols }: Props) {
  const [symbolQuery, setSymbolQuery] = useState(() => normalizeSymbol(defaultSymbol));
  const [symbolRows, setSymbolRows] = useState<SymbolHistoryRow[]>([]);
  const [loadingSymbol, setLoadingSymbol] = useState(false);
  const [symbolError, setSymbolError] = useState("");
  const [sortKey, setSortKey] = useState<HistorySortKey>("timestamp_utc");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [quickRange, setQuickRange] = useState<QuickRange>("all");
  const [activeInsightTab, setActiveInsightTab] = useState<HistoryInsightTab>("performance");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const selectedSymbol = normalizeSymbol(symbolQuery);

  useEffect(() => {
    let active = true;
    async function loadSymbolHistory() {
      if (!selectedSymbol) {
        setSymbolRows([]);
        setSymbolError("");
        return;
      }
      setLoadingSymbol(true);
      setSymbolError("");
      try {
        const response = await fetch(`/api/history/symbol/${encodeURIComponent(selectedSymbol)}`, { cache: "no-store" });
        const payload = (await response.json()) as { rows?: SymbolHistoryRow[]; error?: string };
        if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
        if (active) {
          setSymbolRows((payload.rows ?? []).sort((a, b) => String(a.timestamp_utc).localeCompare(String(b.timestamp_utc))));
        }
      } catch (error) {
        if (active) setSymbolError(error instanceof Error ? error.message : "Failed to load symbol history.");
      } finally {
        if (active) setLoadingSymbol(false);
      }
    }
    loadSymbolHistory();
    return () => {
      active = false;
    };
  }, [selectedSymbol]);

  const filteredByTime = useMemo(() => {
    const fromMs = datetimeLocalMs(customFrom);
    const toMs = datetimeLocalMs(customTo);
    const hasCustomRange = Boolean(customFrom || customTo);
    const selectedRange = QUICK_RANGES.find((option) => option.value === quickRange);
    const quickCutoff = !hasCustomRange && selectedRange?.days ? Date.now() - selectedRange.days * 24 * 60 * 60 * 1000 : null;

    return symbolRows.filter((row) => {
      const rowMs = timestampMs(row);
      if (rowMs === null) return false;
      if (hasCustomRange) {
        if (fromMs !== null && rowMs < fromMs) return false;
        if (toMs !== null && rowMs > toMs) return false;
        return true;
      }
      if (quickCutoff !== null && rowMs < quickCutoff) return false;
      return true;
    });
  }, [customFrom, customTo, quickRange, symbolRows]);
  const first = filteredByTime[0];
  const latest = filteredByTime[filteredByTime.length - 1];
  const scoreChange = first && latest && typeof first.final_score === "number" && typeof latest.final_score === "number" ? latest.final_score - first.final_score : null;
  const priceChange = first && latest && typeof first.price === "number" && typeof latest.price === "number" ? latest.price - first.price : null;
  const sortedRows = useMemo(() => stableSortRows(filteredByTime, sortKey, sortDirection, sortValue, sortConfig), [filteredByTime, sortDirection, sortKey]);
  const visibleRows = useMemo(() => sortedRows.slice(0, 200), [sortedRows]);
  const avgInterval = averageInterval(filteredByTime);
  const matchingSymbols = symbolQuery
    ? symbols.filter((symbol) => symbol.includes(selectedSymbol)).slice(0, 8)
    : symbols.slice(0, 8);

  function handleQuickRangeChange(value: QuickRange) {
    setQuickRange(value);
    setCustomFrom("");
    setCustomTo("");
  }

  function handleCustomFromChange(value: string) {
    setCustomFrom(value);
    setQuickRange("all");
  }

  function handleCustomToChange(value: string) {
    setCustomTo(value);
    setQuickRange("all");
  }

  function handleSort(key: HistorySortKey) {
    const direction = nextSortDirection(sortKey, key, sortDirection, sortConfig(key));
    setSortKey(key);
    setSortDirection(direction);
  }

  return (
    <div className="space-y-3">
      <section className="terminal-panel rounded-md p-4">
        <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Symbol
            <input
              className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
              list="history-symbols"
              onChange={(event) => setSymbolQuery(normalizeSymbol(event.target.value))}
              onInput={(event) => setSymbolQuery(normalizeSymbol(event.currentTarget.value))}
              placeholder="Type symbol, e.g. AVGO"
              value={symbolQuery}
            />
            <datalist id="history-symbols">
              {symbols.map((symbol) => (
                <option key={symbol} value={symbol} />
              ))}
            </datalist>
          </label>
          <div className="text-xs text-slate-500">
            {selectedSymbol ? (
              <>
                {loadingSymbol ? "Loading" : "Showing"} {symbolRows.length.toLocaleString()} observations for <span className="font-mono text-slate-200">{selectedSymbol}</span>.
              </>
            ) : (
              <>Type or select a symbol. Try one of: {matchingSymbols.join(", ") || "no symbols available"}.</>
            )}
          </div>
        </div>
      </section>

      {symbolError ? (
        <div className="terminal-panel rounded-md border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {symbolError}
        </div>
      ) : null}

      {loadingSymbol ? <div className="terminal-panel rounded-md border-dashed border-slate-700/70 px-3 py-8 text-center text-xs text-slate-500">Loading symbol history...</div> : null}

      {!loadingSymbol && selectedSymbol && !symbolRows.length ? (
        <div className="terminal-panel rounded-md border-dashed border-slate-700/70 px-3 py-8 text-center text-sm text-slate-400">No signal memory found for <span className="font-mono text-slate-100">{selectedSymbol}</span>.</div>
      ) : null}

      {symbolRows.length ? (
        <>
          <section className="terminal-panel rounded-md p-3">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Range
                <select className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => handleQuickRangeChange(event.target.value as QuickRange)} value={quickRange}>
                  {QUICK_RANGES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                From
                <input className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => handleCustomFromChange(event.target.value)} type="datetime-local" value={customFrom} />
              </label>
              <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                To
                <input className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => handleCustomToChange(event.target.value)} type="datetime-local" value={customTo} />
              </label>
              <div className="self-end text-xs text-slate-500">
                Showing {filteredByTime.length.toLocaleString()} of {symbolRows.length.toLocaleString()} observations
              </div>
            </div>
          </section>

          {filteredByTime.length ? (
            <>
              <section className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                {[
                  { label: "First Score", value: formatNumber(first?.final_score), meta: formatDate(first?.timestamp_utc) },
                  { label: "Latest Score", value: formatNumber(latest?.final_score), meta: formatDate(latest?.timestamp_utc) },
                  { label: "Score Change", value: formatDelta(scoreChange), meta: "latest - first" },
                  { label: "Rating", value: latest?.rating ?? "N/A", meta: "latest" },
                  { label: "Action", value: latest ? actionFor(latest) : "N/A", meta: "latest" },
                  { label: "Price", value: formatNumber(latest?.price), meta: "latest" },
                  { label: "Price Change", value: formatDelta(priceChange), meta: "latest - first" },
                  { label: "Observations", value: filteredByTime.length.toLocaleString(), meta: `avg ${formatDuration(avgInterval)}` },
                ].map((metric) => (
                  <div className="terminal-panel min-w-0 rounded-md px-3 py-2" key={metric.label}>
                    <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</div>
                    <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{metric.value}</div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-500">{metric.meta}</div>
                  </div>
                ))}
              </section>

              <div className="grid gap-3 xl:grid-cols-2">
                <TrendChart field="final_score" label="Final Score" rows={filteredByTime} />
                <TrendChart field="price" label="Price" rows={filteredByTime} />
              </div>

              <CompanyIntelligenceTabs
                activeTab={activeInsightTab}
                latest={latest}
                onChange={setActiveInsightTab}
                priceChange={priceChange}
                rows={filteredByTime}
                scoreChange={scoreChange}
              />

              <SimpleAdvancedTabs
                simple={(
                  <section className="terminal-panel rounded-md p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Summary View</div>
                    <p className="mt-1 text-sm leading-6 text-slate-400">Score, price, and latest signal cards are shown by default. Open Advanced for the sortable symbol timeline.</p>
                  </section>
                )}
                advanced={(
              <section>
                <div className="mb-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Symbol Timeline</div>
                  <h2 className="text-lg font-semibold text-slate-50">{selectedSymbol} Signal Memory</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Showing {visibleRows.length.toLocaleString()} of {sortedRows.length.toLocaleString()} observations
                  </p>
                </div>
                <div className="terminal-panel overflow-x-auto rounded-2xl">
                  <table className="w-full min-w-[1160px] table-fixed border-collapse text-xs">
                    <colgroup>
                      <col style={{ width: 220 }} />
                      <col style={{ width: 95 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 140 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 170 }} />
                    </colgroup>
                    <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        {HISTORY_COLUMNS.map((column) => (
                          <SortHeader align={column.align} key={column.key} label={column.label} onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} thisKey={column.key} />
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/90">
                      {visibleRows.map((row) => (
                        <tr className="hover:bg-sky-400/5" key={`${row.source_file}-${row.symbol}-${row.timestamp_utc}`}>
                          <td className="truncate px-2 py-1.5 text-slate-300">{formatDate(row.timestamp_utc)}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-slate-200">{formatNumber(row.price)}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-emerald-200">{formatNumber(row.final_score)}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-slate-300">{formatNumber(row.final_score_adjusted)}</td>
                          <td className="truncate px-2 py-1.5 text-slate-300">{row.rating ?? "N/A"}</td>
                          <td className="truncate px-2 py-1.5 text-slate-300">{actionFor(row)}</td>
                          <td className="px-2 py-1.5">
                            {row.recommendation_quality ? (
                              <span className={`inline-flex max-w-[120px] rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${qualityBadgeClass(row.recommendation_quality)}`} title={String(row.quality_reason ?? "")}>
                                <span className="truncate">{String(row.recommendation_quality).replace("_", " ")}</span>
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="truncate px-2 py-1.5 text-slate-400">{row.entry_status ?? "N/A"}</td>
                          <td className="truncate px-2 py-1.5 text-slate-400">{row.setup_type ?? "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
                )}
              />
            </>
          ) : (
            <div className="terminal-panel rounded-md border-dashed border-slate-700/70 px-3 py-8 text-center text-sm text-slate-400">No signal observations in selected time range.</div>
          )}
        </>
      ) : null}

      <details className="terminal-panel rounded-2xl p-4 text-xs text-slate-400">
        <summary className="cursor-pointer font-semibold uppercase tracking-[0.12em] text-slate-500">Advanced diagnostics</summary>
        <div className="mt-2 text-xs text-slate-500">Raw file inventory for technical review only. Showing {Math.min(history.snapshots.length, 200).toLocaleString()} of {history.snapshots.length.toLocaleString()} files.</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-xs">
            <colgroup>
              <col style={{ width: 300 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 220 }} />
            </colgroup>
            <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left">File</th>
                <th className="px-2 py-1.5 text-left">Timestamp</th>
                <th className="px-2 py-1.5 text-left">Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/90">
              {history.snapshots.slice(0, 200).map((snapshot) => (
                <tr key={snapshot.name}>
                  <td className="truncate px-2 py-1.5 font-mono text-slate-300">{snapshot.name}</td>
                  <td className="truncate px-2 py-1.5 text-slate-400">{formatDate(snapshot.timestamp)}</td>
                  <td className="truncate px-2 py-1.5 text-slate-400">{formatDate(snapshot.modifiedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
