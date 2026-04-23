from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session, joinedload

from database import models

from .. import schemas
from ..deps import get_db

router = APIRouter(prefix="/symbols", tags=["Symbols"])


@router.get("/{symbol}", response_model=schemas.SymbolDetail)
def get_symbol_details(symbol: str, db: Session = Depends(get_db)):
    """Get detailed information for a specific symbol from the latest scan."""
    symbol_upper = symbol.upper()

    latest_snapshot = (
        db.query(models.SymbolSnapshot)
        .join(models.ScanRun)
        .filter(models.SymbolSnapshot.symbol == symbol_upper)
        .order_by(desc(models.ScanRun.completed_at))
        .options(joinedload(models.SymbolSnapshot.reasons))
        .first()
    )

    if not latest_snapshot:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol_upper}' not found in any scan.")

    latest_fundamentals = (
        db.query(models.FundamentalSnapshot)
        .filter(models.FundamentalSnapshot.symbol == symbol_upper)
        .order_by(desc(models.FundamentalSnapshot.captured_at))
        .first()
    )

    response_data = schemas.SymbolDetail.model_validate(latest_snapshot)
    if latest_fundamentals:
        response_data.fundamentals = schemas.SymbolFundamentals.model_validate(latest_fundamentals)

    # Group reasons by horizon for a cleaner frontend presentation
    if latest_snapshot.reasons:
        grouped_reasons = {}
        sorted_reasons = sorted(latest_snapshot.reasons, key=lambda r: r.reason_order)
        for reason in sorted_reasons:
            if reason.horizon not in grouped_reasons:
                grouped_reasons[reason.horizon] = []
            grouped_reasons[reason.horizon].append(reason.reason_text)
        response_data.reasons = grouped_reasons

    return response_data


@router.get("/{symbol}/history", response_model=list[schemas.PriceHistoryItem])
def get_symbol_price_history(symbol: str, limit: int = Query(365, ge=1, le=1000), db: Session = Depends(get_db)):
    """Get historical price data for a symbol, ordered oldest to newest."""
    symbol_upper = symbol.upper()
    # Efficiently get the N most recent items, then sort them ascending.
    subquery = (
        db.query(models.PriceHistory.id)
        .filter(models.PriceHistory.symbol == symbol_upper)
        .order_by(desc(models.PriceHistory.date))
        .limit(limit)
        .subquery()
    )
    history = (
        db.query(models.PriceHistory)
        .join(subquery, models.PriceHistory.id == subquery.c.id)
        .order_by(asc(models.PriceHistory.date))
        .all()
    )
    return history


@router.get("/{symbol}/news", response_model=list[schemas.NewsItem])
def get_symbol_news(symbol: str, limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    """Get recent news items for a symbol."""
    symbol_upper = symbol.upper()
    news_items = (
        db.query(models.NewsItem)
        .filter(models.NewsItem.symbol == symbol_upper)
        .order_by(desc(models.NewsItem.published_at))
        .limit(limit)
        .all()
    )
    return news_items
