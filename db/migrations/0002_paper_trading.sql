CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS paper_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    starting_balance NUMERIC NOT NULL,
    cash_balance NUMERIC NOT NULL,
    equity_value NUMERIC NOT NULL DEFAULT 0,
    realized_pnl NUMERIC NOT NULL DEFAULT 0,
    max_position_pct NUMERIC NOT NULL DEFAULT 0.10,
    risk_per_trade_pct NUMERIC NOT NULL DEFAULT 0.01,
    max_open_positions INTEGER NOT NULL DEFAULT 5,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paper_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES paper_accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    entry_price NUMERIC NOT NULL,
    quantity NUMERIC NOT NULL,
    stop_loss NUMERIC,
    target_price NUMERIC,
    final_decision TEXT,
    recommendation_quality TEXT,
    entry_status TEXT,
    setup_type TEXT,
    rating TEXT,
    realized_pnl NUMERIC DEFAULT 0,
    return_pct NUMERIC,
    close_reason TEXT,
    source_scan_run_id UUID,
    source_signal_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paper_positions_account_id ON paper_positions(account_id);
CREATE INDEX IF NOT EXISTS idx_paper_positions_symbol ON paper_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_paper_positions_status ON paper_positions(status);
CREATE INDEX IF NOT EXISTS idx_paper_positions_opened_at ON paper_positions(opened_at);

CREATE TABLE IF NOT EXISTS paper_trade_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES paper_accounts(id) ON DELETE CASCADE,
    position_id UUID REFERENCES paper_positions(id) ON DELETE SET NULL,
    symbol TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_reason TEXT,
    price NUMERIC,
    quantity NUMERIC,
    cash_delta NUMERIC,
    pnl_delta NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paper_trade_events_account_id ON paper_trade_events(account_id);
CREATE INDEX IF NOT EXISTS idx_paper_trade_events_symbol ON paper_trade_events(symbol);
CREATE INDEX IF NOT EXISTS idx_paper_trade_events_created_at ON paper_trade_events(created_at);
