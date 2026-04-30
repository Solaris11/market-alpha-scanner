"""Add private beta identity and account scoped persistence

Revision ID: 20260430_045100
Revises: 20260429_010000
Create Date: 2026-04-30 04:51:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260430_045100"
down_revision = "20260429_010000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.Text(), nullable=False, unique=True),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_token", sa.Text(), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "user_watchlist",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "symbol", name="uq_user_watchlist_user_symbol"),
    )
    op.create_table(
        "user_risk_profile",
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("max_risk_per_trade_percent", sa.Numeric(), nullable=False, server_default=sa.text("2")),
        sa.Column("max_daily_loss", sa.Numeric(), nullable=True),
        sa.Column("max_sector_positions", sa.Integer(), nullable=False, server_default=sa.text("2")),
        sa.Column("allow_override", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_expires_at", "user_sessions", ["expires_at"])
    op.create_index("ix_user_watchlist_user_id", "user_watchlist", ["user_id"])

    op.execute("ALTER TABLE paper_accounts ADD COLUMN IF NOT EXISTS user_id UUID")
    op.execute("ALTER TABLE paper_positions ADD COLUMN IF NOT EXISTS user_id UUID")
    op.execute("ALTER TABLE paper_trade_events ADD COLUMN IF NOT EXISTS user_id UUID")
    op.execute("CREATE INDEX IF NOT EXISTS ix_paper_accounts_user_id ON paper_accounts(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_paper_positions_user_id ON paper_positions(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_paper_trade_events_user_id ON paper_trade_events(user_id)")
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('public.alert_rules') IS NOT NULL THEN
                ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS user_id UUID;
                CREATE INDEX IF NOT EXISTS ix_alert_rules_user_id ON alert_rules(user_id);
            END IF;
        END $$
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('public.alert_rules') IS NOT NULL THEN
                DROP INDEX IF EXISTS ix_alert_rules_user_id;
                ALTER TABLE alert_rules DROP COLUMN IF EXISTS user_id;
            END IF;
        END $$
        """
    )
    op.execute("DROP INDEX IF EXISTS ix_paper_trade_events_user_id")
    op.execute("DROP INDEX IF EXISTS ix_paper_positions_user_id")
    op.execute("DROP INDEX IF EXISTS ix_paper_accounts_user_id")
    op.execute("ALTER TABLE paper_trade_events DROP COLUMN IF EXISTS user_id")
    op.execute("ALTER TABLE paper_positions DROP COLUMN IF EXISTS user_id")
    op.execute("ALTER TABLE paper_accounts DROP COLUMN IF EXISTS user_id")
    op.drop_index("ix_user_watchlist_user_id", table_name="user_watchlist")
    op.drop_index("ix_user_sessions_expires_at", table_name="user_sessions")
    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_table("user_risk_profile")
    op.drop_table("user_watchlist")
    op.drop_table("user_sessions")
    op.drop_table("users")
