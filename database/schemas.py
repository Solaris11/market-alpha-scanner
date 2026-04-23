from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# Health
class HealthResponse(BaseModel):
    status: str = "ok"


# Scans
class ScanRunSummary(OrmBase):
    id: int
    started_at: datetime
    completed_at: datetime | None
    universe_size: int | None
    scanned_count: int | None
    ranked_count: int | None
    scanner_version: str | None


class ScanRunListItem(OrmBase):
    id: int
    completed_at: datetime | None
    universe_size: int | None
    scanned_count: int | None
    ranked_count: int | None


# Symbols
class RankedSymbol(OrmBase):
    symbol: str
    asset_type: str | None
    price: Decimal | None
    short_score: Decimal | None
    mid_score: Decimal | None
    long_score: Decimal | None
    short_action: str | None
    mid_action: str | None
    long_action: str | None
    composite_action: str | None


class SymbolFundamentals(OrmBase):
    captured_at: datetime
    market_cap: Decimal | None
    pe: Decimal | None
    forward_pe: Decimal | None
    revenue_growth: Decimal | None
    earnings_growth: Decimal | None
    operating_margin: Decimal | None
    debt_to_equity: Decimal | None


class SymbolDetail(RankedSymbol):
    reasons: dict[str, list[str]] = Field(default_factory=dict)
    fundamentals: SymbolFundamentals | None = None


class PriceHistoryItem(OrmBase):
    date: date
    open: Decimal | None
    high: Decimal | None
    low: Decimal | None
    close: Decimal | None
    adj_close: Decimal | None
    volume: int | None


class NewsItem(OrmBase):
    published_at: datetime | None
    source: str | None
    title: str
    url: str | None
    summary: str | None
