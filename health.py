from fastapi import APIRouter

import schemas

router = APIRouter()


@router.get("/health", response_model=schemas.Health)
def health_check():
    return {"status": "ok"}
