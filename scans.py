from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api import deps, schemas
from database import models

router = APIRouter()


@router.get("/scans", response_model=list[schemas.Scan])
def read_scans(db: Session = Depends(deps.get_db), skip: int = 0, limit: int = 100):
    """
    Retrieve all scans.
    """
    scans = db.query(models.Scan).order_by(models.Scan.scan_timestamp.desc()).offset(skip).limit(limit).all()
    return scans


@router.get("/scans/latest", response_model=schemas.Scan)
def read_latest_scan(db: Session = Depends(deps.get_db)):
    """
    Retrieve the latest scan.
    """
    scan = db.query(models.Scan).order_by(models.Scan.scan_timestamp.desc()).first()
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.get("/scans/latest/symbols", response_model=list[schemas.Symbol])
def read_latest_scan_symbols(db: Session = Depends(deps.get_db)):
    """
    Retrieve symbols from the latest scan.
    """
    scan = db.query(models.Scan).order_by(models.Scan.scan_timestamp.desc()).first()
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan.symbols
