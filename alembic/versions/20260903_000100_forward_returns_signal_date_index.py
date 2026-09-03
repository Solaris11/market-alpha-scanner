"""Index forward_returns for the signal-date ordering /terminal reads

Revision ID: 20260903_000100
Revises: 20260503_001200
Create Date: 2026-09-03 00:01:00

getPerformanceData asks for the newest 1200 forward returns, ordered by
signal_date DESC NULLS LAST, created_at DESC, symbol, horizon. Measured on
production, that ordering has no usable index: the planner runs a parallel
sequential scan over all 818,013 matching rows and a top-N sort, 1154ms and
102,462 buffers, to return 1200.

This index covers exactly that ORDER BY, restricted by the same predicate the
query uses, so the LIMIT can be satisfied by walking it. It is created
CONCURRENTLY -- it does not lock writes -- and it is a pure read optimisation:
dropping it restores the previous plan and changes no result.

The existing idx_forward_returns_horizon_signal_date leads with `horizon`, so it
cannot serve this ordering. pg_stat_user_indexes reports idx_scan = 0 for it --
it has never been used since stats were last reset -- but it is left in place
here. Removing an index is a separate decision from adding one, and it should be
made against its own evidence rather than folded into a performance fix.
"""

from __future__ import annotations

from alembic import op


revision = "20260903_000100"
down_revision = "20260503_001200"
branch_labels = None
depends_on = None

# CONCURRENTLY cannot run inside a transaction block, which is what Alembic
# gives us by default.
def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forward_returns_signal_date_desc
            ON forward_returns (signal_date DESC NULLS LAST, created_at DESC, symbol, horizon)
            WHERE return_pct IS NOT NULL
            """
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_forward_returns_signal_date_desc")
