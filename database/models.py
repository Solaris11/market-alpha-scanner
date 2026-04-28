from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ScanRun(Base):
    __tablename__ = "scan_runs"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    universe_count: Mapped[int | None] = mapped_column(Integer)
    symbols_scored: Mapped[int | None] = mapped_column(Integer)
    market_regime: Mapped[str | None] = mapped_column(Text)
    breadth: Mapped[str | None] = mapped_column(Text)
    leadership: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    signals: Mapped[list["ScannerSignal"]] = relationship(back_populates="scan_run", cascade="all, delete-orphan")


class ScannerSignal(Base):
    __tablename__ = "scanner_signals"
    __table_args__ = (
        Index("ix_scanner_signals_symbol", "symbol"),
        Index("ix_scanner_signals_created_at", "created_at"),
        Index("ix_scanner_signals_final_decision", "final_decision"),
        Index("ix_scanner_signals_scan_run_id", "scan_run_id"),
        Index("ix_scanner_signals_rating", "rating"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    scan_run_id: Mapped[UUID] = mapped_column(ForeignKey("scan_runs.id", ondelete="CASCADE"), nullable=False)
    symbol: Mapped[str] = mapped_column(Text, nullable=False)
    company_name: Mapped[str | None] = mapped_column(Text)
    asset_type: Mapped[str | None] = mapped_column(Text)
    sector: Mapped[str | None] = mapped_column(Text)
    price: Mapped[Decimal | None] = mapped_column(Numeric)
    final_score: Mapped[Decimal | None] = mapped_column(Numeric)
    final_score_adjusted: Mapped[Decimal | None] = mapped_column(Numeric)
    rating: Mapped[str | None] = mapped_column(Text)
    action: Mapped[str | None] = mapped_column(Text)
    setup_type: Mapped[str | None] = mapped_column(Text)
    entry_status: Mapped[str | None] = mapped_column(Text)
    recommendation_quality: Mapped[str | None] = mapped_column(Text)
    quality_score: Mapped[Decimal | None] = mapped_column(Numeric)
    final_decision: Mapped[str | None] = mapped_column(Text)
    suggested_entry: Mapped[str | None] = mapped_column(Text)
    entry_distance_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    buy_zone: Mapped[str | None] = mapped_column(Text)
    stop_loss: Mapped[Decimal | None] = mapped_column(Numeric)
    conservative_target: Mapped[Decimal | None] = mapped_column(Numeric)
    risk_reward: Mapped[Decimal | None] = mapped_column(Numeric)
    market_regime: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    scan_run: Mapped[ScanRun] = relationship(back_populates="signals")
