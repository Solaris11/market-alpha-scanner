import { Pool, type QueryResultRow } from "pg";
import { loadEnvFiles, safeErrorMessage } from "./monitoring-common";
import { buildShockMovePattern, normalizeShockPriceBars, type ShockMovePattern, type ShockMovePriceBar, type ShockMoveWindow } from "../src/lib/trading/shock-move";

type LatestSignalRow = QueryResultRow & {
  asset_type: string | null;
  final_decision: string | null;
  final_score: string | number | null;
  payload: unknown;
  price: string | number | null;
  sector: string | null;
  setup_type: string | null;
  symbol: string;
};

type PriceHistoryRow = QueryResultRow & {
  close: string | number | null;
  high: string | number | null;
  low: string | number | null;
  open: string | number | null;
  symbol: string;
  ts: string | Date;
  volume: string | number | null;
};

const WINDOWS: ShockMoveWindow[] = ["1y", "3y", "5y"];

loadEnvFiles();

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ ok: false, error: safeErrorMessage(error) }));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for shock pattern refresh.");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const signals = await latestSignals(pool);
    const symbols = signals.map((row) => row.symbol.trim().toUpperCase()).filter(Boolean);
    const priceRows = await priceHistory(pool, symbols);
    const priceBySymbol = groupPriceRows(priceRows);
    let patternsWritten = 0;
    let eventsWritten = 0;
    const topPatterns: ShockMovePattern[] = [];
    const signalBySymbol = new Map(signals.map((row) => [row.symbol.trim().toUpperCase(), row]));

    for (const symbol of symbols) {
      const bars = priceBySymbol.get(symbol) ?? [];
      const patterns: ShockMovePattern[] = [];
      for (const lookbackWindow of WINDOWS) {
        const pattern = buildShockMovePattern({ bars, lookbackWindow, symbol });
        if (!pattern) continue;
        const signal = signalBySymbol.get(symbol) ?? null;
        await upsertPattern(pool, pattern, signal);
        patternsWritten += 1;
        patterns.push(pattern);
        if (lookbackWindow === "1y") topPatterns.push(pattern);
      }
      const longest = patterns.find((pattern) => pattern.lookbackWindow === "5y") ?? patterns.find((pattern) => pattern.lookbackWindow === "3y") ?? patterns.find((pattern) => pattern.lookbackWindow === "1y") ?? null;
      if (longest) {
        for (const event of longest.shockEvents) {
          await upsertEvent(pool, longest.symbol, event);
          eventsWritten += 1;
        }
      }
    }

    const top = topPatterns
      .sort((left, right) => right.opportunityScore - left.opportunityScore || right.asymmetryScore - left.asymmetryScore || left.symbol.localeCompare(right.symbol))
      .slice(0, 10)
      .map((pattern) => ({
        asymmetryScore: pattern.asymmetryScore,
        downsideRiskScore: pattern.downsideRiskScore,
        opportunityScore: pattern.opportunityScore,
        opportunityState: pattern.opportunityState,
        reliabilityScore: pattern.reliabilityScore,
        symbol: pattern.symbol,
        upsideShockScore: pattern.upsideShockScore,
      }));

    console.log(JSON.stringify({ ok: true, eventsWritten, patternsWritten, symbols: symbols.length, top }, null, 2));
  } finally {
    await pool.end();
  }
}

async function latestSignals(pool: Pool): Promise<LatestSignalRow[]> {
  const result = await pool.query<LatestSignalRow>(`
    WITH latest_run AS (
      SELECT id
      FROM scan_runs
      WHERE status = 'success'
      ORDER BY completed_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    )
    SELECT
      ss.symbol,
      ss.asset_type,
      ss.sector,
      ss.price,
      ss.final_decision,
      ss.final_score,
      ss.setup_type,
      ss.payload
    FROM scanner_signals ss
    JOIN latest_run ON latest_run.id = ss.scan_run_id
    ORDER BY ss.rank_position ASC NULLS LAST, ss.symbol ASC
  `);
  if (result.rows.length) return result.rows;
  const fallback = await pool.query<{ symbol: string }>("SELECT DISTINCT symbol FROM symbol_price_history ORDER BY symbol ASC LIMIT 250");
  return fallback.rows.map((row) => ({
    asset_type: null,
    final_decision: null,
    final_score: null,
    payload: {},
    price: null,
    sector: null,
    setup_type: null,
    symbol: row.symbol,
  }));
}

async function priceHistory(pool: Pool, symbols: string[]): Promise<PriceHistoryRow[]> {
  if (!symbols.length) return [];
  const result = await pool.query<PriceHistoryRow>(
    `
      SELECT symbol, ts, open, high, low, close, volume
      FROM symbol_price_history
      WHERE symbol = ANY($1::text[])
        AND ts >= now() - interval '5 years 30 days'
      ORDER BY symbol ASC, ts ASC
    `,
    [symbols],
  );
  return result.rows;
}

