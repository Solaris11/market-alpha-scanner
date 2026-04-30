"""Add production auth profile tables

Revision ID: 20260430_061000
Revises: 20260430_045100
Create Date: 2026-04-30 06:10:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260430_061000"
down_revision = "20260430_045100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'active'")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_experience_level TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false")

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    op.create_index("ix_password_reset_tokens_expires_at", "password_reset_tokens", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_password_reset_tokens_expires_at", table_name="password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_user_id", table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS onboarding_completed")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS risk_experience_level")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS timezone")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS profile_image_url")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS state")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_login_ip")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_login_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS password_hash")
