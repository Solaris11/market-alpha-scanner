from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from typing import Any, TypedDict

import pandas as pd
import yfinance as yf


class PeriodConfig(TypedDict):
    yf_period: str | None
    yf_interval: str


PERIOD_CONFIG: dict[str, PeriodConfig] = {
    "1d": {"yf_period": "1d", "yf_interval": "5m"},
    "1wk": {"yf_period": "7d", "yf_interval": "1h"},
    "1mo": {"yf_period": "1mo", "yf_interval": "1d"},
    "6mo": {"yf_period": "6mo", "yf_interval": "1d"},
    "ytd": {"yf_period": None, "yf_interval": "1d"},
    "1y": {"yf_period": "1y", "yf_interval": "1d"},
    "5y": {"yf_period": "5y", "yf_interval": "1wk"},
    "max": {"yf_period": "max", "yf_interval": "1mo"},
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


def _fetch_frame(ticker: yf.Ticker, yf_period: str | None, yf_interval: str, requested_period: str) -> pd.DataFrame:
    if requested_period == "ytd":
        start = datetime(datetime.now(timezone.utc).year, 1, 1, tzinfo=timezone.utc)
        return ticker.history(
            start=start,
            interval=yf_interval,
            auto_adjust=False,
            actions=False,
        )
    return ticker.history(
        period=yf_period,
        interval=yf_interval,
        auto_adjust=False,
        actions=False,
        prepost=requested_period == "1d",
    )


def _date_column_name(frame: pd.DataFrame) -> str:
    if "Datetime" in frame.columns:
        return "Datetime"
    if "Date" in frame.columns:
        return "Date"
    return str(frame.columns[0])


def _frame_to_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    frame = frame.reset_index()
    date_column = _date_column_name(frame)
    rows: list[dict[str, Any]] = []
    for raw_row in frame.to_dict(orient="records"):
        date_value = raw_row.get(date_column)
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
    return rows


def _metadata(symbol: str, requested_period: str, yf_period: str | None, yf_interval: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "ok": bool(rows),
        "symbol": symbol,
        "requested_period": requested_period,
        "period": requested_period,
        "yf_period": yf_period or "start:current-year-jan-1",
        "yf_interval": yf_interval,
        "interval": yf_interval,
        "point_count": len(rows),
        "start_date": rows[0]["date"] if rows else None,
        "end_date": rows[-1]["date"] if rows else None,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "rows": rows,
    }


def fetch_history(symbol: str, period: str) -> dict[str, Any]:
    cleaned_symbol = symbol.strip().upper()
    config = PERIOD_CONFIG.get(period)
    if not cleaned_symbol:
        return {"ok": False, "error": "Symbol is required.", "symbol": cleaned_symbol, "period": period, "rows": []}
    if config is None:
        return {"ok": False, "error": f"Unsupported period: {period}", "symbol": cleaned_symbol, "period": period, "rows": []}

    ticker = yf.Ticker(cleaned_symbol)
    yf_period = config["yf_period"]
    yf_interval = config["yf_interval"]
    frame = _fetch_frame(ticker, yf_period, yf_interval, period)
    if period == "max" and (frame is None or len(frame) < 24):
        for fallback_period in ("10y", "5y"):
            fallback_frame = _fetch_frame(ticker, fallback_period, "1wk", period)
            if fallback_frame is not None and len(fallback_frame) > len(frame if frame is not None else []):
                frame = fallback_frame
                yf_period = fallback_period
                yf_interval = "1wk"
            if frame is not None and len(frame) >= 24:
                break

    if frame is None or frame.empty:
        return {
            "ok": False,
            "error": f"No price history returned for {cleaned_symbol} over {period}.",
            "symbol": cleaned_symbol,
            "period": period,
            "requested_period": period,
            "yf_period": yf_period,
            "yf_interval": yf_interval,
            "point_count": 0,
            "start_date": None,
            "end_date": None,
            "rows": [],
        }

    return _metadata(cleaned_symbol, period, yf_period, yf_interval, _frame_to_rows(frame))


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
