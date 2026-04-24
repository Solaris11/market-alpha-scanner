"use client";

import { useMemo, useState } from "react";
import { actionFor, formatNumber } from "@/lib/format";
import type { HistorySummary, SymbolHistoryData, SymbolHistoryRow } from "@/lib/types";

type Props = {
  history: HistorySummary;
  symbolHistory: SymbolHistoryData;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";
  return String(value).replace("T", " ").replace("Z", " UTC");
}

function timestampMs(row: { timestamp_utc: string }) {
  const ms = Date.parse(row.timestamp_utc);
  return Number.isFinite(ms) ? ms : null;
}

function formatDelta(value: number | null, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}${suffix}`;
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

export function HistoryWorkspace({ history, symbolHistory }: Props) {
  const defaultSymbol = symbolHistory.symbols[0] ?? "";
  const [symbolQuery, setSymbolQuery] = useState(defaultSymbol);
  const selectedSymbol = symbolQuery.trim().toUpperCase();
  const exactSymbol = symbolHistory.symbols.includes(selectedSymbol) ? selectedSymbol : "";

  const symbolRows = useMemo(() => {
    if (!exactSymbol) return [];
    return symbolHistory.rows.filter((row) => row.symbol === exactSymbol).sort((a, b) => String(a.timestamp_utc).localeCompare(String(b.timestamp_utc)));
  }, [exactSymbol, symbolHistory.rows]);

  const first = symbolRows[0];
  const latest = symbolRows[symbolRows.length - 1];
  const scoreChange = first && latest && typeof first.final_score === "number" && typeof latest.final_score === "number" ? latest.final_score - first.final_score : null;
  const priceChange = first && latest && typeof first.price === "number" && typeof latest.price === "number" ? latest.price - first.price : null;
  const rowsDescending = [...symbolRows].reverse();
  const avgInterval = averageInterval(symbolRows);
  const matchingSymbols = symbolQuery
    ? symbolHistory.symbols.filter((symbol) => symbol.includes(selectedSymbol)).slice(0, 8)
    : symbolHistory.symbols.slice(0, 8);

  return (
    <div className="space-y-3">
      <section className="terminal-panel rounded-md p-4">
        <div className="grid gap-3 lg:grid-cols-[260px_260px_1fr]">
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Type Symbol
            <input
              className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
              list="history-symbols"
              onChange={(event) => setSymbolQuery(event.target.value.toUpperCase())}
              placeholder="Type symbol, e.g. AVGO"
              value={symbolQuery}
            />
            <datalist id="history-symbols">
              {symbolHistory.symbols.map((symbol) => (
                <option key={symbol} value={symbol} />
              ))}
            </datalist>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Select Symbol
            <select
              className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
              onChange={(event) => setSymbolQuery(event.target.value)}
              value={exactSymbol}
            >
              <option value="">Select symbol</option>
              {symbolHistory.symbols.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-slate-500">
            {exactSymbol ? (
              <>
                Showing {symbolRows.length.toLocaleString()} snapshots for <span className="font-mono text-slate-200">{exactSymbol}</span>.
              </>
            ) : (
              <>No symbol history found for this query. Try one of: {matchingSymbols.join(", ") || "no symbols available"}.</>
            )}
          </div>
        </div>
      </section>

      {latest ? (
        <>
          <section className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
            {[
              { label: "First Score", value: formatNumber(first?.final_score), meta: formatDate(first?.timestamp_utc) },
              { label: "Latest Score", value: formatNumber(latest.final_score), meta: formatDate(latest.timestamp_utc) },
              { label: "Score Change", value: formatDelta(scoreChange), meta: "latest - first" },
              { label: "Rating", value: latest.rating ?? "N/A", meta: "latest" },
              { label: "Action", value: actionFor(latest), meta: "latest" },
              { label: "Price", value: formatNumber(latest.price), meta: "latest" },
              { label: "Price Change", value: formatDelta(priceChange), meta: "latest - first" },
              { label: "Snapshots", value: symbolRows.length.toLocaleString(), meta: `avg ${formatDuration(avgInterval)}` },
            ].map((metric) => (
              <div className="terminal-panel min-w-0 rounded-md px-3 py-2" key={metric.label}>
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</div>
                <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{metric.value}</div>
                <div className="mt-0.5 truncate text-[11px] text-slate-500">{metric.meta}</div>
              </div>
            ))}
          </section>

          <div className="grid gap-3 xl:grid-cols-2">
            <TrendChart field="final_score" label="Final Score" rows={symbolRows} />
            <TrendChart field="price" label="Price" rows={symbolRows} />
          </div>

          <section>
            <div className="mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Symbol Timeline</div>
              <h2 className="text-lg font-semibold text-slate-50">{exactSymbol} Snapshot History</h2>
            </div>
            <div className="terminal-panel overflow-x-auto rounded-md">
              <table className="w-full min-w-[1260px] table-fixed border-collapse text-xs">
                <colgroup>
                  <col style={{ width: 220 }} />
                  <col style={{ width: 95 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 145 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 250 }} />
                </colgroup>
                <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Timestamp</th>
                    <th className="px-2 py-1.5 text-right">Price</th>
                    <th className="px-2 py-1.5 text-right">Final Score</th>
                    <th className="px-2 py-1.5 text-left">Rating</th>
                    <th className="px-2 py-1.5 text-left">Action</th>
                    <th className="px-2 py-1.5 text-left">Setup</th>
                    <th className="px-2 py-1.5 text-left">Buy Zone</th>
                    <th className="px-2 py-1.5 text-left">Stop Loss</th>
                    <th className="px-2 py-1.5 text-left">Take Profit Zone</th>
                    <th className="px-2 py-1.5 text-left">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/90">
                  {rowsDescending.map((row) => (
                    <tr className="hover:bg-sky-400/5" key={`${row.source_file}-${row.symbol}`}>
                      <td className="truncate px-2 py-1.5 text-slate-300">{formatDate(row.timestamp_utc)}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-slate-200">{formatNumber(row.price)}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-emerald-200">{formatNumber(row.final_score)}</td>
                      <td className="truncate px-2 py-1.5 text-slate-300">{row.rating ?? "N/A"}</td>
                      <td className="truncate px-2 py-1.5 text-slate-300">{actionFor(row)}</td>
                      <td className="truncate px-2 py-1.5 text-slate-400">{row.setup_type ?? "N/A"}</td>
                      <td className="truncate px-2 py-1.5 text-slate-400">{String(valueFrom(row, ["buy_zone", "entry_zone"]) ?? "N/A")}</td>
                      <td className="truncate px-2 py-1.5 text-slate-400">{String(valueFrom(row, ["stop_loss", "invalidation_level"]) ?? "N/A")}</td>
                      <td className="truncate px-2 py-1.5 text-slate-400">{takeProfitDisplay(row)}</td>
                      <td className="truncate px-2 py-1.5 font-mono text-slate-500">{row.source_file}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <details className="terminal-panel rounded-md p-4 text-xs text-slate-400">
        <summary className="cursor-pointer font-semibold uppercase tracking-[0.12em] text-slate-500">Raw snapshot files</summary>
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
              {history.snapshots.map((snapshot) => (
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
