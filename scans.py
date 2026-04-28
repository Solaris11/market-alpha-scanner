from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

import deps
import schemas
from database import models

router = APIRouter()


@router.get("/scans", response_model=list[schemas.ScanRunListItem])
def read_scans(db: Session = Depends(deps.get_db), skip: int = 0, limit: int = 100):
    """Retrieve recent scan runs."""
    scans = db.query(models.ScanRun).order_by(desc(models.ScanRun.completed_at)).offset(skip).limit(limit).all()
    return scans


@router.get("/scans/latest", response_model=schemas.ScanRunSummary)
def read_latest_scan(db: Session = Depends(deps.get_db)):
    """Retrieve the latest completed scan run."""
    scan = db.query(models.ScanRun).order_by(desc(models.ScanRun.completed_at)).first()
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.get("/scans/latest/symbols", response_model=list[schemas.RankedSymbol])
def read_latest_scan_symbols(db: Session = Depends(deps.get_db), limit: int = 50):
    """Retrieve ranked symbols from the latest scan."""
    latest_scan = db.query(models.ScanRun).order_by(desc(models.ScanRun.completed_at)).first()
    if not latest_scan:
        raise HTTPException(status_code=404, detail="No scan runs found.")

    symbols = (
        db.query(models.ScannerSignal)
        .filter(models.ScannerSignal.scan_run_id == latest_scan.id)
        .order_by(desc(models.ScannerSignal.final_score_adjusted), desc(models.ScannerSignal.final_score))
        .limit(limit)
        .all()
    )
    return symbols
