from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import yfinance as yf


PERIOD_CONFIG = {
    "1d": {"period": "1d", "interval": "5m"},
    "1wk": {"period": "5d", "interval": "1h"},
    "1mo": {"period": "1mo", "interval": "1d"},
    "6mo": {"period": "6mo", "interval": "1d"},
    "ytd": {"period": "ytd", "interval": "1d"},
    "1y": {"period": "1y", "interval": "1d"},
    "5y": {"period": "5y", "interval": "1wk"},
    "max": {"period": "max", "interval": "1mo"},
}


def jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    if hasattr(value, "item"):
        return value.item()
    return value


def fetch_history(symbol: str, period: str) -> dict[str, Any]:
    cleaned_symbol = symbol.strip().upper()
    config = PERIOD_CONFIG.get(period)
    if not cleaned_symbol:
        return {"ok": False, "error": "Symbol is required.", "symbol": cleaned_symbol, "period": period, "rows": []}
    if config is None:
        return {"ok": False, "error": f"Unsupported period: {period}", "symbol": cleaned_symbol, "period": period, "rows": []}

    frame = yf.Ticker(cleaned_symbol).history(
        period=config["period"],
        interval=config["interval"],
        auto_adjust=False,
        actions=False,
        prepost=period == "1d",
    )
    if frame is None or frame.empty:
        return {
            "ok": False,
            "error": f"No price history returned for {cleaned_symbol} over {period}.",
            "symbol": cleaned_symbol,
            "period": period,
            "interval": config["interval"],
            "rows": [],
        }

    frame = frame.reset_index()
    rows: list[dict[str, Any]] = []
    for raw_row in frame.to_dict(orient="records"):
        date_value = raw_row.get("Datetime", raw_row.get("Date"))
        rows.append(
            {
                "date": jsonable(date_value),
                "open": jsonable(raw_row.get("Open")),
                "high": jsonable(raw_row.get("High")),
                "low": jsonable(raw_row.get("Low")),
                "close": jsonable(raw_row.get("Close")),
                "adj_close": jsonable(raw_row.get("Adj Close")),
                "volume": jsonable(raw_row.get("Volume")),
            }
        )

    return {
        "ok": True,
        "symbol": cleaned_symbol,
        "period": period,
        "interval": config["interval"],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "rows": rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch yfinance price history as JSON.")
    parser.add_argument("symbol", help="Ticker symbol")
    parser.add_argument("--period", choices=sorted(PERIOD_CONFIG), default="1y")
    args = parser.parse_args()

    try:
        print(json.dumps(fetch_history(args.symbol, args.period), default=jsonable))
        return 0
    except Exception as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": str(exc),
                    "symbol": args.symbol.strip().upper(),
                    "period": args.period,
                    "rows": [],
                }
            )
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
