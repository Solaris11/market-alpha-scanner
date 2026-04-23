from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from api import deps, schemas
from database import models

router = APIRouter()


@router.get("/symbols/{symbol}", response_model=schemas.SymbolSnapshot)
def read_symbol(symbol: str, db: Session = Depends(deps.get_db)):
    """Retrieve the latest snapshot for a specific symbol."""
    db_symbol_snapshot = (
        db.query(models.SymbolSnapshot)
        .filter(models.SymbolSnapshot.symbol == symbol.upper())
        .order_by(desc(models.SymbolSnapshot.scan_run_id))
        .first()
    )
    if db_symbol_snapshot is None:
        raise HTTPException(status_code=404, detail="Symbol not found in any scan")
    return db_symbol_snapshot


@router.get("/symbols/{symbol}/history", response_model=list[schemas.PriceHistory])
def read_symbol_history(symbol: str, db: Session = Depends(deps.get_db), limit: int = 252):
    """Retrieve price history for a symbol."""
    history = db.query(models.PriceHistory).filter(models.PriceHistory.symbol == symbol.upper()).order_by(desc(models.PriceHistory.date)).limit(limit).all()
    return history


@router.get("/symbols/{symbol}/news", response_model=list[schemas.NewsItem])
def read_symbol_news(symbol: str, db: Session = Depends(deps.get_db), limit: int = 10):
    """Retrieve recent news for a symbol."""
    news = (
        db.query(models.NewsItem).filter(models.NewsItem.symbol == symbol.upper()).order_by(desc(models.NewsItem.published_at)).limit(limit).all()
    )
    return news
