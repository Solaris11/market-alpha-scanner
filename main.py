from fastapi import FastAPI

from api.routes import health, scans, symbols

app = FastAPI(title="Market Alpha Scanner API")

app.include_router(health.router)
app.include_router(scans.router, prefix="/api", tags=["Scans"])
app.include_router(symbols.router, prefix="/api", tags=["Symbols"])
