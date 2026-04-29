from fastapi import FastAPI

import health
import paper
import scans
import symbols

app = FastAPI(title="Market Alpha Scanner API")

app.include_router(health.router)
app.include_router(paper.router, prefix="/api", tags=["Paper"])
app.include_router(scans.router, prefix="/api", tags=["Scans"])
app.include_router(symbols.router, prefix="/api", tags=["Symbols"])
