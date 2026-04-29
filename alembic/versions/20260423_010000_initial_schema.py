"""Initial scanner DB foundation

Revision ID: 20260423_010000
Revises:
Create Date: 2026-04-23 01:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260423_010000"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.create_table(
        "scan_runs",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("universe_count", sa.Integer(), nullable=True),
        sa.Column("symbols_scored", sa.Integer(), nullable=True),
        sa.Column("market_regime", sa.Text(), nullable=True),
        sa.Column("breadth", sa.Text(), nullable=True),
        sa.Column("leadership", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "scanner_signals",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("scan_run_id", sa.Uuid(as_uuid=True), sa.ForeignKey("scan_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("company_name", sa.Text(), nullable=True),
        sa.Column("asset_type", sa.Text(), nullable=True),
        sa.Column("sector", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(), nullable=True),
        sa.Column("final_score", sa.Numeric(), nullable=True),
        sa.Column("final_score_adjusted", sa.Numeric(), nullable=True),
        sa.Column("rating", sa.Text(), nullable=True),
        sa.Column("action", sa.Text(), nullable=True),
        sa.Column("setup_type", sa.Text(), nullable=True),
        sa.Column("entry_status", sa.Text(), nullable=True),
        sa.Column("recommendation_quality", sa.Text(), nullable=True),
        sa.Column("quality_score", sa.Numeric(), nullable=True),
        sa.Column("final_decision", sa.Text(), nullable=True),
        sa.Column("suggested_entry", sa.Text(), nullable=True),
        sa.Column("entry_distance_pct", sa.Numeric(), nullable=True),
        sa.Column("buy_zone", sa.Text(), nullable=True),
        sa.Column("stop_loss", sa.Numeric(), nullable=True),
        sa.Column("conservative_target", sa.Numeric(), nullable=True),
        sa.Column("risk_reward", sa.Numeric(), nullable=True),
        sa.Column("market_regime", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("scan_run_id", "symbol", name="uq_scanner_signals_scan_run_symbol"),
    )
    op.create_index("ix_scanner_signals_symbol", "scanner_signals", ["symbol"])
    op.create_index("ix_scanner_signals_created_at", "scanner_signals", ["created_at"])
    op.create_index("ix_scanner_signals_final_decision", "scanner_signals", ["final_decision"])
    op.create_index("ix_scanner_signals_scan_run_id", "scanner_signals", ["scan_run_id"])
    op.create_index("ix_scanner_signals_rating", "scanner_signals", ["rating"])


def downgrade() -> None:
    op.drop_index("ix_scanner_signals_rating", table_name="scanner_signals")
    op.drop_index("ix_scanner_signals_scan_run_id", table_name="scanner_signals")
    op.drop_index("ix_scanner_signals_final_decision", table_name="scanner_signals")
    op.drop_index("ix_scanner_signals_created_at", table_name="scanner_signals")
    op.drop_index("ix_scanner_signals_symbol", table_name="scanner_signals")
    op.drop_table("scanner_signals")
    op.drop_table("scan_runs")
