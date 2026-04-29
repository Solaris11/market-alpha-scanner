"""Enforce one scanner signal per symbol per scan

Revision ID: 20260429_010000
Revises: 20260428_041000
Create Date: 2026-04-29 01:00:00
"""

from __future__ import annotations

from alembic import op


revision = "20260429_010000"
down_revision = "20260428_041000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM scanner_signals newer
        USING scanner_signals older
        WHERE newer.scan_run_id = older.scan_run_id
          AND newer.symbol = older.symbol
          AND newer.id::text > older.id::text
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'uq_scanner_signals_scan_run_symbol'
            ) THEN
                ALTER TABLE scanner_signals
                ADD CONSTRAINT uq_scanner_signals_scan_run_symbol UNIQUE (scan_run_id, symbol);
            END IF;
        END $$
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE scanner_signals DROP CONSTRAINT IF EXISTS uq_scanner_signals_scan_run_symbol")
