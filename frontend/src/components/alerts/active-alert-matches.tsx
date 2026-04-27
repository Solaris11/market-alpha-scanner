"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatNumber } from "@/lib/format";

type ActiveAlertMatch = {
  rule_id: string;
  rule_type: string;
  scope: "global" | "watchlist" | "symbol";
  symbol: string;
  company_name: string;
  price: number | null;
  final_score: number | null;
  rating: string;
  action: string;
  entry_status: string;
  trade_quality: string;
  setup_type: string;
  match_reason: string;
  threshold: number | null;
  buy_zone: string;
  stop_loss: number | null;
  take_profit: string;
  risk_reward: string;
  channels: string[];
  cooldown_minutes: number;
  last_sent: string | null;
  cooldown_active: boolean;
};

type ActiveAlertMatchesResponse = {
  generated_at: string;
  data_status: "fresh" | "stale" | "missing" | "schema_mismatch";
  matches: ActiveAlertMatch[];
};

type SortDirection = "asc" | "desc";
type SortKey =
  | "symbol"
  | "company_name"
  | "rule_type"
  | "match_reason"
  | "scope"
  | "price"
  | "final_score"
  | "rating"
  | "action"
  | "entry_status"
  | "setup_type"
  | "buy_zone"
  | "stop_loss"
  | "take_profit"
  | "risk_reward"
  | "cooldown_active"
  | "last_sent"
  | "channels";

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
  HOLD: 3,
  SELL: 4,
  "STRONG SELL": 5,
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
const NUMERIC_SORT_KEYS = new Set<SortKey>(["price", "final_score", "stop_loss"]);

const COLUMNS: { key: SortKey; label: string; align?: "left" | "right" | "center" }[] = [
  { key: "symbol", label: "Symbol" },
  { key: "company_name", label: "Company" },
  { key: "rule_type", label: "Rule Type" },
  { key: "match_reason", label: "Match Reason" },
  { key: "scope", label: "Scope" },
  { key: "price", label: "Price", align: "right" },
  { key: "final_score", label: "Score", align: "right" },
  { key: "rating", label: "Rating" },
  { key: "action", label: "Action" },
  { key: "entry_status", label: "Entry" },
  { key: "setup_type", label: "Setup" },
  { key: "buy_zone", label: "Buy Zone" },
  { key: "stop_loss", label: "Stop Loss", align: "right" },
  { key: "take_profit", label: "Take Profit" },
  { key: "risk_reward", label: "Risk/Reward" },
  { key: "cooldown_active", label: "Cooldown", align: "center" },
  { key: "last_sent", label: "Last Sent" },
  { key: "channels", label: "Channels" },
];

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return value.replace("T", " ").replace("Z", " UTC");
}

function scopeLabel(value: string) {
  if (value === "global") return "Global";
  if (value === "watchlist") return "Watchlist";
  return "Symbol";
}

function sortPriority(priority: Record<string, number>, left: unknown, right: unknown, direction: SortDirection) {
  const leftRank = priority[normalize(left)];
  const rightRank = priority[normalize(right)];
  if (leftRank === undefined && rightRank === undefined) return 0;
  if (leftRank === undefined) return 1;
  if (rightRank === undefined) return -1;
  return direction === "desc" ? leftRank - rightRank : rightRank - leftRank;
}

function sortValue(row: ActiveAlertMatch, key: SortKey) {
  if (key === "channels") return row.channels.join(", ");
  if (key === "cooldown_active") return row.cooldown_active ? 1 : 0;
  return row[key];
}

function compareRows(left: ActiveAlertMatch, right: ActiveAlertMatch, key: SortKey, direction: SortDirection) {
  if (key === "rating") return sortPriority(RATING_PRIORITY, left.rating, right.rating, direction);
  if (key === "action") return sortPriority(ACTION_PRIORITY, left.action, right.action, direction);
  if (key === "entry_status") return sortPriority(ENTRY_PRIORITY, left.entry_status, right.entry_status, direction);

  const leftValue = sortValue(left, key);
  const rightValue = sortValue(right, key);
  const leftMissing = leftValue === null || leftValue === undefined || leftValue === "";
  const rightMissing = rightValue === null || rightValue === undefined || rightValue === "";
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;

  let comparison = 0;
  if (NUMERIC_SORT_KEYS.has(key) || key === "cooldown_active") {
    comparison = Number(leftValue) - Number(rightValue);
  } else if (key === "last_sent") {
    comparison = Date.parse(String(leftValue)) - Date.parse(String(rightValue));
  } else {
    comparison = String(leftValue).toLowerCase().localeCompare(String(rightValue).toLowerCase());
  }
  return direction === "desc" ? -comparison : comparison;
}

