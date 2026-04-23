"""Initial scanner schema

Revision ID: 20260423_010000
Revises: 
Create Date: 2026-04-23 01:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260423_010000"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scan_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("universe_size", sa.Integer(), nullable=True),
        sa.Column("scanned_count", sa.Integer(), nullable=True),
        sa.Column("ranked_count", sa.Integer(), nullable=True),
        sa.Column("scanner_version", sa.String(length=64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "symbol_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scan_run_id", sa.Integer(), sa.ForeignKey("scan_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("asset_type", sa.String(length=64), nullable=True),
        sa.Column("price", sa.Numeric(18, 6), nullable=True),
        sa.Column("trend_score", sa.Numeric(10, 4), nullable=True),
        sa.Column("momentum_score", sa.Numeric(10, 4), nullable=True),
        sa.Column("breakout_score", sa.Numeric(10, 4), nullable=True),
        sa.Column("rsi_macd_score", sa.Numeric(10, 4), nullable=True),
        sa.Column("volume_score", sa.Numeric(10, 4), nullable=True),
        sa.Column("fundamentals_score", sa.Numeric(10, 4), nullable=True),
        sa.Column("risk_penalty", sa.Numeric(10, 4), nullable=True),
        sa.Column("macro_score", sa.Numeric(10, 4), nullable=True),
        sa.Column("short_score", sa.Numeric(10, 4), nullable=True),
        sa.Column("mid_score", sa.Numeric(10, 4), nullable=True),
        sa.Column("long_score", sa.Numeric(10, 4), nullable=True),
        sa.Column("short_action", sa.String(length=32), nullable=True),
        sa.Column("mid_action", sa.String(length=32), nullable=True),
        sa.Column("long_action", sa.String(length=32), nullable=True),
        sa.Column("composite_action", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("scan_run_id", "symbol", name="uq_symbol_snapshots_scan_run_symbol"),
    )

    op.create_table(
        "symbol_reasons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("snapshot_id", sa.Integer(), sa.ForeignKey("symbol_snapshots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("horizon", sa.String(length=16), nullable=False),
        sa.Column("reason_order", sa.Integer(), nullable=False),
        sa.Column("reason_text", sa.Text(), nullable=False),
        sa.UniqueConstraint("snapshot_id", "horizon", "reason_order", name="uq_symbol_reasons_snapshot_horizon_order"),
    )

    op.create_table(
        "price_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("open", sa.Numeric(18, 6), nullable=True),
        sa.Column("high", sa.Numeric(18, 6), nullable=True),
        sa.Column("low", sa.Numeric(18, 6), nullable=True),
        sa.Column("close", sa.Numeric(18, 6), nullable=True),
        sa.Column("adj_close", sa.Numeric(18, 6), nullable=True),
        sa.Column("volume", sa.Integer(), nullable=True),
        sa.UniqueConstraint("symbol", "date", name="uq_price_history_symbol_date"),
    )

    op.create_table(
        "fundamental_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("market_cap", sa.Numeric(22, 2), nullable=True),
        sa.Column("pe", sa.Numeric(14, 4), nullable=True),
        sa.Column("forward_pe", sa.Numeric(14, 4), nullable=True),
        sa.Column("revenue_growth", sa.Numeric(12, 6), nullable=True),
        sa.Column("earnings_growth", sa.Numeric(12, 6), nullable=True),
        sa.Column("operating_margin", sa.Numeric(12, 6), nullable=True),
        sa.Column("debt_to_equity", sa.Numeric(14, 6), nullable=True),
        sa.Column("raw_json", sa.JSON(), nullable=True),
    )
    op.create_index("ix_fundamental_snapshots_symbol", "fundamental_snapshots", ["symbol"])

    op.create_table(
        "news_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=128), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.UniqueConstraint("fingerprint", name="uq_news_items_fingerprint"),
    )
    op.create_index("ix_news_items_symbol", "news_items", ["symbol"])


def downgrade() -> None:
    op.drop_index("ix_news_items_symbol", table_name="news_items")
    op.drop_table("news_items")
    op.drop_index("ix_fundamental_snapshots_symbol", table_name="fundamental_snapshots")
    op.drop_table("fundamental_snapshots")
    op.drop_table("price_history")
    op.drop_table("symbol_reasons")
    op.drop_table("symbol_snapshots")
    op.drop_table("scan_runs")
