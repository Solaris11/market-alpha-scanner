from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from .base import Base


class ScanRun(Base):
    __tablename__ = "scan_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    universe_size: Mapped[int | None] = mapped_column(Integer)
    scanned_count: Mapped[int | None] = mapped_column(Integer)
    ranked_count: Mapped[int | None] = mapped_column(Integer)
    scanner_version: Mapped[str | None] = mapped_column(String(64))
    notes: Mapped[str | None] = mapped_column(Text)

    symbol_snapshots: Mapped[list["SymbolSnapshot"]] = relationship(back_populates="scan_run", cascade="all, delete-orphan")


class SymbolSnapshot(Base):
    __tablename__ = "symbol_snapshots"
    __table_args__ = (UniqueConstraint("scan_run_id", "symbol", name="uq_symbol_snapshots_scan_run_symbol"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scan_run_id: Mapped[int] = mapped_column(ForeignKey("scan_runs.id", ondelete="CASCADE"), nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    asset_type: Mapped[str | None] = mapped_column(String(64))
    price: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    trend_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    momentum_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    breakout_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    rsi_macd_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    volume_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    fundamentals_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    risk_penalty: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    macro_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    short_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    mid_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    long_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    short_action: Mapped[str | None] = mapped_column(String(32))
    mid_action: Mapped[str | None] = mapped_column(String(32))
    long_action: Mapped[str | None] = mapped_column(String(32))
    composite_action: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    scan_run: Mapped["ScanRun"] = relationship(back_populates="symbol_snapshots")
    reasons: Mapped[list["SymbolReason"]] = relationship(back_populates="snapshot", cascade="all, delete-orphan")


class SymbolReason(Base):
    __tablename__ = "symbol_reasons"
    __table_args__ = (UniqueConstraint("snapshot_id", "horizon", "reason_order", name="uq_symbol_reasons_snapshot_horizon_order"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("symbol_snapshots.id", ondelete="CASCADE"), nullable=False)
    horizon: Mapped[str] = mapped_column(String(16), nullable=False)
    reason_order: Mapped[int] = mapped_column(Integer, nullable=False)
    reason_text: Mapped[str] = mapped_column(Text, nullable=False)

    snapshot: Mapped["SymbolSnapshot"] = relationship(back_populates="reasons")


class PriceHistory(Base):
    __tablename__ = "price_history"
    __table_args__ = (UniqueConstraint("symbol", "date", name="uq_price_history_symbol_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    open: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    high: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    low: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    close: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    adj_close: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    volume: Mapped[int | None] = mapped_column(BigInteger)


class FundamentalSnapshot(Base):
    __tablename__ = "fundamental_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    market_cap: Mapped[Decimal | None] = mapped_column(Numeric(22, 2))
    pe: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    forward_pe: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    revenue_growth: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    earnings_growth: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    operating_margin: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    debt_to_equity: Mapped[Decimal | None] = mapped_column(Numeric(14, 6))
    raw_json: Mapped[dict[str, object] | None] = mapped_column(JSON)


class NewsItem(Base):
    __tablename__ = "news_items"
    __table_args__ = (UniqueConstraint("fingerprint", name="uq_news_items_fingerprint"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source: Mapped[str | None] = mapped_column(String(128))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