function uniqueOptions(matches: ActiveAlertMatch[], key: keyof ActiveAlertMatch) {
  return Array.from(new Set(matches.map((match) => String(match[key] ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function SortHeader({ column, sortDirection, sortKey, onSort }: { column: (typeof COLUMNS)[number]; sortDirection: SortDirection; sortKey: SortKey | null; onSort: (key: SortKey) => void }) {
  const active = sortKey === column.key;
  return (
    <th className={`whitespace-nowrap px-2 py-1.5 ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"}`}>
      <button className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap hover:text-sky-200 ${column.align === "right" ? "justify-end" : column.align === "center" ? "justify-center" : "justify-start"}`} onClick={() => onSort(column.key)} type="button">
        <span>{column.label}</span>
        {active ? <span className="text-sky-300">{sortDirection === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

export function ActiveAlertMatches() {
  const [payload, setPayload] = useState<ActiveAlertMatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [symbolSearch, setSymbolSearch] = useState("");
  const [ruleType, setRuleType] = useState("");
  const [scope, setScope] = useState("");
  const [rating, setRating] = useState("");
  const [action, setAction] = useState("");
  const [entryStatus, setEntryStatus] = useState("");
  const [cooldown, setCooldown] = useState("");
  const [minScore, setMinScore] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>("final_score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadMatches() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/alerts/active-matches");
        const data = (await response.json()) as ActiveAlertMatchesResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
        if (active) setPayload(data);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Failed to load active alert matches.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadMatches();
    return () => {
      active = false;
    };
  }, []);

  const matches = payload?.matches ?? [];
  const ruleTypes = useMemo(() => uniqueOptions(matches, "rule_type"), [matches]);
  const scopes = useMemo(() => uniqueOptions(matches, "scope"), [matches]);
  const ratings = useMemo(() => uniqueOptions(matches, "rating"), [matches]);
  const actions = useMemo(() => uniqueOptions(matches, "action"), [matches]);
  const entries = useMemo(() => uniqueOptions(matches, "entry_status"), [matches]);

  const filteredMatches = useMemo(() => {
    const query = symbolSearch.trim().toLowerCase();
    const minimumScore = Number(minScore);
    const hasMinScore = minScore.trim() !== "" && Number.isFinite(minimumScore);
    return matches.filter((match) => {
      if (query && !`${match.symbol} ${match.company_name}`.toLowerCase().includes(query)) return false;
      if (ruleType && match.rule_type !== ruleType) return false;
      if (scope && match.scope !== scope) return false;
      if (rating && match.rating !== rating) return false;
      if (action && match.action !== action) return false;
      if (entryStatus && match.entry_status !== entryStatus) return false;
      if (cooldown === "active" && !match.cooldown_active) return false;
      if (cooldown === "not_active" && match.cooldown_active) return false;
      if (hasMinScore && (typeof match.final_score !== "number" || match.final_score < minimumScore)) return false;
      return true;
    });
  }, [action, cooldown, entryStatus, matches, minScore, rating, ruleType, scope, symbolSearch]);

  const sortedMatches = useMemo(() => {
    if (!sortKey) return filteredMatches;
    return filteredMatches
      .map((match, index) => ({ match, index }))
      .sort((left, right) => compareRows(left.match, right.match, sortKey, sortDirection) || left.index - right.index)
      .map((item) => item.match);
  }, [filteredMatches, sortDirection, sortKey]);

  const visibleMatches = showAll ? sortedMatches : sortedMatches.slice(0, 300);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  }

  function resetFilters() {
    setSymbolSearch("");
    setRuleType("");
    setScope("");
    setRating("");
    setAction("");
    setEntryStatus("");
    setCooldown("");
    setMinScore("");
    setSortKey("final_score");
    setSortDirection("desc");
    setShowAll(false);
  }

  return (
    <section className="terminal-panel rounded-md">
      <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Active Alert Matches</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Current Rule Matches</h2>
            <p className="mt-1 text-xs text-slate-500">Symbols currently matching enabled alert rules. This is read-only and does not send notifications.</p>
          </div>
          <div className="font-mono text-xs text-slate-500">
            {loading ? "Loading..." : `Generated: ${payload?.generated_at ? formatDate(payload.generated_at) : "N/A"}`}
          </div>
        </div>
      </div>

      <div className="border-b border-slate-800 p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.25fr_1fr_0.8fr_0.8fr_0.9fr_0.9fr_0.9fr_0.7fr_auto]">
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Symbol
            <input className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setSymbolSearch(event.target.value)} placeholder="Search symbol/company" value={symbolSearch} />
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Rule Type
            <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setRuleType(event.target.value)} value={ruleType}>
              <option value="">All rule types</option>
              {ruleTypes.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Scope
            <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setScope(event.target.value)} value={scope}>
              <option value="">All scopes</option>
              {scopes.map((item) => <option key={item} value={item}>{scopeLabel(item)}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Rating
            <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setRating(event.target.value)} value={rating}>
              <option value="">All ratings</option>
              {ratings.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Action
            <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setAction(event.target.value)} value={action}>
              <option value="">All actions</option>
              {actions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Entry
            <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setEntryStatus(event.target.value)} value={entryStatus}>
              <option value="">All entries</option>
              {entries.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Cooldown
            <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setCooldown(event.target.value)} value={cooldown}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="not_active">Not Active</option>
            </select>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Min Score
            <input className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" min="0" onChange={(event) => setMinScore(event.target.value)} placeholder="0" type="number" value={minScore} />
          </label>
          <button className="self-end rounded border border-slate-700/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-sky-400/50 hover:text-sky-200" onClick={resetFilters} type="button">
            Reset
          </button>
        </div>
      </div>

      {error ? <div className="border-b border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{error}</div> : null}
      {payload && payload.data_status !== "fresh" ? <div className="border-b border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">Data status: {payload.data_status}</div> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[2220px] table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: 90 }} />
            <col style={{ width: 220 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 260 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 190 }} />
            <col style={{ width: 130 }} />
          </colgroup>
          <thead className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              {COLUMNS.map((column) => <SortHeader column={column} key={column.key} onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} />)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/90">
            {loading ? (
              <tr><td className="px-2 py-8 text-center text-slate-500" colSpan={18}>Loading active alert matches...</td></tr>
            ) : visibleMatches.length ? (
              visibleMatches.map((match) => (
                <tr className="hover:bg-sky-400/5" key={`${match.rule_id}:${match.symbol}`}>
                  <td className="px-2 py-1.5 font-mono font-semibold"><Link className="text-sky-200 hover:text-sky-100" href={`/symbol/${match.symbol}`}>{match.symbol}</Link></td>
                  <td className="truncate px-2 py-1.5 text-slate-400" title={match.company_name}>{match.company_name || "—"}</td>
                  <td className="truncate px-2 py-1.5 text-slate-300" title={match.rule_id}>{labelize(match.rule_type)}</td>
                  <td className="truncate px-2 py-1.5 text-slate-400" title={match.match_reason}>{match.match_reason}</td>
                  <td className="truncate px-2 py-1.5 text-slate-400">{scopeLabel(match.scope)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-200">{formatNumber(match.price)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-emerald-200">{formatNumber(match.final_score)}</td>
                  <td className="truncate px-2 py-1.5 text-slate-300">{match.rating}</td>
                  <td className="truncate px-2 py-1.5 text-slate-300">{match.action}</td>
                  <td className="truncate px-2 py-1.5 text-slate-300">{match.entry_status}</td>
                  <td className="truncate px-2 py-1.5 text-slate-400">{match.setup_type}</td>
                  <td className="truncate px-2 py-1.5 font-mono text-slate-400">{match.buy_zone}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-400">{formatNumber(match.stop_loss)}</td>
                  <td className="truncate px-2 py-1.5 font-mono text-slate-400">{match.take_profit}</td>
                  <td className="truncate px-2 py-1.5 font-mono text-slate-400">{match.risk_reward}</td>
                  <td className={match.cooldown_active ? "px-2 py-1.5 text-center text-amber-300" : "px-2 py-1.5 text-center text-emerald-300"}>{match.cooldown_active ? "Active" : "Open"}</td>
                  <td className="truncate px-2 py-1.5 text-slate-400">{formatDate(match.last_sent)}</td>
                  <td className="truncate px-2 py-1.5 text-slate-400">{match.channels.join(", ") || "—"}</td>
                </tr>
              ))
            ) : (
              <tr><td className="px-2 py-8 text-center text-slate-500" colSpan={18}>No active alert matches.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-3 py-2 text-xs text-slate-500">
        <span>Showing {visibleMatches.length.toLocaleString()} of {filteredMatches.length.toLocaleString()} filtered matches ({matches.length.toLocaleString()} total).</span>
        {sortedMatches.length > 300 ? (
          <button className="rounded border border-slate-700/80 px-2 py-1 font-semibold text-slate-300 hover:border-sky-400/50 hover:text-sky-200" onClick={() => setShowAll((current) => !current)} type="button">
            {showAll ? "Show 300" : "Show all"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
