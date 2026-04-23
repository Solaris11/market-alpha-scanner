from fastapi import APIRouter

from api import schemas

router = APIRouter()


@router.get("/health", response_model=schemas.Health)
def health_check():
    """
    Health check endpoint.
    """
    return {"status": "ok"}
