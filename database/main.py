from __future__ import annotations

from fastapi import APIRouter, FastAPI

from .routes import health, scans, symbols

app = FastAPI(
    title="Market Alpha Scanner API",
    description="A read-only API for the Market Alpha Scanner database.",
    version="0.1.0",
)

api_router = APIRouter(prefix="/api")
api_router.include_router(scans.router)
api_router.include_router(symbols.router)

app.include_router(health.router)
app.include_router(api_router)

@app.get("/", include_in_schema=False)
def read_root():
    return {"message": "Welcome to the Market Alpha Scanner API. See /docs for interactive documentation."}
