"""Harden paper trading schema for account-scoped frontend APIs

Revision ID: 20260502_000900
Revises: 20260430_061100
Create Date: 2026-05-02 00:09:00
"""

from __future__ import annotations

from alembic import op


revision = "20260502_000900"
down_revision = "20260430_061100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS paper_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            starting_balance NUMERIC NOT NULL DEFAULT 10000,
            cash_balance NUMERIC NOT NULL DEFAULT 10000,
            equity_value NUMERIC NOT NULL DEFAULT 0,
            realized_pnl NUMERIC NOT NULL DEFAULT 0,
            max_position_pct NUMERIC NOT NULL DEFAULT 0.10,
            risk_per_trade_pct NUMERIC NOT NULL DEFAULT 0.01,
            max_open_positions INTEGER NOT NULL DEFAULT 5,
            enabled BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );

        ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS name TEXT;
        ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS starting_balance NUMERIC NOT NULL DEFAULT 10000;
        ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS cash_balance NUMERIC NOT NULL DEFAULT 10000;
        ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS equity_value NUMERIC NOT NULL DEFAULT 0;
        ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC NOT NULL DEFAULT 0;
        ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS max_position_pct NUMERIC NOT NULL DEFAULT 0.10;
        ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS risk_per_trade_pct NUMERIC NOT NULL DEFAULT 0.01;
        ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS max_open_positions INTEGER NOT NULL DEFAULT 5;
        ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
        ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
        ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS user_id UUID;
        UPDATE paper_accounts SET created_at = COALESCE(created_at, now());
        UPDATE paper_accounts SET updated_at = COALESCE(updated_at, now());
        CREATE UNIQUE INDEX IF NOT EXISTS uq_paper_accounts_name ON paper_accounts(name);
        CREATE INDEX IF NOT EXISTS ix_paper_accounts_user_id ON paper_accounts(user_id);

        CREATE TABLE IF NOT EXISTS paper_positions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id UUID NOT NULL REFERENCES paper_accounts(id) ON DELETE CASCADE,
            symbol TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OPEN',
            opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            closed_at TIMESTAMPTZ,
            entry_price NUMERIC NOT NULL DEFAULT 0,
            exit_price NUMERIC,
            quantity NUMERIC NOT NULL DEFAULT 0,
            stop_loss NUMERIC,
            target_price NUMERIC,
            final_decision TEXT,
            recommendation_quality TEXT,
            entry_status TEXT,
            setup_type TEXT,
            rating TEXT,
            realized_pnl NUMERIC DEFAULT 0,
            unrealized_pnl NUMERIC,
            return_pct NUMERIC,
            close_reason TEXT,
            source_scan_run_id UUID,
            source_signal_id UUID,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );

        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS account_id UUID;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS symbol TEXT;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'OPEN';
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ NOT NULL DEFAULT now();
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS entry_price NUMERIC NOT NULL DEFAULT 0;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS exit_price NUMERIC;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS quantity NUMERIC NOT NULL DEFAULT 0;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS stop_loss NUMERIC;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS target_price NUMERIC;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS final_decision TEXT;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS recommendation_quality TEXT;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS entry_status TEXT;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS setup_type TEXT;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS rating TEXT;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC DEFAULT 0;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS unrealized_pnl NUMERIC;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS return_pct NUMERIC;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS close_reason TEXT;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS source_scan_run_id UUID;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS source_signal_id UUID;
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
        ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS user_id UUID;
        UPDATE paper_positions SET created_at = COALESCE(created_at, now());
        UPDATE paper_positions SET updated_at = COALESCE(updated_at, now());
        CREATE INDEX IF NOT EXISTS idx_paper_positions_account_id ON paper_positions(account_id);
        CREATE INDEX IF NOT EXISTS idx_paper_positions_symbol ON paper_positions(symbol);
        CREATE INDEX IF NOT EXISTS idx_paper_positions_status ON paper_positions(status);
        CREATE INDEX IF NOT EXISTS idx_paper_positions_opened_at ON paper_positions(opened_at);
        CREATE INDEX IF NOT EXISTS ix_paper_positions_user_id ON paper_positions(user_id);

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

        ALTER TABLE paper_trade_events ADD COLUMN IF NOT EXISTS account_id UUID;
        ALTER TABLE paper_trade_events ADD COLUMN IF NOT EXISTS position_id UUID;
        ALTER TABLE paper_trade_events ADD COLUMN IF NOT EXISTS symbol TEXT;
        ALTER TABLE paper_trade_events ADD COLUMN IF NOT EXISTS event_type TEXT;
        ALTER TABLE paper_trade_events ADD COLUMN IF NOT EXISTS event_reason TEXT;
        ALTER TABLE paper_trade_events ADD COLUMN IF NOT EXISTS price NUMERIC;
        ALTER TABLE paper_trade_events ADD COLUMN IF NOT EXISTS quantity NUMERIC;
        ALTER TABLE paper_trade_events ADD COLUMN IF NOT EXISTS cash_delta NUMERIC;
        ALTER TABLE paper_trade_events ADD COLUMN IF NOT EXISTS pnl_delta NUMERIC;
        ALTER TABLE paper_trade_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
        ALTER TABLE paper_trade_events ADD COLUMN IF NOT EXISTS user_id UUID;
        UPDATE paper_trade_events SET created_at = COALESCE(created_at, now());
        CREATE INDEX IF NOT EXISTS idx_paper_trade_events_account_id ON paper_trade_events(account_id);
        CREATE INDEX IF NOT EXISTS idx_paper_trade_events_symbol ON paper_trade_events(symbol);
        CREATE INDEX IF NOT EXISTS idx_paper_trade_events_created_at ON paper_trade_events(created_at);
        CREATE INDEX IF NOT EXISTS ix_paper_trade_events_user_id ON paper_trade_events(user_id);
        """
    )


def downgrade() -> None:
    # This migration is intentionally additive and data-preserving.
    return None
