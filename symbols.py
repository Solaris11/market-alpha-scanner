from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

import deps
import schemas
from database import models

router = APIRouter()


@router.get("/symbols/{symbol}", response_model=schemas.ScannerSignal)
def read_symbol(symbol: str, db: Session = Depends(deps.get_db)):
    """Retrieve the latest snapshot for a specific symbol."""
    db_symbol_snapshot = (
        db.query(models.ScannerSignal)
        .filter(models.ScannerSignal.symbol == symbol.upper())
        .order_by(desc(models.ScannerSignal.created_at))
        .first()
    )
    if db_symbol_snapshot is None:
        raise HTTPException(status_code=404, detail="Symbol not found in any scan")
    return db_symbol_snapshot


@router.get("/symbols/{symbol}/history", response_model=list[schemas.ScannerSignal])
def read_symbol_history(symbol: str, db: Session = Depends(deps.get_db), limit: int = 252):
    """Retrieve recent signal history for a symbol."""
    history = (
        db.query(models.ScannerSignal)
        .filter(models.ScannerSignal.symbol == symbol.upper())
        .order_by(desc(models.ScannerSignal.created_at))
        .limit(limit)
        .all()
    )
    return history


@router.get("/symbols/{symbol}/news", response_model=list[schemas.NewsItem])
def read_symbol_news(symbol: str, db: Session = Depends(deps.get_db), limit: int = 10) -> list[schemas.NewsItem]:
    """News remains file-backed for now; the DB foundation stores scanner signals only."""
    _ = (symbol, db, limit)
    return []
