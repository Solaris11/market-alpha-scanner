from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, Text, UniqueConstraint, Uuid, func, text
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
        UniqueConstraint("scan_run_id", "symbol", name="uq_scanner_signals_scan_run_symbol"),
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


class PaperAccount(Base):
    __tablename__ = "paper_accounts"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    starting_balance: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    cash_balance: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    equity_value: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=Decimal("0"), server_default=text("0"))
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=Decimal("0"), server_default=text("0"))
    max_position_pct: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=Decimal("0.10"), server_default=text("0.10"))
    risk_per_trade_pct: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=Decimal("0.01"), server_default=text("0.01"))
    max_open_positions: Mapped[int] = mapped_column(Integer, nullable=False, default=5, server_default=text("5"))
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    positions: Mapped[list["PaperPosition"]] = relationship(back_populates="account", cascade="all, delete-orphan")
    events: Mapped[list["PaperTradeEvent"]] = relationship(back_populates="account", cascade="all, delete-orphan")


class PaperPosition(Base):
    __tablename__ = "paper_positions"
    __table_args__ = (
        Index("ix_paper_positions_account_id", "account_id"),
        Index("ix_paper_positions_symbol", "symbol"),
        Index("ix_paper_positions_status", "status"),
        Index("ix_paper_positions_opened_at", "opened_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    account_id: Mapped[UUID] = mapped_column(ForeignKey("paper_accounts.id", ondelete="CASCADE"), nullable=False)
    symbol: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="OPEN", server_default=text("'OPEN'"))
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    entry_price: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    exit_price: Mapped[Decimal | None] = mapped_column(Numeric)
    quantity: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    stop_loss: Mapped[Decimal | None] = mapped_column(Numeric)
    target_price: Mapped[Decimal | None] = mapped_column(Numeric)
    final_decision: Mapped[str | None] = mapped_column(Text)
    recommendation_quality: Mapped[str | None] = mapped_column(Text)
    entry_status: Mapped[str | None] = mapped_column(Text)
    setup_type: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[str | None] = mapped_column(Text)
    realized_pnl: Mapped[Decimal | None] = mapped_column(Numeric, default=Decimal("0"), server_default=text("0"))
    unrealized_pnl: Mapped[Decimal | None] = mapped_column(Numeric)
    return_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    close_reason: Mapped[str | None] = mapped_column(Text)
    source_scan_run_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True))
    source_signal_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    account: Mapped[PaperAccount] = relationship(back_populates="positions")
    events: Mapped[list["PaperTradeEvent"]] = relationship(back_populates="position")


class PaperTradeEvent(Base):
    __tablename__ = "paper_trade_events"
    __table_args__ = (
        Index("ix_paper_trade_events_account_id", "account_id"),
        Index("ix_paper_trade_events_symbol", "symbol"),
        Index("ix_paper_trade_events_created_at", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    account_id: Mapped[UUID] = mapped_column(ForeignKey("paper_accounts.id", ondelete="CASCADE"), nullable=False)
    position_id: Mapped[UUID | None] = mapped_column(ForeignKey("paper_positions.id", ondelete="SET NULL"))
    symbol: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    event_reason: Mapped[str | None] = mapped_column(Text)
    price: Mapped[Decimal | None] = mapped_column(Numeric)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric)
    cash_delta: Mapped[Decimal | None] = mapped_column(Numeric)
    pnl_delta: Mapped[Decimal | None] = mapped_column(Numeric)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    account: Mapped[PaperAccount] = relationship(back_populates="events")
    position: Mapped[PaperPosition | None] = relationship(back_populates="events")
