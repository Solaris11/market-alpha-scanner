"""Harden scanner timestamp columns used by frontend reads

Revision ID: 20260502_001000
Revises: 20260502_000900
Create Date: 2026-05-02 00:10:00
"""

from __future__ import annotations

from alembic import op


revision = "20260502_001000"
down_revision = "20260502_000900"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()")
    op.execute("ALTER TABLE scanner_signals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()")
    op.execute("CREATE INDEX IF NOT EXISTS idx_scanner_signals_created_at ON scanner_signals(created_at)")


def downgrade() -> None:
    # Additive compatibility migration; keep existing production data intact.
    return None
