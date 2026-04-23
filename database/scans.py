from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import models

from .. import schemas
from ..deps import get_db

router = APIRouter(prefix="/scans", tags=["Scans"])


@router.get("/latest", response_model=schemas.ScanRunSummary)
def get_latest_scan(db: Session = Depends(get_db)):
    """Get a summary of the most recent completed scan run."""
    latest_scan = db.query(models.ScanRun).order_by(desc(models.ScanRun.completed_at)).first()
    if not latest_scan:
        raise HTTPException(status_code=404, detail="No scan runs found.")
    return latest_scan


@router.get("", response_model=list[schemas.ScanRunListItem])
def get_scan_history(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    """Get a list of recent scan runs."""
    scans = db.query(models.ScanRun).order_by(desc(models.ScanRun.completed_at)).limit(limit).all()
    return scans


@router.get("/latest/symbols", response_model=list[schemas.RankedSymbol])
def get_latest_ranked_symbols(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    """Get ranked symbols from the latest completed scan."""
    latest_scan = db.query(models.ScanRun).order_by(desc(models.ScanRun.completed_at)).first()
    if not latest_scan:
        raise HTTPException(status_code=404, detail="No scan runs found.")

    # Assuming higher long_score is better for ranking
    symbols = (
        db.query(models.SymbolSnapshot)
        .filter(models.SymbolSnapshot.scan_run_id == latest_scan.id)
        .order_by(desc(models.SymbolSnapshot.long_score))
        .limit(limit)
        .all()
    )
    return symbols
