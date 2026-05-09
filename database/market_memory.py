from __future__ import annotations

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


MARKET_MEMORY_REFRESH_SQL = """
WITH source_signals AS (
    SELECT
        ss.id AS scanner_signal_id,
        ss.scan_run_id,
        ss.symbol,
        COALESCE(sr.completed_at, sr.created_at, ss.created_at) AS signal_ts,
        ss.setup_type,
        ss.sector,
        COALESCE(ss.market_regime, sr.market_regime) AS market_regime,
        ss.final_decision,
        ss.final_score,
        CASE
            WHEN NULLIF(ss.payload->>'confidence_score', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                THEN (ss.payload->>'confidence_score')::numeric
            ELSE NULL
        END AS confidence_score,
        CASE
            WHEN NULLIF(ss.payload->>'readiness_score', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                THEN (ss.payload->>'readiness_score')::numeric
            ELSE NULL
        END AS readiness_score,
        ss.payload
    FROM scanner_signals ss
    JOIN scan_runs sr ON sr.id = ss.scan_run_id
    WHERE (CAST(:scan_run_id AS uuid) IS NULL OR ss.scan_run_id = CAST(:scan_run_id AS uuid))
),
normalized AS (
    SELECT
        source_signals.*,
        CASE
            WHEN final_score >= 85 THEN '85+'
            WHEN final_score >= 75 THEN '75-84'
            WHEN final_score >= 65 THEN '65-74'
            WHEN final_score >= 55 THEN '55-64'
            WHEN final_score IS NULL THEN NULL
            ELSE '<55'
        END AS score_bucket,
        lower(COALESCE(market_regime, 'unknown')) AS regime_key
    FROM source_signals
),
memory_rows AS (
    SELECT
        n.*,
        lower(concat_ws('|',
            COALESCE(n.setup_type, 'unknown_setup'),
            COALESCE(n.market_regime, 'unknown_regime'),
            COALESCE(n.sector, 'unknown_sector'),
            COALESCE(n.score_bucket, 'unknown_score'),
            COALESCE(n.final_decision, 'unknown_decision')
        )) AS setup_signature,
        jsonb_build_object(
            'setup_type', n.setup_type,
            'sector', n.sector,
            'market_regime', n.market_regime,
            'final_decision', n.final_decision,
            'score_bucket', n.score_bucket,
            'confidence_score', n.confidence_score,
            'readiness_score', n.readiness_score,
            'verified_event_signature', n.payload->>'verified_event_signature',
            'macro_event_regime_signature', n.payload->>'macro_event_regime_signature',
            'event_context_label', n.payload->>'event_context_label',
            'event_risk_score', n.payload->>'event_risk_score'
        ) AS signature,
        COALESCE(outcomes.outcome, '{}'::jsonb) AS outcome
    FROM normalized n
    LEFT JOIN LATERAL (
        SELECT jsonb_object_agg(
            COALESCE(fr.horizon, 'unknown'),
            jsonb_build_object(
                'return_pct', fr.return_pct,
                'signal_date', fr.signal_date
            )
        ) AS outcome
        FROM forward_returns fr
        WHERE fr.symbol = n.symbol
          AND fr.signal_date = n.signal_ts::date
          AND fr.return_pct IS NOT NULL
    ) outcomes ON true
),
upserted AS (
    INSERT INTO market_memory_snapshots (
        scanner_signal_id,
        scan_run_id,
        symbol,
        signal_ts,
        setup_type,
        sector,
        market_regime,
        final_decision,
        final_score,
        confidence_score,
        readiness_score,
        score_bucket,
        regime_key,
        setup_signature,
        signature,
        outcome,
        updated_at
    )
    SELECT
        scanner_signal_id,
        scan_run_id,
        symbol,
        signal_ts,
        setup_type,
        sector,
        market_regime,
        final_decision,
        final_score,
        confidence_score,
        readiness_score,
        score_bucket,
        regime_key,
        setup_signature,
        signature,
        outcome,
        now()
    FROM memory_rows
    ON CONFLICT (scanner_signal_id)
    DO UPDATE SET
        scan_run_id = EXCLUDED.scan_run_id,
        symbol = EXCLUDED.symbol,
        signal_ts = EXCLUDED.signal_ts,
        setup_type = EXCLUDED.setup_type,
        sector = EXCLUDED.sector,
        market_regime = EXCLUDED.market_regime,
        final_decision = EXCLUDED.final_decision,
        final_score = EXCLUDED.final_score,
        confidence_score = EXCLUDED.confidence_score,
        readiness_score = EXCLUDED.readiness_score,
        score_bucket = EXCLUDED.score_bucket,
        regime_key = EXCLUDED.regime_key,
        setup_signature = EXCLUDED.setup_signature,
        signature = EXCLUDED.signature,
        outcome = EXCLUDED.outcome,
        updated_at = now()
    RETURNING 1
)
SELECT count(*) FROM upserted
"""


def refresh_market_memory_snapshots(session: Session, scan_run_id: UUID | None = None) -> int:
    result = session.execute(text(MARKET_MEMORY_REFRESH_SQL), {"scan_run_id": str(scan_run_id) if scan_run_id is not None else None}).scalar_one()
    if isinstance(result, int):
        return result
    return int(result)