function groupPriceRows(rows: PriceHistoryRow[]): Map<string, ShockMovePriceBar[]> {
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const symbol = row.symbol.trim().toUpperCase();
    const list = grouped.get(symbol) ?? [];
    list.push({
      close: row.close,
      date: timestampText(row.ts),
      high: row.high,
      low: row.low,
      open: row.open,
      volume: row.volume,
    });
    grouped.set(symbol, list);
  }
  return new Map(Array.from(grouped.entries()).map(([symbol, items]) => [symbol, normalizeShockPriceBars(items)]));
}

async function upsertPattern(pool: Pool, pattern: ShockMovePattern, signal: LatestSignalRow | null): Promise<void> {
  const sectorMacroContext = {
    assetType: signal?.asset_type ?? null,
    finalDecision: signal?.final_decision ?? null,
    finalScore: signal?.final_score ?? null,
    sector: signal?.sector ?? null,
    setupType: signal?.setup_type ?? null,
  };
  const verifiedEventContext = {
    eventLabel: payloadField(signal?.payload, "verified_event_label") ?? payloadField(signal?.payload, "event_context_label") ?? null,
    eventRiskScore: payloadField(signal?.payload, "event_risk_score") ?? null,
    shockPressureScore: payloadField(signal?.payload, "event_shock_pressure_score") ?? null,
    sourcesUsed: payloadField(signal?.payload, "verified_event_sources_used") ?? [],
  };
  const metrics = {
    averageFollowthrough1d: pattern.averageFollowthrough1d,
    averageFollowthrough5d: pattern.averageFollowthrough5d,
    chaseSuccessRate: pattern.chaseSuccessRate,
    pullbackSuccessRate: pattern.pullbackSuccessRate,
    shockEventSampleSize: pattern.shockEvents.length,
  };

  await pool.query(
    `
      INSERT INTO shock_move_patterns (
        symbol,
        lookback_window,
        upside_shock_count,
        downside_shock_count,
        largest_upside_1d,
        largest_downside_1d,
        median_upside_shock,
        median_downside_shock,
        average_followthrough_1d,
        average_followthrough_5d,
        average_reversal_5d,
        chase_success_rate,
        pullback_success_rate,
        reliability_score,
        opportunity_score,
        downside_risk_score,
        upside_shock_score,
        two_sided_volatility_score,
        current_similarity_score,
        asymmetry_score,
        chase_risk_score,
        opportunity_state,
        chase_risk_label,
        research_entry_zone,
        do_not_chase_zone,
        invalidation_zone,
        historical_exit_zone,
        average_profit_potential,
        average_drawdown_after_entry,
        common_preconditions,
        common_failure_conditions,
        sector_macro_context,
        verified_event_context,
        latest_event,
        shock_events,
        metrics,
        last_updated,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29,
        $30::jsonb, $31::jsonb, $32::jsonb, $33::jsonb, $34::jsonb, $35::jsonb, $36::jsonb,
        now(), now()
      )
      ON CONFLICT (symbol, lookback_window)
      DO UPDATE SET
        upside_shock_count = EXCLUDED.upside_shock_count,
        downside_shock_count = EXCLUDED.downside_shock_count,
        largest_upside_1d = EXCLUDED.largest_upside_1d,
        largest_downside_1d = EXCLUDED.largest_downside_1d,
        median_upside_shock = EXCLUDED.median_upside_shock,
        median_downside_shock = EXCLUDED.median_downside_shock,
        average_followthrough_1d = EXCLUDED.average_followthrough_1d,
        average_followthrough_5d = EXCLUDED.average_followthrough_5d,
        average_reversal_5d = EXCLUDED.average_reversal_5d,
        chase_success_rate = EXCLUDED.chase_success_rate,
        pullback_success_rate = EXCLUDED.pullback_success_rate,
        reliability_score = EXCLUDED.reliability_score,
        opportunity_score = EXCLUDED.opportunity_score,
        downside_risk_score = EXCLUDED.downside_risk_score,
        upside_shock_score = EXCLUDED.upside_shock_score,
        two_sided_volatility_score = EXCLUDED.two_sided_volatility_score,
        current_similarity_score = EXCLUDED.current_similarity_score,
        asymmetry_score = EXCLUDED.asymmetry_score,
        chase_risk_score = EXCLUDED.chase_risk_score,
        opportunity_state = EXCLUDED.opportunity_state,
        chase_risk_label = EXCLUDED.chase_risk_label,
        research_entry_zone = EXCLUDED.research_entry_zone,
        do_not_chase_zone = EXCLUDED.do_not_chase_zone,
        invalidation_zone = EXCLUDED.invalidation_zone,
        historical_exit_zone = EXCLUDED.historical_exit_zone,
        average_profit_potential = EXCLUDED.average_profit_potential,
        average_drawdown_after_entry = EXCLUDED.average_drawdown_after_entry,
        common_preconditions = EXCLUDED.common_preconditions,
        common_failure_conditions = EXCLUDED.common_failure_conditions,
        sector_macro_context = EXCLUDED.sector_macro_context,
        verified_event_context = EXCLUDED.verified_event_context,
        latest_event = EXCLUDED.latest_event,
        shock_events = EXCLUDED.shock_events,
        metrics = EXCLUDED.metrics,
        last_updated = now(),
        updated_at = now()
    `,
    [
      pattern.symbol,
      pattern.lookbackWindow,
      pattern.upsideShockCount,
      pattern.downsideShockCount,
      pattern.largestUpside1d,
      pattern.largestDownside1d,
      pattern.medianUpsideShock,
      pattern.medianDownsideShock,
      pattern.averageFollowthrough1d,
      pattern.averageFollowthrough5d,
      pattern.averageReversal5d,
      pattern.chaseSuccessRate,
      pattern.pullbackSuccessRate,
      pattern.reliabilityScore,
      pattern.opportunityScore,
      pattern.downsideRiskScore,
      pattern.upsideShockScore,
      pattern.twoSidedVolatilityScore,
      pattern.currentSimilarityScore,
      pattern.asymmetryScore,
      pattern.chaseRiskScore,
      pattern.opportunityState,
      pattern.chaseRiskLabel,
      pattern.researchEntryZone,
      pattern.doNotChaseZone,
      pattern.invalidationZone,
      pattern.historicalExitZone,
      pattern.averageProfitPotential,
      pattern.averageDrawdownAfterEntry,
      JSON.stringify(pattern.commonPreconditions),
      JSON.stringify(pattern.commonFailureConditions),
      JSON.stringify(sectorMacroContext),
      JSON.stringify(verifiedEventContext),
      JSON.stringify(pattern.latestEvent),
      JSON.stringify(pattern.shockEvents),
      JSON.stringify(metrics),
    ],
  );
}

