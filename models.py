from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

symbol_scan_association = Table(
    "symbol_scan",
    Base.metadata,
    Column("symbol_id", Integer, ForeignKey("symbols.id")),
    Column("scan_id", Integer, ForeignKey("scans.id")),
)


class Scan(Base):
    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, index=True)
    scan_timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    symbols = relationship(
        "Symbol",
        secondary=symbol_scan_association,
        back_populates="scans",
    )


class Symbol(Base):
    __tablename__ = "symbols"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True, nullable=False)
    name = Column(String)
    exchange = Column(String)

    scans = relationship(
        "Scan",
        secondary=symbol_scan_association,
        back_populates="symbols",
    )
    prices = relationship("Price", back_populates="symbol", lazy="dynamic")
    news = relationship("News", back_populates="symbol", lazy="dynamic")


class Price(Base):
    __tablename__ = "prices"

    id = Column(Integer, primary_key=True, index=True)
    symbol_id = Column(Integer, ForeignKey("symbols.id"))
    date = Column(DateTime, index=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Integer)

    symbol = relationship("Symbol", back_populates="prices")


class News(Base):
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    symbol_id = Column(Integer, ForeignKey("symbols.id"))
    published_utc = Column(DateTime)
    title = Column(String)
    article_url = Column(String, unique=True)
    author = Column(String)

    symbol = relationship("Symbol", back_populates="news")
