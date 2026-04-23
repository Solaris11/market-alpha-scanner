"""use bigint for large numbers

Revision ID: abc123def456
Revises: <PREVIOUS_REVISION_ID>
Create Date: 2023-10-27 18:00:00.000000

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "abc123def456"
down_revision = "<PREVIOUS_REVISION_ID>"  # NOTE: Replace with the actual previous revision ID
branch_labels = None
depends_on = None


def upgrade() -> None:
    print("Altering integer columns to bigint for large numeric values...")
    op.alter_column(
        "price_history", "volume", existing_type=sa.INTEGER(), type_=sa.BigInteger(), existing_nullable=True
    )
    op.alter_column(
        "fundamental_snapshots", "market_cap", existing_type=sa.INTEGER(), type_=sa.BigInteger(), existing_nullable=True
    )
    op.alter_column(
        "symbol_snapshots", "market_cap", existing_type=sa.INTEGER(), type_=sa.BigInteger(), existing_nullable=True
    )
    op.alter_column(
        "symbol_snapshots",
        "avg_dollar_volume",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_nullable=True,
    )
    print("Finished altering columns.")


def downgrade() -> None:
    print("Reverting bigint columns back to integer...")
    op.alter_column(
        "symbol_snapshots",
        "avg_dollar_volume",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_nullable=True,
    )
    op.alter_column(
        "symbol_snapshots", "market_cap", existing_type=sa.BigInteger(), type_=sa.INTEGER(), existing_nullable=True
    )
    op.alter_column(
        "fundamental_snapshots", "market_cap", existing_type=sa.BigInteger(), type_=sa.INTEGER(), existing_nullable=True
    )
    op.alter_column(
        "price_history", "volume", existing_type=sa.BigInteger(), type_=sa.INTEGER(), existing_nullable=True
    )
    print("Finished reverting columns.")
