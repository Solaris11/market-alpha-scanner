from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class ScanRun(Base):
    __tablename__ = "scan_runs"
    id = Column(Integer, primary_key=True)
    timestamp_utc = Column(DateTime(timezone=True), server_default=func.now())
    scanner_version = Column(String)
    notes = Column(Text)
    symbol_snapshots = relationship("SymbolSnapshot", back_populates="scan_run")


class SymbolSnapshot(Base):
    __tablename__ = "symbol_snapshots"
    id = Column(Integer, primary_key=True)
    scan_run_id = Column(Integer, ForeignKey("scan_runs.id"), nullable=False)
    symbol = Column(String, nullable=False, index=True)
    timestamp_utc = Column(DateTime(timezone=True), nullable=False)
    price = Column(Float)
    market_cap = Column(BigInteger)  # CORRECTED: Was Integer
    avg_dollar_volume = Column(BigInteger)  # CORRECTED: Was Integer
    asset_type = Column(String)
    sector = Column(String)
    rating = Column(String)
    final_score = Column(Float)
    scan_run = relationship("ScanRun", back_populates="symbol_snapshots")
    __table_args__ = (UniqueConstraint("scan_run_id", "symbol", name="uq_scan_run_symbol"),)


class PriceHistory(Base):
    __tablename__ = "price_history"
    id = Column(Integer, primary_key=True)
    symbol = Column(String, nullable=False, index=True)
    date = Column(DateTime(timezone=True), nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(BigInteger)  # CORRECTED: Was Integer
    __table_args__ = (UniqueConstraint("symbol", "date", name="uq_symbol_date"),)


class FundamentalSnapshot(Base):
    __tablename__ = "fundamental_snapshots"
    id = Column(Integer, primary_key=True)
    symbol_snapshot_id = Column(Integer, ForeignKey("symbol_snapshots.id"), nullable=False, unique=True)
    market_cap = Column(BigInteger)  # CORRECTED: Was Integer
