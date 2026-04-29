from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import delete, select

from database.config import get_database_url
from database.models import PaperAccount, PaperPosition, PaperTradeEvent
from database.session import session_scope


DEFAULT_ACCOUNT_NAME = "default"
DEFAULT_STARTING_BALANCE = Decimal("10000")
ZERO = Decimal("0")


@dataclass(frozen=True)
class PaperResetResult:
    skipped: bool
    reason: str | None = None


def _format_decimal(value: Decimal) -> str:
    normalized = value.normalize()
    return format(normalized, "f")


def reset_paper_account(starting_balance: Decimal = DEFAULT_STARTING_BALANCE) -> PaperResetResult:
    database_url = get_database_url(required=False)
    if not database_url:
        print("[paper] reset skipped: DATABASE_URL not configured")
        return PaperResetResult(skipped=True, reason="DATABASE_URL not configured")

    if starting_balance <= ZERO:
        print("[paper] reset failed safely: starting balance must be greater than zero")
        return PaperResetResult(skipped=True, reason="starting balance must be greater than zero")

    try:
        with session_scope() as session:
            session.execute(delete(PaperTradeEvent))
            session.execute(delete(PaperPosition))
            account = session.scalar(select(PaperAccount).where(PaperAccount.name == DEFAULT_ACCOUNT_NAME))
            now = datetime.now(timezone.utc)
            if account is None:
                account = PaperAccount(
                    name=DEFAULT_ACCOUNT_NAME,
                    starting_balance=starting_balance,
                    cash_balance=starting_balance,
                    equity_value=ZERO,
                    realized_pnl=ZERO,
                    enabled=True,
                    max_position_pct=Decimal("0.10"),
                    risk_per_trade_pct=Decimal("0.01"),
                    max_open_positions=5,
                    updated_at=now,
                )
                session.add(account)
            else:
                account.starting_balance = starting_balance
                account.cash_balance = starting_balance
                account.equity_value = ZERO
                account.realized_pnl = ZERO
                account.enabled = True
                account.max_position_pct = Decimal("0.10")
                account.risk_per_trade_pct = Decimal("0.01")
                account.max_open_positions = 5
                account.updated_at = now
        print(f"[paper] reset complete: account=default cash={_format_decimal(starting_balance)}")
        return PaperResetResult(skipped=False)
    except Exception as exc:
        print(f"[paper] reset failed safely: {exc}")
        return PaperResetResult(skipped=True, reason=str(exc))
