CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_user_sessions_expires_at ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_watchlist_user_symbol UNIQUE (user_id, symbol)
);

CREATE INDEX IF NOT EXISTS ix_user_watchlist_user_id ON user_watchlist(user_id);

CREATE TABLE IF NOT EXISTS user_risk_profile (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    max_risk_per_trade_percent NUMERIC NOT NULL DEFAULT 2,
    max_daily_loss NUMERIC,
    max_sector_positions INTEGER NOT NULL DEFAULT 2,
    allow_override BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE paper_accounts
ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE paper_positions
ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE paper_trade_events
ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS ix_paper_accounts_user_id ON paper_accounts(user_id);
CREATE INDEX IF NOT EXISTS ix_paper_positions_user_id ON paper_positions(user_id);
CREATE INDEX IF NOT EXISTS ix_paper_trade_events_user_id ON paper_trade_events(user_id);

DO $$
BEGIN
    IF to_regclass('public.alert_rules') IS NOT NULL THEN
        ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS user_id UUID;
        CREATE INDEX IF NOT EXISTS ix_alert_rules_user_id ON alert_rules(user_id);
    END IF;
END $$;
