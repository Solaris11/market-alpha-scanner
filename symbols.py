from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api import deps, schemas
from database import models

router = APIRouter()


@router.get("/symbols/{symbol}", response_model=schemas.Symbol)
def read_symbol(symbol: str, db: Session = Depends(deps.get_db)):
    """
    Retrieve a specific symbol by its ticker.
    """
    db_symbol = db.query(models.Symbol).filter(models.Symbol.symbol == symbol.upper()).first()
    if db_symbol is None:
        raise HTTPException(status_code=404, detail="Symbol not found")
    return db_symbol


@router.get("/symbols/{symbol}/history", response_model=list[schemas.Price])
def read_symbol_history(symbol: str, db: Session = Depends(deps.get_db)):
    """
    Retrieve price history for a symbol.
    """
    db_symbol = db.query(models.Symbol).filter(models.Symbol.symbol == symbol.upper()).first()
    if db_symbol is None:
        raise HTTPException(status_code=404, detail="Symbol not found")
    return db_symbol.prices


@router.get("/symbols/{symbol}/news", response_model=list[schemas.News])
def read_symbol_news(symbol: str, db: Session = Depends(deps.get_db)):
    """
    Retrieve news for a symbol.
    """
    db_symbol = db.query(models.Symbol).filter(models.Symbol.symbol == symbol.upper()).first()
    if db_symbol is None:
        raise HTTPException(status_code=404, detail="Symbol not found")
    return db_symbol.news
