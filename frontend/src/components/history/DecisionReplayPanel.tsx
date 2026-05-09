"use client";

import { useEffect, useMemo, useState } from "react";
import type { DecisionReplayReport } from "@/lib/trading/decision-replay";
import { formatNumber } from "@/lib/format";
import type { SymbolHistoryRow } from "@/lib/types";
import { decisionLabel } from "@/lib/ui/labels";

type Props = {
  rows: SymbolHistoryRow[];
  selectedSymbol: string;
};

type ReplayPayload = {
  message?: string;
  ok?: boolean;
  replay?: DecisionReplayReport;
};

export function DecisionReplayPanel({ rows, selectedSymbol }: Props) {
  const replayOptions = useMemo(() => replayRows(rows), [rows]);
  const [selectedTimestamp, setSelectedTimestamp] = useState(() => replayOptions[0]?.timestamp_utc ?? "");
  const [replay, setReplay] = useState<DecisionReplayReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedTimestamp(replayOptions[0]?.timestamp_utc ?? "");
  }, [replayOptions]);

  useEffect(() => {
    let active = true;
    async function loadReplay() {
      if (!selectedSymbol || !selectedTimestamp) {
        setReplay(null);
        setError("");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ symbol: selectedSymbol, timestamp: selectedTimestamp });
        const response = await fetch(`/api/history/replay?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as ReplayPayload | null;
        if (!response.ok || !payload?.replay) throw new Error(payload?.message ?? `Replay request failed: ${response.status}`);
        if (active) setReplay(payload.replay);
      } catch (caught) {
        if (active) {
          setReplay(null);
          setError(caught instanceof Error ? caught.message : "Decision replay is unavailable.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadReplay();
    return () => {
      active = false;
    };
  }, [selectedSymbol, selectedTimestamp]);

  if (!replayOptions.length) return null;

  const selected = replay?.before.selected ?? null;

  return (
    <section className="terminal-panel rounded-md p-4" data-testid="decision-replay-panel">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Decision Replay</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Historical Intelligence Playback</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            Replay shows what TradeVeto knew at the selected scanner snapshot, then compares it with stored forward-return evidence when available. Research context only, not financial advice.
          </p>
        </div>
        <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Replay Snapshot
          <select
            className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
            onChange={(event) => setSelectedTimestamp(event.target.value)}
            value={selectedTimestamp}
          >
            {replayOptions.map((row) => (
              <option key={`${row.source_file}-${row.timestamp_utc}`} value={row.timestamp_utc ?? ""}>
                {formatReplayDate(row.timestamp_utc)} | {decisionLabel(row.final_decision ?? row.rating)} | {formatNumber(row.final_score)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="mt-3 rounded border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-50">{error}</div>
      ) : null}

      {loading ? (
        <div className="mt-3 rounded border border-slate-700/80 bg-slate-950/40 px-3 py-6 text-center text-xs text-slate-500">Loading replay snapshot...</div>
      ) : null}

      {!loading && replay ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Matched Snapshot" value={formatReplayDate(replay.asOf)} meta="scanner state" />
            <MetricCard label="Market State" value={replay.before.marketState} meta="then" />
            <MetricCard label="Decision" value={selected?.decision ?? "N/A"} meta={selected?.setupType ?? "selected symbol"} />
            <MetricCard label="Base Score" value={formatNumber(selected?.finalScore)} meta="then" />
            <MetricCard label="Conviction" value={`${selected?.conviction ?? "N/A"}/100`} meta="then" />
            <MetricCard label="Fragility" value={`${selected?.fragility ?? "N/A"}/100`} meta="then" />
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <div className="rounded border border-white/10 bg-white/[0.02] p-3 xl:col-span-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Before The Move</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{replay.before.marketSummary}</p>
              {selected ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <ContextPill label="Macro" value={selected.macroContext} />
                  <ContextPill label="Events" value={selected.eventContext} />
                  <ContextPill label="Price" value={formatNumber(selected.price)} />
                </div>
              ) : null}
            </div>

            <div className="rounded border border-white/10 bg-white/[0.02] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Afterward</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{replay.after.summary}</p>
              <div className="mt-3 space-y-1">
                {replay.after.outcomes.length ? replay.after.outcomes.map((outcome) => (
                  <div className="flex items-center justify-between gap-2 rounded border border-slate-800/80 bg-slate-950/45 px-2 py-1.5 text-xs" key={outcome.horizon}>
                    <span className="font-semibold text-slate-300">{outcome.horizon}</span>
                    <span className="font-mono text-slate-100">{formatOutcome(outcome.returnPct)}</span>
                  </div>
                )) : <div className="text-xs text-slate-500">Outcome tracking pending or unavailable for this snapshot.</div>}
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <ReplayList title="Top Opportunities Then" items={replay.before.topOpportunities.map((item) => `${item.symbol}: ${item.category} | opportunity ${item.opportunityScore}/100 | risk ${item.riskScore}/100`)} />
            <ReplayList title="Visible Risks Then" items={replay.before.visibleRisks.map((item) => `${item.symbol}: ${item.detail}`)} />
            <ReplayList title="Decision Quality Review" items={replay.decisionQualityReview} />
          </div>

          <details className="rounded border border-slate-800/80 bg-slate-950/35 px-3 py-2 text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold uppercase tracking-[0.12em] text-slate-400">Replay limitations</summary>
            <ul className="mt-2 space-y-1">
              {replay.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </section>
  );
}

function replayRows(rows: SymbolHistoryRow[]): SymbolHistoryRow[] {
  return rows
    .filter((row) => Boolean(row.timestamp_utc))
    .slice()
    .sort((left, right) => Date.parse(String(right.timestamp_utc ?? "")) - Date.parse(String(left.timestamp_utc ?? "")))
    .slice(0, 80);
}

function formatReplayDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value).replace("T", " ").replace("Z", " UTC");
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatOutcome(value: number | null): string {
  if (value === null) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}%`;
}

function MetricCard({ label, meta, value }: { label: string; meta: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-slate-500">{meta}</div>
    </div>
  );
}

function ContextPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-slate-800/80 bg-slate-950/45 px-2 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="truncate text-xs font-semibold text-slate-200">{value}</div>
    </div>
  );
}

function ReplayList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</div>
      <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-300">
        {items.length ? items.slice(0, 5).map((item) => <li key={item}>{item}</li>) : <li className="text-slate-500">No replay evidence available.</li>}
      </ul>
    </div>
  );
}
