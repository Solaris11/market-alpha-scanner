import "server-only";

import type { ActiveAlertMatch, ActiveAlertMatchesResponse } from "@/lib/active-alert-matches";
import type { CsvRow, RankingRow, SymbolDetail, SymbolHistoryRow } from "@/lib/types";

const RANKING_PREVIEW_KEYS: readonly string[] = [
  "symbol",
  "company_name",
  "asset_type",
  "sector",
  "price",
  "return_1d",
  "last_updated",
  "last_updated_utc",
  "final_score",
  "final_score_adjusted",
  "recommendation_quality",
  "final_decision",
  "rating",
  "action",
  "setup_type",
  "market_regime",
] as const;

const HISTORY_PREVIEW_KEYS: readonly string[] = [
  "symbol",
  "company_name",
  "price",
  "final_score",
  "rating",
  "action",
  "setup_type",
  "timestamp_utc",
] as const;

export function previewRankingRows(rows: RankingRow[], limit = 3): RankingRow[] {
  return rows.slice(0, limit).map(previewRankingRow);
}

export function previewRankingRow(row: RankingRow): RankingRow {
  const preview: RankingRow = { symbol: row.symbol };
  for (const key of RANKING_PREVIEW_KEYS) {
    const value = row[key];
    if (value !== undefined) {
      preview[key] = value;
    }
  }
  return preview;
}

export function previewSymbolDetail(detail: SymbolDetail): SymbolDetail {
  return {
    row: detail.row ? previewRankingRow(detail.row) : null,
    summary: null,
    history: [],
  };
}

export function previewSymbolHistoryRows(rows: SymbolHistoryRow[], limit = 5): RankingRow[] {
  return rows.slice(-limit).map((row) => {
    const preview: RankingRow = { symbol: row.symbol };
    for (const key of HISTORY_PREVIEW_KEYS) {
      const value = row[key];
      if (value !== undefined) {
        preview[key] = value;
      }
    }
    return preview;
  });
}

export function previewCsvRows(rows: CsvRow[], limit = 25): CsvRow[] {
  return rows.slice(-limit);
}

export function previewAlertMatches(response: ActiveAlertMatchesResponse, limit = 5): ActiveAlertMatchesResponse {
  return {
    ...response,
    matches: response.matches.slice(0, limit).map(previewAlertMatch),
  };
}

function previewAlertMatch(match: ActiveAlertMatch): ActiveAlertMatch {
  return {
    ...match,
    match_reason: match.match_reason || "Signal matched current scanner conditions.",
    channels: [],
    cooldown_minutes: null,
    last_sent: null,
    cooldown_active: false,
  };
}
