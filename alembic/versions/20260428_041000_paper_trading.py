"""Add paper trading tables

Revision ID: 20260428_041000
Revises: a1b2c3d4e5f6
Create Date: 2026-04-28 04:10:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260428_041000"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.create_table(
        "paper_accounts",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text(), nullable=False, unique=True),
        sa.Column("starting_balance", sa.Numeric(), nullable=False),
        sa.Column("cash_balance", sa.Numeric(), nullable=False),
        sa.Column("equity_value", sa.Numeric(), nullable=False, server_default=sa.text("0")),
        sa.Column("realized_pnl", sa.Numeric(), nullable=False, server_default=sa.text("0")),
        sa.Column("max_position_pct", sa.Numeric(), nullable=False, server_default=sa.text("0.10")),
        sa.Column("risk_per_trade_pct", sa.Numeric(), nullable=False, server_default=sa.text("0.01")),
        sa.Column("max_open_positions", sa.Integer(), nullable=False, server_default=sa.text("5")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "paper_positions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", sa.Uuid(as_uuid=True), sa.ForeignKey("paper_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'OPEN'")),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("entry_price", sa.Numeric(), nullable=False),
        sa.Column("quantity", sa.Numeric(), nullable=False),
        sa.Column("stop_loss", sa.Numeric(), nullable=True),
        sa.Column("target_price", sa.Numeric(), nullable=True),
        sa.Column("final_decision", sa.Text(), nullable=True),
        sa.Column("recommendation_quality", sa.Text(), nullable=True),
        sa.Column("entry_status", sa.Text(), nullable=True),
        sa.Column("setup_type", sa.Text(), nullable=True),
        sa.Column("rating", sa.Text(), nullable=True),
        sa.Column("realized_pnl", sa.Numeric(), server_default=sa.text("0")),
        sa.Column("return_pct", sa.Numeric(), nullable=True),
        sa.Column("close_reason", sa.Text(), nullable=True),
        sa.Column("source_scan_run_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("source_signal_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_paper_positions_account_id", "paper_positions", ["account_id"])
    op.create_index("ix_paper_positions_symbol", "paper_positions", ["symbol"])
    op.create_index("ix_paper_positions_status", "paper_positions", ["status"])
    op.create_index("ix_paper_positions_opened_at", "paper_positions", ["opened_at"])
    op.create_table(
        "paper_trade_events",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", sa.Uuid(as_uuid=True), sa.ForeignKey("paper_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position_id", sa.Uuid(as_uuid=True), sa.ForeignKey("paper_positions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("event_reason", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(), nullable=True),
        sa.Column("quantity", sa.Numeric(), nullable=True),
        sa.Column("cash_delta", sa.Numeric(), nullable=True),
        sa.Column("pnl_delta", sa.Numeric(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_paper_trade_events_account_id", "paper_trade_events", ["account_id"])
    op.create_index("ix_paper_trade_events_symbol", "paper_trade_events", ["symbol"])
    op.create_index("ix_paper_trade_events_created_at", "paper_trade_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_paper_trade_events_created_at", table_name="paper_trade_events")
    op.drop_index("ix_paper_trade_events_symbol", table_name="paper_trade_events")
    op.drop_index("ix_paper_trade_events_account_id", table_name="paper_trade_events")
    op.drop_table("paper_trade_events")
    op.drop_index("ix_paper_positions_opened_at", table_name="paper_positions")
    op.drop_index("ix_paper_positions_status", table_name="paper_positions")
    op.drop_index("ix_paper_positions_symbol", table_name="paper_positions")
    op.drop_index("ix_paper_positions_account_id", table_name="paper_positions")
    op.drop_table("paper_positions")
    op.drop_table("paper_accounts")
