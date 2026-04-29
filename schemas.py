from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class Health(BaseModel):
    status: str


class ScanRunListItem(BaseModel):
    id: UUID
    started_at: datetime
    completed_at: datetime | None
    universe_count: int | None
    symbols_scored: int | None
    market_regime: str | None
    breadth: str | None
    leadership: str | None

    model_config = ConfigDict(from_attributes=True)


class ScanRunSummary(ScanRunListItem):
    created_at: datetime


class RankedSymbol(BaseModel):
    symbol: str
    company_name: str | None
    asset_type: str | None
    sector: str | None
    price: Decimal | None
    final_score: Decimal | None
    final_score_adjusted: Decimal | None
    rating: str | None
    action: str | None
    final_decision: str | None
    recommendation_quality: str | None

    model_config = ConfigDict(from_attributes=True)


class ScannerSignal(RankedSymbol):
    id: UUID
    scan_run_id: UUID
    setup_type: str | None
    entry_status: str | None
    quality_score: Decimal | None
    suggested_entry: str | None
    entry_distance_pct: Decimal | None
    buy_zone: str | None
    stop_loss: Decimal | None
    conservative_target: Decimal | None
    risk_reward: Decimal | None
    market_regime: str | None
    created_at: datetime


class NewsItem(BaseModel):
    published_at: datetime | None
    source: str | None
    title: str
    url: str | None
    summary: str | None

    model_config = ConfigDict(from_attributes=True)


class PaperAccountSummary(BaseModel):
    id: UUID
    name: str
    cash_balance: Decimal
    equity_value: Decimal
    realized_pnl: Decimal
    open_positions_count: int
    total_account_value: Decimal

    model_config = ConfigDict(from_attributes=True)


class PaperPositionItem(BaseModel):
    id: UUID
    symbol: str
    status: str
    opened_at: datetime
    closed_at: datetime | None
    entry_price: Decimal
    current_price: Decimal | None
    quantity: Decimal
    stop_loss: Decimal | None
    target_price: Decimal | None
    unrealized_pnl: Decimal | None
    final_decision: str | None
    recommendation_quality: str | None
    entry_status: str | None
    setup_type: str | None
    rating: str | None
    realized_pnl: Decimal | None
    return_pct: Decimal | None
    close_reason: str | None


class PaperTradeEventItem(BaseModel):
    id: UUID
    symbol: str
    event_type: str
    event_reason: str | None
    price: Decimal | None
    quantity: Decimal | None
    cash_delta: Decimal | None
    pnl_delta: Decimal | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
