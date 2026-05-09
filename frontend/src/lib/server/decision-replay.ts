import "server-only";

import type { QueryResultRow } from "pg";
import { dbQuery } from "@/lib/server/db";
import { buildDecisionReplayReport, buildReplayOutcome, type DecisionReplayOutcome, type DecisionReplayReport } from "@/lib/trading/decision-replay";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import type { RankingRow } from "@/lib/types";

type ReplayRunRow = QueryResultRow & {
  as_of: string;
  id: string;
};

type ReplaySignalRow = QueryResultRow & {
  action: string | null;
  asset_type: string | null;
  buy_zone: string | number | null;
  company_name: string | null;
  conservative_target: string | number | null;
  entry_distance_pct: string | number | null;
  entry_status: string | null;
  entry_zone_high: string | number | null;
  entry_zone_low: string | number | null;
  final_decision: string | null;
  final_score: string | number | null;
  final_score_adjusted: string | number | null;
  id: string;
  market_regime: string | null;
  payload: unknown;
  price: string | number | null;
  quality_score: string | number | null;
  rank_position: string | number | null;
  rating: string | null;
  recommendation_quality: string | null;
  risk_reward: string | number | null;
  sector: string | null;
  setup_type: string | null;
  stop_loss: string | number | null;
  suggested_entry: string | number | null;
  symbol: string;
  take_profit: string | number | null;
};

type ReplayOutcomeRow = QueryResultRow & {
  horizon: string | null;
  return_pct: string | number | null;
  symbol: string;
};

export async function getDecisionReplayReport(input: { symbol?: string | null; timestamp?: string | null }): Promise<DecisionReplayReport | null> {
  const requestedTimestamp = timestampParam(input.timestamp);
  const run = await findReplayRun(requestedTimestamp);
  if (!run) return null;
  const signalRows = await readRunSignals(run.id);
  if (!signalRows.length) return null;
  const rows = signalRows.map((row) => signalRowToRankingRow(row, run.as_of)).filter((row) => row.symbol);
  const symbols = rows.map((row) => row.symbol);
  const outcomesBySymbol = await readOutcomes(run.id, symbols);
  const opportunityModel = buildOpportunitiesPageModel(rows, null);
  return buildDecisionReplayReport({
    asOf: run.as_of,
    matchedScanRunId: run.id,
    outcomesBySymbol,
    requestedTimestamp,
    rows: opportunityModel.rows,
    symbol: input.symbol,
  });
}

async function findReplayRun(requestedTimestamp: string | null): Promise<ReplayRunRow | null> {
  const result = await dbQuery<ReplayRunRow>(
    `
      WITH target AS (
        SELECT $1::timestamptz AS requested
      )
      SELECT
        id::text,
        COALESCE(completed_at, created_at)::text AS as_of
      FROM scan_runs, target
      WHERE status = 'success'
      ORDER BY
        CASE
          WHEN target.requested IS NULL THEN 0
          WHEN COALESCE(completed_at, created_at) <= target.requested THEN 0
          ELSE 1
        END ASC,
        CASE
          WHEN target.requested IS NULL THEN COALESCE(completed_at, created_at)
        END DESC NULLS LAST,
        CASE
          WHEN target.requested IS NOT NULL AND COALESCE(completed_at, created_at) <= target.requested THEN COALESCE(completed_at, created_at)
        END DESC NULLS LAST,
        CASE
          WHEN target.requested IS NOT NULL AND COALESCE(completed_at, created_at) > target.requested THEN COALESCE(completed_at, created_at)
        END ASC NULLS LAST
      LIMIT 1
    `,
    [requestedTimestamp],
  );
  return result.rows[0] ?? null;
}

async function readRunSignals(scanRunId: string): Promise<ReplaySignalRow[]> {
  const result = await dbQuery<ReplaySignalRow>(
    `
      SELECT
        id::text,
        symbol,
        rank_position,
        company_name,
        asset_type,
        sector,
        price,
        rating,
        action,
        final_decision,
        final_score,
        final_score_adjusted,
        setup_type,
        entry_status,
        recommendation_quality,
        quality_score,
        suggested_entry,
        entry_distance_pct,
        entry_zone_low,
        entry_zone_high,
        buy_zone,
        stop_loss,
        take_profit,
        conservative_target,
        risk_reward,
        market_regime,
        payload
      FROM scanner_signals
      WHERE scan_run_id = $1::uuid
      ORDER BY rank_position ASC NULLS LAST, final_score DESC NULLS LAST, symbol ASC
    `,
    [scanRunId],
  );
  return result.rows;
}

async function readOutcomes(scanRunId: string, symbols: string[]): Promise<Map<string, DecisionReplayOutcome[]>> {
  const cleaned = Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)));
  if (!cleaned.length) return new Map();
  const result = await dbQuery<ReplayOutcomeRow>(
    `
      SELECT symbol, horizon, return_pct
      FROM forward_returns
      WHERE scan_run_id = $1::uuid
        AND symbol = ANY($2::text[])
      ORDER BY symbol, horizon
    `,
    [scanRunId, cleaned],
  ).catch(() => ({ rows: [] as ReplayOutcomeRow[] }));

  const grouped = new Map<string, DecisionReplayOutcome[]>();
  for (const row of result.rows) {
    const symbol = row.symbol.trim().toUpperCase();
    if (!symbol) continue;
    const items = grouped.get(symbol) ?? [];
    items.push(buildReplayOutcome(row.horizon ?? "unknown", row.return_pct));
    grouped.set(symbol, items);
  }
  return grouped;
}

function signalRowToRankingRow(row: ReplaySignalRow, asOf: string): RankingRow {
  const payload = recordFromUnknown(row.payload);
  return {
    ...payload,
    action: textOrUndefined(row.action),
    asset_type: textOrUndefined(row.asset_type),
    buy_zone: scalarOrUndefined(row.buy_zone),
    company_name: textOrUndefined(row.company_name),
    conservative_target: scalarOrUndefined(row.conservative_target),
    entry_distance_pct: numberOrUndefined(row.entry_distance_pct),
    entry_status: textOrUndefined(row.entry_status),
    entry_zone_high: numberOrUndefined(row.entry_zone_high),
    entry_zone_low: numberOrUndefined(row.entry_zone_low),
    final_decision: textOrUndefined(row.final_decision),
    final_score: numberOrUndefined(row.final_score),
    final_score_adjusted: numberOrUndefined(row.final_score_adjusted),
    last_updated: asOf,
    last_updated_utc: asOf,
    market_regime: textOrUndefined(row.market_regime),
    price: numberOrUndefined(row.price),
    quality_score: numberOrUndefined(row.quality_score),
    rank_position: numberOrUndefined(row.rank_position),
    rating: textOrUndefined(row.rating),
    recommendation_quality: textOrUndefined(row.recommendation_quality),
    risk_reward: numberOrUndefined(row.risk_reward),
    sector: textOrUndefined(row.sector),
    setup_type: textOrUndefined(row.setup_type),
    stop_loss: scalarOrUndefined(row.stop_loss),
    suggested_entry: scalarOrUndefined(row.suggested_entry),
    symbol: row.symbol.trim().toUpperCase(),
    take_profit: scalarOrUndefined(row.take_profit),
  };
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function timestampParam(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function textOrUndefined(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined", "n/a"].includes(text.toLowerCase())) return undefined;
  return text;
}

function scalarOrUndefined(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return textOrUndefined(value);
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[%,$]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}
