from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

import deps
import schemas
from database import models


router = APIRouter()
ZERO = Decimal("0")


@router.get("/paper/account", response_model=schemas.PaperAccountSummary)
def read_paper_account(db: Session = Depends(deps.get_db)) -> dict[str, object]:
    account = _default_account(db)
    open_count = _open_positions_count(db, account)
    unrealized_pnl = _open_unrealized_pnl(db, account)
    total_account_value = account.cash_balance + account.equity_value
    return {
        "id": account.id,
        "name": account.name,
        "cash_balance": account.cash_balance,
        "equity_value": account.equity_value,
        "realized_pnl": account.realized_pnl,
        "unrealized_pnl": unrealized_pnl,
        "total_pnl": account.realized_pnl + unrealized_pnl,
        "open_positions_count": open_count,
        "total_account_value": total_account_value,
    }


@router.get("/paper/positions", response_model=list[schemas.PaperPositionItem])
def read_paper_positions(db: Session = Depends(deps.get_db), limit: int = 100) -> list[dict[str, object]]:
    account = _default_account(db)
    positions = list(
        db.scalars(
            select(models.PaperPosition)
            .where(models.PaperPosition.account_id == account.id)
            .order_by(desc(models.PaperPosition.status == "OPEN"), desc(models.PaperPosition.opened_at))
            .limit(limit)
        ).all()
    )
    latest_prices = _latest_prices(db)
    rows: list[dict[str, object]] = []
    for position in positions:
        current_price = latest_prices.get(position.symbol.upper())
        display_price = current_price if position.status == "OPEN" else position.exit_price
        unrealized_pnl = position.unrealized_pnl
        if position.status == "OPEN" and current_price is not None:
            unrealized_pnl = (current_price - position.entry_price) * position.quantity
        rows.append(
            {
                "id": position.id,
                "symbol": position.symbol,
                "status": position.status,
                "opened_at": position.opened_at,
                "closed_at": position.closed_at,
                "entry_price": position.entry_price,
                "exit_price": position.exit_price,
                "current_price": display_price,
                "quantity": position.quantity,
                "stop_loss": position.stop_loss,
                "target_price": position.target_price,
                "unrealized_pnl": unrealized_pnl,
                "final_decision": position.final_decision,
                "recommendation_quality": position.recommendation_quality,
                "entry_status": position.entry_status,
                "setup_type": position.setup_type,
                "rating": position.rating,
                "realized_pnl": position.realized_pnl,
                "return_pct": position.return_pct,
                "close_reason": position.close_reason,
            }
        )
    return rows


@router.get("/paper/events", response_model=list[schemas.PaperTradeEventItem])
def read_paper_events(db: Session = Depends(deps.get_db), limit: int = 100) -> list[models.PaperTradeEvent]:
    account = _default_account(db)
    return list(
        db.scalars(
            select(models.PaperTradeEvent)
            .where(models.PaperTradeEvent.account_id == account.id)
            .order_by(desc(models.PaperTradeEvent.created_at))
            .limit(limit)
        ).all()
    )


def _default_account(db: Session) -> models.PaperAccount:
    account = db.scalar(select(models.PaperAccount).where(models.PaperAccount.name == "default"))
    if account is None:
        raise HTTPException(status_code=404, detail="Paper account not found")
    return account


def _open_positions_count(db: Session, account: models.PaperAccount) -> int:
    return len(
        list(
            db.scalars(
                select(models.PaperPosition.id).where(
                    models.PaperPosition.account_id == account.id,
                    models.PaperPosition.status == "OPEN",
                )
            ).all()
        )
    )


def _open_unrealized_pnl(db: Session, account: models.PaperAccount) -> Decimal:
    positions = db.scalars(
        select(models.PaperPosition).where(
            models.PaperPosition.account_id == account.id,
            models.PaperPosition.status == "OPEN",
        )
    ).all()
    total = ZERO
    for position in positions:
        total += position.unrealized_pnl or ZERO
    return total


def _latest_prices(db: Session) -> dict[str, Decimal]:
    latest_run = db.scalar(select(models.ScanRun).order_by(desc(models.ScanRun.completed_at), desc(models.ScanRun.created_at)).limit(1))
    if latest_run is None:
        return {}
    signals = db.scalars(select(models.ScannerSignal).where(models.ScannerSignal.scan_run_id == latest_run.id)).all()
    prices: dict[str, Decimal] = {}
    for signal in signals:
        if signal.price is not None:
            prices[signal.symbol.upper()] = signal.price
    return prices
