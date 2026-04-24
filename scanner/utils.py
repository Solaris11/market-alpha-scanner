from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

import numpy as np
import pandas as pd


def safe_float(x: Any, default: float = np.nan) -> float:
    try:
        if x is None:
            return default
        return float(x)
    except Exception:
        return default


def safe_str(x: Any, default: str = "") -> str:
    if x is None:
        return default
    return str(x).strip()


def extract_company_name(info: dict[str, object]) -> str:
    for key in ("longName", "shortName", "displayName", "name"):
        value = safe_str(info.get(key))
        if value and value.lower() not in {"nan", "none", "n/a", "na", "unknown"}:
            return value
    return ""


def pct_change(series: pd.Series, periods: int) -> float:
    if len(series) <= periods:
        return np.nan
    old = safe_float(series.iloc[-periods - 1])
    new = safe_float(series.iloc[-1])
    if np.isnan(old) or old == 0 or np.isnan(new):
        return np.nan
    return (new / old) - 1.0


def sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window).mean()


def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    up = delta.clip(lower=0)
    down = -delta.clip(upper=0)
    avg_gain = up.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    avg_loss = down.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    out = 100 - (100 / (1 + rs))
    return out.fillna(50)


def macd_hist(series: pd.Series) -> pd.Series:
    fast = ema(series, 12)
    slow = ema(series, 26)
    macd_line = fast - slow
    signal = ema(macd_line, 9)
    return macd_line - signal


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df["High"]
    low = df["Low"]
    close = df["Close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [
            (high - low).abs(),
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.rolling(period).mean()


def max_drawdown(series: pd.Series, lookback: int = 252) -> float:
    if len(series) < 30:
        return np.nan
    s = series.iloc[-lookback:] if len(series) >= lookback else series
    roll_max = s.cummax()
    dd = s / roll_max - 1.0
    return float(dd.min())


def annualized_volatility(series: pd.Series, lookback: int = 63) -> float:
    rets = series.pct_change().dropna()
    if len(rets) < max(20, lookback // 2):
        return np.nan
    rets = rets.iloc[-lookback:]
    return float(rets.std() * np.sqrt(252))


def clamp_score(value: float, low: float = 0.0, high: float = 100.0) -> float:
    if np.isnan(value):
        return 0.0
    return float(max(low, min(high, value)))


def slope_percent(series: pd.Series, periods: int = 10) -> float:
    if len(series) <= periods:
        return np.nan
    old = safe_float(series.iloc[-periods - 1])
    new = safe_float(series.iloc[-1])
    if np.isnan(old) or old == 0 or np.isnan(new):
        return np.nan
    return (new / old) - 1.0


def first_index_of_year(index: pd.Index, year: int) -> int:
    for i, ts in enumerate(index):
        if pd.Timestamp(ts).year == year:
            return i
    return 0


def anchored_vwap(df: pd.DataFrame, start_pos: int) -> pd.Series:
    sub = df.iloc[start_pos:].copy()
    typical = (sub["High"] + sub["Low"] + sub["Close"]) / 3.0
    cum_pv = (typical * sub["Volume"]).cumsum()
    cum_vol = sub["Volume"].cumsum().replace(0, np.nan)
    avwap = cum_pv / cum_vol
    return avwap.reindex(df.index)


def parse_datetime_like(value) -> Optional[pd.Timestamp]:
    if value in (None, "", [], {}):
        return None
    if isinstance(value, (int, float, np.integer, np.floating)):
        if np.isnan(value):
            return None
        ts_value = float(value)
        unit = "ms" if ts_value > 1e12 else "s"
        ts = pd.to_datetime(ts_value, unit=unit, utc=True, errors="coerce")
        return None if pd.isna(ts) else ts
    if isinstance(value, (list, tuple)):
        for item in value:
            parsed = parse_datetime_like(item)
            if parsed is not None:
                return parsed
        return None
    try:
        ts = pd.to_datetime(value, utc=True, errors="coerce")
        if pd.isna(ts):
            return None
        if isinstance(ts, pd.DatetimeIndex):
            return ts[0] if len(ts) else None
        return ts
    except Exception:
        return None


def parse_earnings_date(info: dict[str, object]) -> str:
    for key in ("earningsTimestamp", "earningsTimestampStart", "earningsDate"):
        parsed = parse_datetime_like(info.get(key))
        if parsed is not None:
            return parsed.date().isoformat()
    return ""


def days_until(date_str: str) -> Optional[int]:
    if not date_str:
        return None
    try:
        target = pd.Timestamp(date_str).date()
    except Exception:
        return None
    return (target - datetime.now(timezone.utc).date()).days


def headline_age_days(raw_date: object) -> Optional[int]:
    parsed = parse_datetime_like(raw_date)
    if parsed is None:
        return None
    today = datetime.now(timezone.utc).date()
    return (today - parsed.date()).days


def format_billions(x: float) -> str:
    if pd.isna(x):
        return "-"
    if x >= 1_000_000_000_000:
        return f"{x / 1_000_000_000_000:.2f}T"
    if x >= 1_000_000_000:
        return f"{x / 1_000_000_000:.2f}B"
    if x >= 1_000_000:
        return f"{x / 1_000_000:.2f}M"
    return f"{x:.0f}"


def format_percent(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"{value:.2f}"


def format_price(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"{value:.2f}"


def series_trend_score(series: Optional[pd.Series]) -> float:
    if series is None or len(series) < 200:
        return 50.0
    ema20 = ema(series, 20)
    sma50 = sma(series, 50)
    sma200 = sma(series, 200)
    last = safe_float(series.iloc[-1])
    score = 50.0
    if last > safe_float(ema20.iloc[-1]):
        score += 12
    if last > safe_float(sma50.iloc[-1]):
        score += 14
    if last > safe_float(sma200.iloc[-1]):
        score += 16
    if safe_float(ema20.iloc[-1]) > safe_float(sma50.iloc[-1]):
        score += 8
    if safe_float(sma50.iloc[-1]) > safe_float(sma200.iloc[-1]):
        score += 8
    ema_slope = slope_percent(ema20, 10)
    sma_slope = slope_percent(sma50, 15)
    if not np.isnan(ema_slope):
        score += np.clip(ema_slope * 500, -8, 8)
    if not np.isnan(sma_slope):
        score += np.clip(sma_slope * 400, -8, 8)
    return clamp_score(score)
