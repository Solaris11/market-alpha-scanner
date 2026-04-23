from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


# Health
class Health(BaseModel):
    status: str


# Scans
class ScanRunListItem(BaseModel):
    id: int
    completed_at: datetime | None
    universe_size: int | None
    ranked_count: int | None

    model_config = ConfigDict(from_attributes=True)


class ScanRunSummary(BaseModel):
    id: int
    completed_at: datetime | None
    universe_size: int | None
    scanned_count: int | None
    ranked_count: int | None
    scanner_version: str | None
    notes: str | None

    model_config = ConfigDict(from_attributes=True)


# Symbols
class RankedSymbol(BaseModel):
    symbol: str
    price: Decimal | None
    long_score: Decimal | None
    long_action: str | None
    composite_action: str | None

    model_config = ConfigDict(from_attributes=True)


class SymbolSnapshot(BaseModel):
    id: int
    scan_run_id: int
    symbol: str
    price: Decimal | None
    trend_score: Decimal | None
    momentum_score: Decimal | None
    breakout_score: Decimal | None
    rsi_macd_score: Decimal | None
    volume_score: Decimal | None
    fundamentals_score: Decimal | None
    risk_penalty: Decimal | None
    macro_score: Decimal | None
    short_score: Decimal | None
    mid_score: Decimal | None
    long_score: Decimal | None
    short_action: str | None
    mid_action: str | None
    long_action: str | None
    composite_action: str | None

    model_config = ConfigDict(from_attributes=True)


# History
class PriceHistory(BaseModel):
    date: date
    open: Decimal | None
    high: Decimal | None
    low: Decimal | None
    close: Decimal | None
    volume: int | None

    model_config = ConfigDict(from_attributes=True)


# News
class NewsItem(BaseModel):
    published_at: datetime | None
    source: str | None
    title: str
    url: str | None
    summary: str | None

    model_config = ConfigDict(from_attributes=True)
