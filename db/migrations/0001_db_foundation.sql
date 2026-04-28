CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS scan_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    universe_count INTEGER,
    symbols_scored INTEGER,
    market_regime TEXT,
    breadth TEXT,
    leadership TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scanner_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_run_id UUID NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    company_name TEXT,
    asset_type TEXT,
    sector TEXT,
    price NUMERIC,
    final_score NUMERIC,
    final_score_adjusted NUMERIC,
    rating TEXT,
    action TEXT,
    setup_type TEXT,
    entry_status TEXT,
    recommendation_quality TEXT,
    quality_score NUMERIC,
    final_decision TEXT,
    suggested_entry TEXT,
    entry_distance_pct NUMERIC,
    buy_zone TEXT,
    stop_loss NUMERIC,
    conservative_target NUMERIC,
    risk_reward NUMERIC,
    market_regime TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scanner_signals_symbol ON scanner_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_scanner_signals_created_at ON scanner_signals(created_at);
CREATE INDEX IF NOT EXISTS idx_scanner_signals_final_decision ON scanner_signals(final_decision);
CREATE INDEX IF NOT EXISTS idx_scanner_signals_scan_run_id ON scanner_signals(scan_run_id);
CREATE INDEX IF NOT EXISTS idx_scanner_signals_rating ON scanner_signals(rating);
