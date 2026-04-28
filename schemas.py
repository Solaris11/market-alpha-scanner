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
