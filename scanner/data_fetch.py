from __future__ import annotations

from typing import Optional

import pandas as pd
import yfinance as yf

from .config import DOWNLOAD_PERIOD
from .utils import headline_age_days, safe_str


POSITIVE_NEWS_TERMS = {
    "earnings beat": 10,
    "beat": 6,
    "beats": 6,
    "raised guidance": 10,
    "raise guidance": 10,
    "guidance raised": 10,
    "upgrade": 6,
    "upgraded": 6,
    "buyback": 6,
    "share repurchase": 6,
    "approval": 8,
    "approved": 8,
    "contract": 5,
    "partnership": 4,
    "launch": 4,
    "strong demand": 6,
    "surge": 4,
    "expands": 3,
    "margin expansion": 5,
}

NEGATIVE_NEWS_TERMS = {
    "earnings miss": 12,
    "miss": 8,
    "misses": 8,
    "cut guidance": 12,
    "cuts guidance": 12,
    "lowered guidance": 12,
    "guidance cut": 12,
    "downgrade": 6,
    "downgraded": 6,
    "lawsuit": 8,
    "probe": 8,
    "investigation": 8,
    "antitrust": 8,
    "recall": 6,
    "delay": 5,
    "weak demand": 6,
    "dilution": 10,
    "secondary offering": 10,
    "share offering": 10,
    "bankruptcy": 20,
    "fraud": 20,
}


def normalize_symbol_for_download(symbol: str) -> str:
    return symbol


def batch_download(
    symbols: list[str],
    period: str = DOWNLOAD_PERIOD,
    start: Optional[str] = None,
    end: Optional[str] = None,
) -> dict[str, pd.DataFrame]:
    out: dict[str, pd.DataFrame] = {}
    joined = " ".join(normalize_symbol_for_download(s) for s in symbols)
    download_kwargs = {
        "tickers": joined,
        "interval": "1d",
        "auto_adjust": True,
        "progress": False,
        "group_by": "ticker",
        "threads": True,
    }
    if start or end:
        if start:
            download_kwargs["start"] = start
        if end:
            download_kwargs["end"] = end
    else:
        download_kwargs["period"] = period

    raw = yf.download(**download_kwargs)
    if raw.empty:
        return out

    if isinstance(raw.columns, pd.MultiIndex):
        for symbol in symbols:
            try:
                df = raw[symbol].dropna(how="all").copy()
                if not df.empty:
                    out[symbol] = df
            except Exception:
                pass
    elif len(symbols) == 1:
        out[symbols[0]] = raw.dropna(how="all").copy()

    return out


def fetch_info(symbol: str) -> dict:
    try:
        return yf.Ticker(symbol).info or {}
    except Exception:
        return {}


def fetch_recent_news_score(symbol: str, lookback_days: int = 7, max_items: int = 6) -> tuple[float, str, str, str]:
    try:
        items = yf.Ticker(symbol).news or []
    except Exception:
        return 50.0, "no recent headline signal", "", ""

    positive = 0.0
    negative = 0.0
    top_event = ""
    key_risk = ""
    scanned = 0

    for item in items:
        content = item.get("content", {})
        title = safe_str(content.get("title")).lower()
        summary = safe_str(content.get("summary")).lower()
        if not title and not summary:
            continue

        age_days = headline_age_days(content.get("pubDate"))
        if age_days is None or age_days < 0 or age_days > lookback_days:
            continue

        decay = 1.0 if age_days <= 2 else 0.65 if age_days <= 5 else 0.40
        text = f"{title} {summary}"
        scanned += 1

        for term, weight in POSITIVE_NEWS_TERMS.items():
            if term in text:
                positive += weight * decay
                if not top_event:
                    top_event = term

        for term, weight in NEGATIVE_NEWS_TERMS.items():
            if term in text:
                negative += weight * decay
                if not key_risk:
                    key_risk = term

        if scanned >= max_items:
            break

    if scanned == 0:
        return 50.0, "no recent headline signal", "", ""

    score = max(0.0, min(100.0, 50 + positive - negative))
    bias = "positive headlines" if score > 56 else "negative headlines" if score < 44 else "mixed headlines"
    return score, bias, top_event.replace("_", " "), key_risk.replace("_", " ")
