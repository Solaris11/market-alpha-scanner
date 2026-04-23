from __future__ import annotations

from fastapi import APIRouter

from .. import schemas

router = APIRouter()

@router.get("/health", response_model=schemas.HealthResponse, tags=["Health"])
def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}