async function upsertEvent(pool: Pool, symbol: string, event: ShockMovePattern["shockEvents"][number]): Promise<void> {
  await pool.query(
    `
      INSERT INTO shock_move_events (
        symbol,
        event_date,
        move_type,
        return_1d,
        return_2d,
        return_3d,
        return_5d,
        return_10d,
        volume_spike_ratio,
        atr_normalized_move,
        return_zscore,
        gap_pct,
        max_favorable_excursion_5d,
        max_adverse_excursion_5d,
        preconditions,
        post_outcome,
        outcome_status,
        updated_at
      )
      VALUES (
        $1, $2::date, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb, $17, now()
      )
      ON CONFLICT (symbol, event_date, move_type)
      DO UPDATE SET
        return_1d = EXCLUDED.return_1d,
        return_2d = EXCLUDED.return_2d,
        return_3d = EXCLUDED.return_3d,
        return_5d = EXCLUDED.return_5d,
        return_10d = EXCLUDED.return_10d,
        volume_spike_ratio = EXCLUDED.volume_spike_ratio,
        atr_normalized_move = EXCLUDED.atr_normalized_move,
        return_zscore = EXCLUDED.return_zscore,
        gap_pct = EXCLUDED.gap_pct,
        max_favorable_excursion_5d = EXCLUDED.max_favorable_excursion_5d,
        max_adverse_excursion_5d = EXCLUDED.max_adverse_excursion_5d,
        preconditions = EXCLUDED.preconditions,
        post_outcome = EXCLUDED.post_outcome,
        outcome_status = EXCLUDED.outcome_status,
        updated_at = now()
    `,
    [
      symbol,
      event.eventDate,
      event.moveType,
      event.return1d,
      event.return2d,
      event.return3d,
      event.return5d,
      event.return10d,
      event.volumeSpikeRatio,
      event.atrNormalizedMove,
      event.returnZScore,
      event.gapPercent,
      event.maxFavorableExcursion5d,
      event.maxAdverseExcursion5d,
      JSON.stringify(event.preconditions),
      JSON.stringify({
        maxAdverseExcursion5d: event.maxAdverseExcursion5d,
        maxFavorableExcursion5d: event.maxFavorableExcursion5d,
        return10d: event.return10d,
        return2d: event.return2d,
        return3d: event.return3d,
        return5d: event.return5d,
      }),
      event.outcomeStatus,
    ],
  );
}

function payloadField(payload: unknown, key: string): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return (payload as Record<string, unknown>)[key] ?? null;
}

function timestampText(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
