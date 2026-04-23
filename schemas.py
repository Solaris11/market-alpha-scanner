from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


# Health
class Health(BaseModel):
    status: str


# Symbol
class SymbolBase(BaseModel):
    symbol: str
    name: str | None = None
    exchange: str | None = None


class Symbol(SymbolBase):
    id: int

    class Config:
        orm_mode = True


# Price
class Price(BaseModel):
    date: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int

    class Config:
        orm_mode = True


# News
class News(BaseModel):
    published_utc: datetime
    title: str
    article_url: str
    author: str | None = None

    class Config:
        orm_mode = True


# Scan
class Scan(BaseModel):
    id: int
    scan_timestamp: datetime
    symbols: list[Symbol] = []

    class Config:
        orm_mode = True
