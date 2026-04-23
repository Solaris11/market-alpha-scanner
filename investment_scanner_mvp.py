#!/usr/bin/env python3
"""
investment_scanner_mvp.py

Practical multi-asset scanner:
- Ranks a configurable universe of equities, ETFs, crypto, and proxy instruments
- Filters out low-liquidity / low-quality symbols
- Scores technical structure, fundamentals, macro alignment, and simple event context
- Prints a ranked shortlist and saves full output to CSV

Important constraints:
- Uses Yahoo Finance via yfinance for practicality, not institutional data quality
- News and earnings fields are advisory, not a substitute for direct due diligence
- AVWAP uses objective daily-bar anchors; it is useful, but not a perfect institutional cost-basis model
- VPVR is intentionally omitted for now because daily Yahoo data is not good enough for a reliable implementation
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from alerts import process_telegram_alerts

try:
    import yfinance as yf
except ImportError:
    print("Missing dependency: yfinance. Install with: pip install yfinance pandas numpy", file=sys.stderr)
    raise


# -----------------------------
# Config
# -----------------------------

DEFAULT_UNIVERSE = [
    # Mega-cap tech / growth
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "AVGO", "TSLA", "NFLX", "AMD",
    "ORCL", "CRM", "ADBE", "INTU", "QCOM", "MU", "PANW", "CRWD", "DDOG", "SNOW",
    "PLTR", "SHOP", "NOW", "ANET", "INTC", "ARM", "ASML", "TSM", "AMAT", "LRCX",
    "KLAC", "MRVL", "UBER", "ABNB", "MSTR", "COIN", "APP", "RBLX", "MDB", "ZS",
    # Dow / industrial / defensive / financial / consumer
    "JPM", "GS", "MS", "BAC", "WFC", "BLK", "BRK-B", "V", "MA", "AXP",
    "CAT", "DE", "HON", "GE", "RTX", "LMT", "BA", "UNP", "UPS", "FDX",
    "WMT", "COST", "PG", "KO", "PEP", "MCD", "HD", "LOW", "NKE", "SBUX",
    "JNJ", "LLY", "UNH", "MRK", "ABBV", "PFE", "TMO", "ISRG", "DHR", "SYK",
    # Energy / commodity-related
    "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "VLO", "OXY", "DVN", "HAL",
    # ETFs / indices / factor proxies
    "SPY", "QQQ", "DIA", "IWM", "SMH", "SOXX", "XLK", "XLE", "XLF", "XLV",
    "ARKK", "IBIT", "GLD", "SLV", "USO", "TLT", "HYG", "UUP", "VNQ",
    # Crypto proxies / direct
    "BTC-USD", "ETH-USD",
]

MACRO_SYMBOLS = {
    "spx": "SPY",
    "qqq": "QQQ",
    "small_caps": "IWM",
    "dxy_proxy": "UUP",
    "bonds": "TLT",
    "high_yield": "HYG",
    "gold": "GLD",
    "oil": "USO",
    "btc": "BTC-USD",
    "vix": "^VIX",
}

COMMODITY_PROXIES = {"GLD", "SLV", "USO"}
BOND_PROXIES = {"TLT", "HYG"}
CURRENCY_PROXIES = {"UUP"}
CRYPTO_PROXY_ETFS = {"IBIT"}

ETF_SECTOR_MAP = {
    "SPY": "Broad Market",
    "QQQ": "Growth / Nasdaq",
    "DIA": "Large Cap Value",
    "IWM": "Small Caps",
    "SMH": "Semiconductors",
    "SOXX": "Semiconductors",
    "XLK": "Technology",
    "XLE": "Energy",
    "XLF": "Financial Services",
    "XLV": "Healthcare",
    "VNQ": "Real Estate",
    "ARKK": "High Beta Growth",
    "GLD": "Gold",
    "SLV": "Silver",
    "USO": "Oil",
    "TLT": "Long Duration Bonds",
    "HYG": "High Yield Credit",
    "UUP": "US Dollar",
    "IBIT": "Bitcoin",
}

DEFAULT_NEWS_LIMIT = 30
MIN_PRICE = 5.0
MIN_AVG_DOLLAR_VOL = 20_000_000
MIN_MARKET_CAP = 1_000_000_000
LOOKBACK_1M = 21
LOOKBACK_3M = 63
LOOKBACK_6M = 126
LOOKBACK_1Y = 252
DOWNLOAD_PERIOD = "2y"
TOP_N = 20
ACTION_LEVELS = ["STRONG SELL", "SELL", "WAIT / HOLD", "BUY", "STRONG BUY"]


# -----------------------------
# Utility helpers
# -----------------------------

def safe_float(x, default=np.nan):
    try:
        if x is None:
            return default
        return float(x)
    except Exception:
        return default


def safe_str(x, default="") -> str:
    if x is None:
        return default
    return str(x).strip()


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
        if ts_value > 1e12:
            unit = "ms"
        elif ts_value > 1e9:
            unit = "s"
        else:
            unit = "s"
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


def parse_earnings_date(info: dict) -> str:
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


def headline_age_days(raw_date: str) -> Optional[int]:
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


# -----------------------------
# Technical indicators / scores
# -----------------------------

def supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 3.0) -> tuple[pd.Series, pd.Series]:
    if len(df) < period + 2:
        empty = pd.Series(index=df.index, dtype=float)
        return empty, empty

    hl2 = (df["High"] + df["Low"]) / 2.0
    atr_vals = atr(df, period).bfill()
    upper = hl2 + multiplier * atr_vals
    lower = hl2 - multiplier * atr_vals
    close = df["Close"]

    final_upper = upper.copy()
    final_lower = lower.copy()
    trend_line = pd.Series(index=df.index, dtype=float)
    trend_dir = pd.Series(index=df.index, dtype=float)

    trend_dir.iloc[0] = 1.0
    trend_line.iloc[0] = lower.iloc[0]

    for i in range(1, len(df)):
        prev_close = close.iloc[i - 1]
        final_upper.iloc[i] = (
            upper.iloc[i]
            if upper.iloc[i] < final_upper.iloc[i - 1] or prev_close > final_upper.iloc[i - 1]
            else final_upper.iloc[i - 1]
        )
        final_lower.iloc[i] = (
            lower.iloc[i]
            if lower.iloc[i] > final_lower.iloc[i - 1] or prev_close < final_lower.iloc[i - 1]
            else final_lower.iloc[i - 1]
        )

        if close.iloc[i] > final_upper.iloc[i - 1]:
            trend_dir.iloc[i] = 1.0
        elif close.iloc[i] < final_lower.iloc[i - 1]:
            trend_dir.iloc[i] = -1.0
        else:
            trend_dir.iloc[i] = trend_dir.iloc[i - 1]

        trend_line.iloc[i] = final_lower.iloc[i] if trend_dir.iloc[i] > 0 else final_upper.iloc[i]

    return trend_line, trend_dir


def score_trend_structure(df: pd.DataFrame) -> float:
    close = df["Close"]
    if len(close) < 220:
        return 0.0

    ema20 = ema(close, 20)
    sma50 = sma(close, 50)
    sma200 = sma(close, 200)
    last = safe_float(close.iloc[-1])

    score = 0.0
    if last > safe_float(ema20.iloc[-1]):
        score += 15
    if last > safe_float(sma50.iloc[-1]):
        score += 20
    if last > safe_float(sma200.iloc[-1]):
        score += 25
    if safe_float(ema20.iloc[-1]) > safe_float(sma50.iloc[-1]):
        score += 15
    if safe_float(sma50.iloc[-1]) > safe_float(sma200.iloc[-1]):
        score += 15

    ema_slope = slope_percent(ema20, 10)
    sma_slope = slope_percent(sma50, 15)
    if not np.isnan(ema_slope) and ema_slope > 0:
        score += 5
    if not np.isnan(sma_slope) and sma_slope > 0:
        score += 5

    return clamp_score(score)


def score_supertrend(df: pd.DataFrame) -> tuple[float, float]:
    close = df["Close"]
    st_line, st_dir = supertrend(df, 10, 3.0)
    if st_line.empty or st_dir.empty:
        return 50.0, np.nan

    last = safe_float(close.iloc[-1])
    line = safe_float(st_line.iloc[-1])
    direction = safe_float(st_dir.iloc[-1], 0)
    score = 50.0

    if direction > 0:
        score += 25
    else:
        score -= 20

    if not np.isnan(line):
        if last > line:
            score += 15
        else:
            score -= 15

    if len(st_dir) >= 6 and st_dir.iloc[-1] > 0 and (st_dir.iloc[-6:-1] < 0).any():
        score += 10
    if len(st_dir) >= 6 and st_dir.iloc[-1] < 0 and (st_dir.iloc[-6:-1] > 0).any():
        score -= 10

    return clamp_score(score), line


def score_momentum_health(df: pd.DataFrame) -> tuple[float, float, float]:
    close = df["Close"]
    if len(close) < 70:
        return 0.0, np.nan, np.nan

    current_rsi = safe_float(rsi(close, 14).iloc[-1], 50)
    current_macd = safe_float(macd_hist(close).iloc[-1], 0)
    prev_macd = safe_float(macd_hist(close).iloc[-2], 0)
    ret_1m = pct_change(close, LOOKBACK_1M)
    ret_3m = pct_change(close, LOOKBACK_3M)

    score = 50.0
    if 52 <= current_rsi <= 68:
        score += 15
    elif 45 <= current_rsi < 52 or 68 < current_rsi <= 75:
        score += 8
    elif current_rsi > 75:
        score -= 8
    else:
        score -= 12

    if current_macd > 0:
        score += 12
    if current_macd > prev_macd:
        score += 10
    else:
        score -= 8

    if not np.isnan(ret_1m):
        score += np.clip(ret_1m * 120, -8, 8)
    if not np.isnan(ret_3m):
        score += np.clip(ret_3m * 100, -10, 10)

    if current_rsi > 72 and current_macd < prev_macd:
        score -= 15

    return clamp_score(score), current_rsi, current_macd


def score_breakout_quality(df: pd.DataFrame) -> float:
    close = df["Close"]
    if len(close) < 90:
        return 0.0

    last = safe_float(close.iloc[-1])
    high_3m = safe_float(close.iloc[-63:].max())
    high_1y = safe_float(close.iloc[-252:].max()) if len(close) >= 252 else safe_float(close.max())
    prev_20 = safe_float(close.iloc[-21:-1].max()) if len(close) >= 21 else high_3m
    vol_ratio = safe_float(df["Volume"].iloc[-1] / df["Volume"].iloc[-20:].mean(), 1.0)

    score = 0.0
    if high_3m and last >= high_3m * 0.99:
        score += 25
    if high_1y and last >= high_1y * 0.96:
        score += 20
    if prev_20 and last > prev_20:
        score += 20
    if vol_ratio > 1.5:
        score += 15
    elif vol_ratio > 1.15:
        score += 8

    if high_1y:
        dist = (high_1y - last) / high_1y
        score += max(0, 20 - dist * 100)

    return clamp_score(score)


def score_relative_volume(df: pd.DataFrame) -> float:
    if len(df) < 30:
        return 0.0
    avg20 = safe_float(df["Volume"].iloc[-20:].mean())
    avg5 = safe_float(df["Volume"].iloc[-5:].mean())
    current = safe_float(df["Volume"].iloc[-1])
    if avg20 <= 0:
        return 0.0
    ratio_day = current / avg20
    ratio_week = avg5 / avg20
    score = 50 + (ratio_day - 1.0) * 30 + (ratio_week - 1.0) * 20
    return clamp_score(score)


def score_avwap(df: pd.DataFrame) -> tuple[float, float, float]:
    close = df["Close"]
    if len(df) < 80:
        return 50.0, np.nan, np.nan

    last = safe_float(close.iloc[-1])
    ytd_pos = first_index_of_year(df.index, pd.Timestamp(df.index[-1]).year)
    recent_window = df.iloc[-63:]
    swing_low_pos = max(0, len(df) - 63 + int(np.argmin(recent_window["Close"].values)))

    avwap_ytd = anchored_vwap(df, ytd_pos)
    avwap_swing = anchored_vwap(df, swing_low_pos)
    ytd_val = safe_float(avwap_ytd.iloc[-1])
    swing_val = safe_float(avwap_swing.iloc[-1])

    score = 50.0
    if not np.isnan(ytd_val):
        score += 15 if last > ytd_val else -12
    if not np.isnan(swing_val):
        score += 20 if last > swing_val else -18

    active_anchor = max(v for v in [ytd_val, swing_val] if not np.isnan(v)) if not (np.isnan(ytd_val) and np.isnan(swing_val)) else np.nan
    if not np.isnan(active_anchor) and active_anchor > 0:
        distance = (last / active_anchor) - 1.0
        if 0 <= distance <= 0.08:
            score += 12
        elif distance > 0.12:
            score -= 10

    return clamp_score(score), ytd_val, swing_val


def technical_scorecard(df: pd.DataFrame) -> dict[str, float]:
    trend = score_trend_structure(df)
    st_score, st_line = score_supertrend(df)
    momentum, current_rsi, current_macd = score_momentum_health(df)
    breakout = score_breakout_quality(df)
    rel_vol = score_relative_volume(df)
    avwap_score, avwap_ytd, avwap_swing = score_avwap(df)

    technical = clamp_score(
        trend * 0.26
        + st_score * 0.16
        + momentum * 0.20
        + breakout * 0.18
        + rel_vol * 0.10
        + avwap_score * 0.10
    )

    return {
        "technical_score": technical,
        "trend_score": round(trend, 2),
        "supertrend_score": round(st_score, 2),
        "momentum_score": round(momentum, 2),
        "breakout_score": round(breakout, 2),
        "relative_volume_score": round(rel_vol, 2),
        "avwap_score": round(avwap_score, 2),
        "current_rsi": round(current_rsi, 2) if not np.isnan(current_rsi) else np.nan,
        "current_macd_hist": round(current_macd, 4) if not np.isnan(current_macd) else np.nan,
        "supertrend_line": round(st_line, 4) if not np.isnan(st_line) else np.nan,
        "avwap_ytd": round(avwap_ytd, 4) if not np.isnan(avwap_ytd) else np.nan,
        "avwap_swing": round(avwap_swing, 4) if not np.isnan(avwap_swing) else np.nan,
    }


# -----------------------------
# Fundamentals
# -----------------------------

def infer_asset_type(symbol: str, info: dict) -> str:
    quote_type = safe_str(info.get("quoteType")).upper()
    if symbol.endswith("-USD") or quote_type == "CRYPTOCURRENCY":
        return "CRYPTO"
    if symbol in COMMODITY_PROXIES:
        return "COMMODITY_PROXY"
    if symbol in BOND_PROXIES:
        return "BOND_PROXY"
    if symbol in CURRENCY_PROXIES:
        return "FX_PROXY"
    if symbol in CRYPTO_PROXY_ETFS:
        return "CRYPTO_PROXY"
    if quote_type == "ETF":
        return "ETF"
    return "EQUITY"


def infer_sector(symbol: str, asset_type: str, info: dict) -> str:
    sector = safe_str(info.get("sector"))
    if sector:
        return sector
    if asset_type != "EQUITY":
        return ETF_SECTOR_MAP.get(symbol, asset_type.replace("_", " ").title())
    return "Unknown"


def score_quality(info: dict) -> float:
    gross = safe_float(info.get("grossMargins"))
    operating = safe_float(info.get("operatingMargins"))
    net = safe_float(info.get("profitMargins"))
    free_cash_flow = safe_float(info.get("freeCashflow"))
    debt = safe_float(info.get("debtToEquity"))
    roe = safe_float(info.get("returnOnEquity"))

    score = 50.0
    if not np.isnan(net):
        score += 12 if net > 0 else -18
        if net > 0.18:
            score += 8
    if not np.isnan(gross):
        if gross > 0.45:
            score += 8
        elif gross < 0.20:
            score -= 6
    if not np.isnan(operating):
        if operating > 0.18:
            score += 10
        elif operating < 0:
            score -= 10
    if not np.isnan(free_cash_flow):
        score += 10 if free_cash_flow > 0 else -10
    if not np.isnan(debt):
        if debt < 80:
            score += 6
        elif debt > 200:
            score -= 8
    if not np.isnan(roe):
        if roe > 0.15:
            score += 8
        elif roe < 0:
            score -= 10
    return clamp_score(score)


def score_growth(info: dict) -> float:
    revenue_growth = safe_float(info.get("revenueGrowth"))
    earnings_growth = safe_float(info.get("earningsGrowth"))

    score = 50.0
    if not np.isnan(revenue_growth):
        score += np.clip(revenue_growth * 80, -15, 15)
    if not np.isnan(earnings_growth):
        score += np.clip(earnings_growth * 70, -18, 18)
    if not np.isnan(revenue_growth) and not np.isnan(earnings_growth):
        if revenue_growth > 0 and earnings_growth > 0:
            score += 6
        elif revenue_growth < 0 and earnings_growth < 0:
            score -= 8
    return clamp_score(score)


def score_valuation(info: dict) -> float:
    trailing_pe = safe_float(info.get("trailingPE"))
    forward_pe = safe_float(info.get("forwardPE"))
    peg = safe_float(info.get("pegRatio"))
    dividend_yield = safe_float(info.get("dividendYield"))
    payout_ratio = safe_float(info.get("payoutRatio"))

    score = 50.0
    pe = forward_pe if not np.isnan(forward_pe) else trailing_pe

    if not np.isnan(pe):
        if 8 <= pe <= 25:
            score += 18
        elif 25 < pe <= 40:
            score += 8
        elif pe > 60:
            score -= 15
        elif pe < 0:
            score -= 20

    if not np.isnan(trailing_pe) and not np.isnan(forward_pe):
        if forward_pe < trailing_pe:
            score += 5
        elif forward_pe > trailing_pe * 1.15:
            score -= 5

    if not np.isnan(peg):
        if 0 < peg <= 1.5:
            score += 12
        elif 1.5 < peg <= 2.5:
            score += 5
        elif peg > 3.5:
            score -= 10

    if not np.isnan(dividend_yield) and dividend_yield > 0 and not np.isnan(payout_ratio):
        if payout_ratio < 0.7:
            score += 4
        elif payout_ratio > 1.0:
            score -= 6

    return clamp_score(score)


def infer_profitability_status(info: dict) -> str:
    net = safe_float(info.get("profitMargins"))
    fcf = safe_float(info.get("freeCashflow"))
    earnings_growth = safe_float(info.get("earningsGrowth"))

    if not np.isnan(net) and net > 0 and not np.isnan(fcf) and fcf > 0:
        if not np.isnan(earnings_growth) and earnings_growth > 0:
            return "profitable / growing"
        return "profitable"
    if not np.isnan(fcf) and fcf > 0:
        return "cash generative"
    if not np.isnan(net) and net <= 0:
        return "loss-making"
    return "mixed"


def infer_valuation_flag(info: dict) -> str:
    trailing_pe = safe_float(info.get("trailingPE"))
    forward_pe = safe_float(info.get("forwardPE"))
    peg = safe_float(info.get("pegRatio"))
    pe = forward_pe if not np.isnan(forward_pe) else trailing_pe

    if np.isnan(pe) and np.isnan(peg):
        return "unrated"
    if (not np.isnan(pe) and pe > 40) or (not np.isnan(peg) and peg > 3):
        return "expensive"
    if not np.isnan(pe) and pe < 12:
        return "cheap"
    if (not np.isnan(pe) and 12 <= pe <= 25) or (not np.isnan(peg) and 0 < peg <= 1.5):
        return "reasonable"
    return "mixed"


def fundamentals_scorecard(info: dict, asset_type: str) -> dict[str, float | str]:
    if asset_type != "EQUITY":
        if asset_type in {"CRYPTO", "CRYPTO_PROXY"}:
            base = 40.0
        elif asset_type in {"BOND_PROXY", "FX_PROXY"}:
            base = 50.0
        else:
            base = 55.0
        return {
            "quality_score": base,
            "growth_score": base,
            "valuation_score": base,
            "fundamental_score": base,
            "profitability_status": "n/a",
            "valuation_flag": "n/a",
        }

    quality = score_quality(info)
    growth = score_growth(info)
    valuation = score_valuation(info)
    fundamental = clamp_score(quality * 0.40 + growth * 0.35 + valuation * 0.25)

    return {
        "quality_score": round(quality, 2),
        "growth_score": round(growth, 2),
        "valuation_score": round(valuation, 2),
        "fundamental_score": round(fundamental, 2),
        "profitability_status": infer_profitability_status(info),
        "valuation_flag": infer_valuation_flag(info),
    }


# -----------------------------
# Macro layer
# -----------------------------

def compute_vix_stress(vix_series: Optional[pd.Series]) -> float:
    if vix_series is None or len(vix_series) < 30:
        return 50.0
    last = safe_float(vix_series.iloc[-1])
    avg20 = safe_float(sma(vix_series, 20).iloc[-1])
    stress = 50.0
    if not np.isnan(last):
        if last > 30:
            stress += 30
        elif last > 24:
            stress += 20
        elif last < 18:
            stress -= 15
    if not np.isnan(avg20) and not np.isnan(last):
        if last > avg20 * 1.10:
            stress += 10
        elif last < avg20 * 0.92:
            stress -= 6
    return clamp_score(stress)


def compute_macro_regime(macro_closes: dict[str, pd.Series]) -> dict[str, float | str]:
    spx_tr = series_trend_score(macro_closes.get("spx"))
    qqq_tr = series_trend_score(macro_closes.get("qqq"))
    iwm_tr = series_trend_score(macro_closes.get("small_caps"))
    tlt_tr = series_trend_score(macro_closes.get("bonds"))
    hyg_tr = series_trend_score(macro_closes.get("high_yield"))
    dxy_tr = series_trend_score(macro_closes.get("dxy_proxy"))
    gold_tr = series_trend_score(macro_closes.get("gold"))
    oil_tr = series_trend_score(macro_closes.get("oil"))
    btc_tr = series_trend_score(macro_closes.get("btc"))
    vix_stress = compute_vix_stress(macro_closes.get("vix"))

    risk_on = clamp_score(
        (spx_tr * 0.25)
        + (qqq_tr * 0.25)
        + (iwm_tr * 0.15)
        + (hyg_tr * 0.15)
        + ((100 - dxy_tr) * 0.10)
        + ((100 - vix_stress) * 0.10)
    )
    rates_pressure = clamp_score(((100 - tlt_tr) * 0.70) + (dxy_tr * 0.30))
    defensive_bid = clamp_score((gold_tr * 0.40) + (tlt_tr * 0.25) + (vix_stress * 0.35))

    note_bits: list[str] = []
    if risk_on >= 65:
        note_bits.append("risk-on supportive")
    elif risk_on <= 40:
        note_bits.append("risk-off backdrop")
    if rates_pressure >= 60:
        note_bits.append("rates pressure elevated")
    if dxy_tr >= 60:
        note_bits.append("dollar firm")
    if oil_tr >= 60:
        note_bits.append("oil strength")
    if vix_stress >= 60:
        note_bits.append("volatility stress elevated")

    return {
        "spx_trend": spx_tr,
        "qqq_trend": qqq_tr,
        "small_caps_trend": iwm_tr,
        "bond_trend": tlt_tr,
        "credit_trend": hyg_tr,
        "dollar_strength": dxy_tr,
        "gold_trend": gold_tr,
        "oil_trend": oil_tr,
        "btc_trend": btc_tr,
        "vix_stress": vix_stress,
        "risk_on": risk_on,
        "rates_pressure": rates_pressure,
        "defensive_bid": defensive_bid,
        "macro_note": ", ".join(note_bits[:4]) or "mixed macro",
    }


def score_macro_alignment(symbol: str, asset_type: str, sector: str, regime: dict[str, float | str]) -> tuple[float, str, str]:
    risk_on = safe_float(regime.get("risk_on"), 50)
    rates_pressure = safe_float(regime.get("rates_pressure"), 50)
    dollar_strength = safe_float(regime.get("dollar_strength"), 50)
    oil_trend = safe_float(regime.get("oil_trend"), 50)
    gold_trend = safe_float(regime.get("gold_trend"), 50)
    qqq_trend = safe_float(regime.get("qqq_trend"), 50)
    credit_trend = safe_float(regime.get("credit_trend"), 50)
    bond_trend = safe_float(regime.get("bond_trend"), 50)
    vix_stress = safe_float(regime.get("vix_stress"), 50)
    defensive_bid = safe_float(regime.get("defensive_bid"), 50)

    sensitivity = "balanced"
    score = 50.0
    drivers: list[str] = []

    if asset_type == "CRYPTO":
        sensitivity = "risk-on / dollar"
        score += (risk_on - 50) * 0.60
        score += (50 - dollar_strength) * 0.20
        score += (safe_float(regime.get("btc_trend"), 50) - 50) * 0.20
        if risk_on >= 60:
            drivers.append("risk appetite supportive")
        if dollar_strength >= 60:
            drivers.append("strong dollar is a headwind")
    elif asset_type == "CRYPTO_PROXY":
        sensitivity = "crypto beta"
        score += (risk_on - 50) * 0.45
        score += (safe_float(regime.get("btc_trend"), 50) - 50) * 0.35
        score += (50 - dollar_strength) * 0.20
    elif asset_type == "COMMODITY_PROXY":
        if symbol in {"GLD", "SLV"}:
            sensitivity = "dollar / stress hedge"
            score += (50 - dollar_strength) * 0.35
            score += (defensive_bid - 50) * 0.35
            score += (gold_trend - 50) * 0.30
        elif symbol == "USO":
            sensitivity = "oil-sensitive"
            score += (oil_trend - 50) * 0.65
            score += (risk_on - 50) * 0.15
            score -= max(0, dollar_strength - 60) * 0.15
        if oil_trend >= 60 and symbol == "USO":
            drivers.append("oil trend supportive")
        if defensive_bid >= 60 and symbol in {"GLD", "SLV"}:
            drivers.append("defensive bid supportive")
    elif asset_type == "BOND_PROXY":
        sensitivity = "duration / credit"
        if symbol == "TLT":
            score += (bond_trend - 50) * 0.70
            score -= (dollar_strength - 50) * 0.10
        else:
            score += (credit_trend - 50) * 0.55
            score += (risk_on - 50) * 0.20
            score -= max(0, vix_stress - 55) * 0.20
    elif asset_type == "FX_PROXY":
        sensitivity = "dollar"
        score = dollar_strength
        if dollar_strength >= 60:
            drivers.append("dollar trend supportive")
    elif sector in {"Technology", "Communication Services", "Semiconductors", "Growth / Nasdaq", "High Beta Growth"}:
        sensitivity = "rates-sensitive growth"
        score += (qqq_trend - 50) * 0.45
        score += (risk_on - 50) * 0.20
        score -= (rates_pressure - 50) * 0.35
        score -= (dollar_strength - 50) * 0.15
    elif sector in {"Energy", "Oil"}:
        sensitivity = "oil-sensitive"
        score += (oil_trend - 50) * 0.55
        score += (risk_on - 50) * 0.15
    elif sector in {"Financial Services", "Banks", "Insurance"}:
        sensitivity = "rates / credit"
        score += (credit_trend - 50) * 0.35
        score += (risk_on - 50) * 0.20
        score -= max(0, vix_stress - 60) * 0.25
    elif sector in {"Consumer Defensive", "Healthcare", "Utilities", "Real Estate"}:
        sensitivity = "defensive / rates"
        score += (defensive_bid - 50) * 0.20
        score += (risk_on - 50) * 0.10
        score -= (rates_pressure - 50) * 0.15
    else:
        sensitivity = "equity beta"
        score += (risk_on - 50) * 0.45
        score -= (dollar_strength - 50) * 0.15

    if rates_pressure >= 60 and "rates" in sensitivity:
        drivers.append("rates backdrop matters")
    if risk_on >= 60 and sensitivity in {"equity beta", "rates-sensitive growth", "crypto beta"}:
        drivers.append("risk-on supportive")
    if vix_stress >= 65:
        drivers.append("volatility backdrop is a risk")

    return clamp_score(score), sensitivity, ", ".join(drivers[:3]) or safe_str(regime.get("macro_note"))


# -----------------------------
# News / event layer
# -----------------------------

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

    score = clamp_score(50 + positive - negative)
    bias = "positive headlines" if score > 56 else "negative headlines" if score < 44 else "mixed headlines"
    return score, bias, top_event.replace("_", " "), key_risk.replace("_", " ")


# -----------------------------
# Data access
# -----------------------------

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


# -----------------------------
# Output model
# -----------------------------

@dataclass
class RankedAsset:
    symbol: str
    asset_type: str
    sector: str
    industry: str
    price: float
    market_cap: float
    avg_dollar_volume: float
    dividend_yield: float
    earnings_date: str
    technical_score: float
    trend_score: float
    supertrend_score: float
    momentum_score: float
    breakout_score: float
    relative_volume_score: float
    avwap_score: float
    fundamental_score: float
    quality_score: float
    growth_score: float
    valuation_score: float
    news_score: float
    macro_score: float
    risk_penalty: float
    final_score: float
    short_score: float
    mid_score: float
    long_score: float
    rating: str
    setup_type: str
    short_action: str
    mid_action: str
    long_action: str
    composite_action: str
    short_reason: str
    mid_reason: str
    long_reason: str
    selection_reason: str
    entry_zone: str
    invalidation_level: str
    upside_driver: str
    key_risk: str
    profitability_status: str
    valuation_flag: str
    trailing_pe: float
    forward_pe: float
    revenue_growth: float
    earnings_growth: float
    gross_margin: float
    operating_margin: float
    profit_margin: float
    debt_to_equity: float
    return_on_equity: float
    macro_sensitivity: str
    confidence_level: str
    macro_note: str
    headline_bias: str
    current_rsi: float
    current_macd_hist: float
    atr_pct: float
    annualized_volatility: float
    max_drawdown: float


def rating_from_score(score: float) -> str:
    if score >= 80:
        return "TOP"
    if score >= 65:
        return "ACTIONABLE"
    if score >= 50:
        return "WATCH"
    return "PASS"


def score_weights(asset_type: str) -> dict[str, float]:
    if asset_type == "EQUITY":
        return {"technical": 0.42, "fundamental": 0.28, "news": 0.10, "macro": 0.20}
    if asset_type in {"ETF", "BOND_PROXY", "FX_PROXY", "COMMODITY_PROXY"}:
        return {"technical": 0.50, "fundamental": 0.10, "news": 0.05, "macro": 0.35}
    if asset_type in {"CRYPTO", "CRYPTO_PROXY"}:
        return {"technical": 0.55, "fundamental": 0.05, "news": 0.10, "macro": 0.30}
    return {"technical": 0.45, "fundamental": 0.20, "news": 0.10, "macro": 0.25}


def composite_score(
    asset_type: str,
    technical_score: float,
    fundamental_score: float,
    news_score: float,
    macro_score: float,
    risk_penalty: float,
) -> float:
    weights = score_weights(asset_type)
    base = (
        technical_score * weights["technical"]
        + fundamental_score * weights["fundamental"]
        + news_score * weights["news"]
        + macro_score * weights["macro"]
    )
    return clamp_score(base - risk_penalty)


def derive_setup_type(
    technical: dict[str, float],
    price: float,
    avwap_swing: float,
    supertrend_line: float,
) -> str:
    breakout = technical["breakout_score"]
    trend = technical["trend_score"]
    rel_vol = technical["relative_volume_score"]
    rsi_value = technical["current_rsi"]

    if breakout >= 75 and rel_vol >= 60:
        return "breakout continuation"
    if trend >= 75 and not np.isnan(avwap_swing) and price >= avwap_swing and price <= avwap_swing * 1.05:
        return "pullback to AVWAP"
    if trend >= 75 and not np.isnan(supertrend_line) and price >= supertrend_line:
        return "trend continuation"
    if not np.isnan(rsi_value) and rsi_value >= 75:
        return "extended / watch pullback"
    return "mixed setup"


def derive_entry_zone(price: float, ema20_value: float, avwap_ytd: float, avwap_swing: float) -> str:
    anchors = [v for v in [ema20_value, avwap_ytd, avwap_swing] if not np.isnan(v)]
    if not anchors:
        return format_price(price)
    center = float(np.mean(anchors[-2:]))
    low = center * 0.99
    high = center * 1.01
    return f"{low:.2f}-{high:.2f}"


def derive_invalidation_level(sma50_value: float, supertrend_line: float, avwap_swing: float) -> str:
    candidates = [v for v in [sma50_value, supertrend_line, avwap_swing] if not np.isnan(v)]
    if not candidates:
        return "-"
    return format_price(min(candidates))


def derive_upside_driver(technical_score: float, fundamental_score: float, news_score: float, macro_score: float) -> str:
    driver_map = {
        "technical breakout": technical_score,
        "fundamental quality": fundamental_score,
        "headline / event flow": news_score,
        "macro tailwind": macro_score,
    }
    return max(driver_map.items(), key=lambda item: item[1])[0]


def derive_key_risk(
    asset_type: str,
    current_rsi: float,
    current_macd: float,
    previous_macd: float,
    risk_penalty: float,
    earnings_date: str,
    headline_risk: str,
) -> str:
    earnings_in = days_until(earnings_date)
    if headline_risk:
        return headline_risk
    if earnings_in is not None and 0 <= earnings_in <= 7 and asset_type == "EQUITY":
        return f"earnings in {earnings_in}d"
    if not np.isnan(current_rsi) and current_rsi >= 75 and not np.isnan(current_macd) and current_macd < previous_macd:
        return "momentum fading from overbought"
    if risk_penalty >= 15:
        return "elevated volatility"
    return "standard trend risk"


def derive_confidence_level(
    asset_type: str,
    technical_score: float,
    fundamental_score: float,
    macro_score: float,
    news_score: float,
    risk_penalty: float,
) -> str:
    checks = 0
    if technical_score >= 70:
        checks += 1
    if asset_type != "EQUITY" or fundamental_score >= 60:
        checks += 1
    if macro_score >= 60:
        checks += 1
    if news_score >= 55 or news_score <= 45:
        checks += 1
    if risk_penalty <= 8:
        checks += 1

    if checks >= 4:
        return "high"
    if checks >= 2:
        return "medium"
    return "low"


def compute_risk_penalty(
    df: pd.DataFrame,
    current_rsi: float,
    current_macd: float,
    previous_macd: float,
    earnings_date: str,
    asset_type: str,
) -> tuple[float, float, float, float]:
    close = df["Close"]
    vol = annualized_volatility(close, 63)
    dd = max_drawdown(close, 252)
    atr_pct = safe_float(atr(df, 14).iloc[-1] / close.iloc[-1], np.nan)
    earnings_in = days_until(earnings_date)

    penalty = 0.0

    if not np.isnan(vol):
        if vol > 0.90:
            penalty += 10
        elif vol > 0.70:
            penalty += 7
        elif vol > 0.50:
            penalty += 4

    if not np.isnan(dd):
        if dd < -0.60:
            penalty += 8
        elif dd < -0.40:
            penalty += 5
        elif dd < -0.25:
            penalty += 3

    if not np.isnan(atr_pct):
        if atr_pct > 0.10:
            penalty += 8
        elif atr_pct > 0.07:
            penalty += 5
        elif atr_pct > 0.05:
            penalty += 3

    if not np.isnan(current_rsi) and current_rsi > 75 and not np.isnan(current_macd) and current_macd < previous_macd:
        penalty += 3

    if earnings_in is not None and 0 <= earnings_in <= 7 and asset_type == "EQUITY":
        penalty += 4

    return round(min(30.0, penalty), 2), round(vol, 4) if not np.isnan(vol) else np.nan, round(atr_pct * 100, 2) if not np.isnan(atr_pct) else np.nan, round(dd * 100, 2) if not np.isnan(dd) else np.nan


# -----------------------------
# Horizon recommendations
# -----------------------------

def return_to_score(ret: float, upside_scale: float, downside_scale: float) -> float:
    if np.isnan(ret):
        return 50.0
    scale = upside_scale if ret >= 0 else downside_scale
    return clamp_score(50 + (ret * scale))


def drawdown_quality_score(drawdown_pct: float) -> float:
    if np.isnan(drawdown_pct):
        return 50.0
    drawdown = abs(drawdown_pct)
    if drawdown <= 15:
        return 82.0
    if drawdown <= 25:
        return 70.0
    if drawdown <= 40:
        return 56.0
    if drawdown <= 55:
        return 40.0
    return 24.0


def proximity_to_high_score(distance_to_high: float) -> float:
    if np.isnan(distance_to_high):
        return 50.0
    return clamp_score(100 - (distance_to_high * 350))


def build_horizon_context(df: pd.DataFrame, technical: dict[str, float], max_drawdown_pct: float) -> dict[str, float | bool]:
    close = df["Close"].dropna()
    last = safe_float(close.iloc[-1], np.nan)
    sma50_value = safe_float(sma(close, 50).iloc[-1], np.nan)
    sma200_value = safe_float(sma(close, 200).iloc[-1], np.nan)
    ret_1m = pct_change(close, LOOKBACK_1M)
    ret_3m = pct_change(close, LOOKBACK_3M)
    ret_6m = pct_change(close, LOOKBACK_6M)
    ret_1y = pct_change(close, LOOKBACK_1Y)
    high_1y = safe_float(close.iloc[-252:].max(), np.nan) if len(close) >= 252 else safe_float(close.max(), np.nan)
    distance_to_high = ((high_1y - last) / high_1y) if high_1y and not np.isnan(high_1y) and high_1y > 0 else np.nan

    return {
        "ret_1m": ret_1m,
        "ret_3m": ret_3m,
        "ret_6m": ret_6m,
        "ret_1y": ret_1y,
        "short_return_score": return_to_score(ret_1m, upside_scale=320, downside_scale=260),
        "mid_return_score": return_to_score(ret_3m, upside_scale=190, downside_scale=160),
        "long_return_score": clamp_score(
            (return_to_score(ret_6m, upside_scale=130, downside_scale=120) * 0.55)
            + (return_to_score(ret_1y, upside_scale=105, downside_scale=95) * 0.45)
        ),
        "distance_to_high": distance_to_high,
        "proximity_score": proximity_to_high_score(distance_to_high),
        "drawdown_quality": drawdown_quality_score(max_drawdown_pct),
        "above_sma50": bool(not np.isnan(sma50_value) and not np.isnan(last) and last >= sma50_value),
        "above_sma200": bool(not np.isnan(sma200_value) and not np.isnan(last) and last >= sma200_value),
        "rsi_overbought": bool(safe_float(technical.get("current_rsi"), np.nan) >= 74),
    }


def score_to_action_index(score: float) -> int:
    if score >= 82:
        return 4
    if score >= 68:
        return 3
    if score >= 52:
        return 2
    if score >= 38:
        return 1
    return 0


def action_from_index(index: int) -> str:
    return ACTION_LEVELS[max(0, min(index, len(ACTION_LEVELS) - 1))]


def action_from_horizon_score(horizon: str, score: float, asset: RankedAsset, context: dict[str, float | bool]) -> str:
    index = score_to_action_index(score)

    if asset.risk_penalty >= 24:
        index = min(index, 1)
    elif asset.risk_penalty >= 18:
        index = min(index, 2)

    if horizon == "short":
        if asset.momentum_score < 40 and asset.breakout_score < 40:
            index = min(index, 1)
        if context.get("rsi_overbought") and asset.breakout_score < 55:
            index = min(index, 2)
    elif horizon == "mid":
        if asset.trend_score < 40:
            index = min(index, 1)
        if safe_float(context.get("ret_3m"), np.nan) < -0.08:
            index = min(index, 1)
    elif horizon == "long":
        if asset.trend_score < 42 or not context.get("above_sma200", False):
            index = min(index, 1)
        if asset.asset_type == "EQUITY" and asset.fundamental_score < 45:
            index = min(index, 2)

    if asset.macro_score < 35 and index > 2:
        index -= 1

    return action_from_index(index)


def rank_reason_candidates(candidates: list[tuple[bool, float, str]]) -> list[tuple[float, str]]:
    filtered = [(weight, text) for keep, weight, text in candidates if keep and text]
    return sorted(filtered, key=lambda item: item[0], reverse=True)


def build_reason_text(
    positive_candidates: list[tuple[bool, float, str]],
    negative_candidates: list[tuple[bool, float, str]],
    action: str,
) -> str:
    positives = rank_reason_candidates(positive_candidates)
    negatives = rank_reason_candidates(negative_candidates)

    chosen: list[str] = []
    if action in {"STRONG BUY", "BUY"}:
        chosen.extend(text for _, text in positives[:2])
        if negatives:
            chosen.append(negatives[0][1])
    elif action == "WAIT / HOLD":
        if positives:
            chosen.append(positives[0][1])
        if negatives:
            chosen.append(negatives[0][1])
    else:
        chosen.extend(text for _, text in negatives[:2])
        if positives:
            chosen.append(positives[0][1])

    return "; ".join(dict.fromkeys(chosen[:3])) or "mixed signal profile"


def derive_horizon_reason(horizon: str, asset: RankedAsset, context: dict[str, float | bool], action: str) -> str:
    if horizon == "short":
        positives = [
            (asset.momentum_score >= 68 or safe_float(context.get("ret_1m"), np.nan) >= 0.06, asset.momentum_score, "strong recent momentum"),
            (asset.breakout_score >= 68, asset.breakout_score, "breakout behavior remains constructive"),
            (asset.relative_volume_score >= 60, asset.relative_volume_score, "volume expansion supports the move"),
            (asset.avwap_score >= 62, asset.avwap_score, "price is holding above key AVWAP support"),
            (asset.news_score >= 56, asset.news_score, "recent news flow is supportive"),
            (asset.macro_score >= 60, asset.macro_score, f"macro tailwind for {asset.asset_type.lower()}s"),
        ]
        negatives = [
            (asset.momentum_score <= 45 or safe_float(context.get("ret_1m"), np.nan) <= -0.04, 100 - asset.momentum_score, "weak recent momentum"),
            (asset.breakout_score <= 45, 100 - asset.breakout_score, "breakout structure is weak"),
            (asset.risk_penalty >= 12, asset.risk_penalty * 4, "elevated volatility penalty"),
            (asset.news_score <= 44, 100 - asset.news_score, "recent headline flow is negative"),
            (asset.macro_score <= 40, 100 - asset.macro_score, "macro backdrop is unsupportive"),
        ]
    elif horizon == "mid":
        positives = [
            (safe_float(context.get("ret_3m"), np.nan) >= 0.10, safe_float(context.get("mid_return_score"), 50), "strong 3-month momentum"),
            (asset.trend_score >= 68, asset.trend_score, "healthy medium-term trend structure"),
            (asset.breakout_score >= 58 or asset.avwap_score >= 60, max(asset.breakout_score, asset.avwap_score), "pullback / breakout structure remains constructive"),
            (asset.macro_score >= 58, asset.macro_score, "macro tailwind supports the medium-term setup"),
            (asset.risk_penalty <= 8, 75 - asset.risk_penalty, "risk remains contained"),
        ]
        negatives = [
            (safe_float(context.get("ret_3m"), np.nan) <= -0.06, 100 - safe_float(context.get("mid_return_score"), 50), "3-month momentum is weak"),
            (asset.trend_score <= 45, 100 - asset.trend_score, "trend structure is deteriorating"),
            (asset.risk_penalty >= 12, asset.risk_penalty * 4, "elevated volatility penalty"),
            (asset.macro_score <= 40, 100 - asset.macro_score, "macro headwind is still present"),
            (asset.news_score <= 44, 100 - asset.news_score, "headline flow is not helping"),
        ]
    else:
        positives = [
            (asset.trend_score >= 70 and context.get("above_sma200", False), asset.trend_score, "healthy long-term trend structure"),
            (asset.asset_type != "EQUITY" or asset.fundamental_score >= 65, asset.fundamental_score, "strong fundamentals support the long-term case"),
            (safe_float(context.get("distance_to_high"), np.nan) <= 0.08 and safe_float(context.get("ret_6m"), np.nan) > 0, 80 - safe_float(context.get("distance_to_high"), 0) * 100, "price is trading near the 52-week high"),
            (asset.macro_score >= 58, asset.macro_score, "macro backdrop supports the long-term view"),
            (safe_float(context.get("drawdown_quality"), np.nan) >= 65, safe_float(context.get("drawdown_quality"), 50), "drawdown profile is manageable"),
        ]
        negatives = [
            (asset.trend_score <= 45 or not context.get("above_sma200", False), 100 - asset.trend_score, "price is below long-term trend support"),
            (asset.asset_type == "EQUITY" and asset.fundamental_score < 45, 100 - asset.fundamental_score, "poor fundamentals weaken the long-term case"),
            (safe_float(context.get("ret_1y"), np.nan) <= -0.05, 100 - safe_float(context.get("long_return_score"), 50), "long-term momentum is weak"),
            (asset.risk_penalty >= 12, asset.risk_penalty * 4, "risk profile remains elevated"),
            (safe_float(context.get("drawdown_quality"), np.nan) <= 40, 100 - safe_float(context.get("drawdown_quality"), 50), "drawdown history is still heavy"),
        ]

    return build_reason_text(positives, negatives, action)


def apply_horizon_recommendations(asset: RankedAsset, context: dict[str, float | bool]) -> None:
    # Keep the horizon logic separate from the base composite score so the dashboard can show each view directly.
    short_score = clamp_score(
        (asset.momentum_score * 0.30)
        + (asset.breakout_score * 0.20)
        + (asset.relative_volume_score * 0.15)
        + (asset.avwap_score * 0.10)
        + (safe_float(context.get("short_return_score"), 50) * 0.10)
        + (asset.news_score * 0.10)
        + (asset.macro_score * 0.05)
        + (safe_float(context.get("proximity_score"), 50) * 0.05)
        - asset.risk_penalty
    )
    mid_score = clamp_score(
        (asset.trend_score * 0.26)
        + (asset.momentum_score * 0.18)
        + (asset.breakout_score * 0.14)
        + (asset.avwap_score * 0.10)
        + (safe_float(context.get("mid_return_score"), 50) * 0.12)
        + (asset.macro_score * 0.10)
        + (asset.fundamental_score * 0.06)
        + (asset.news_score * 0.04)
        - (asset.risk_penalty * 0.80)
    )
    long_score = clamp_score(
        (asset.trend_score * 0.24)
        + (asset.fundamental_score * 0.22)
        + (asset.quality_score * 0.10)
        + (asset.growth_score * 0.10)
        + (asset.valuation_score * 0.06)
        + (asset.macro_score * 0.12)
        + (safe_float(context.get("long_return_score"), 50) * 0.10)
        + (safe_float(context.get("drawdown_quality"), 50) * 0.06)
        + (safe_float(context.get("proximity_score"), 50) * 0.05)
        - (asset.risk_penalty * 0.55)
    )

    asset.short_score = round(short_score, 2)
    asset.mid_score = round(mid_score, 2)
    asset.long_score = round(long_score, 2)
    asset.short_action = action_from_horizon_score("short", short_score, asset, context)
    asset.mid_action = action_from_horizon_score("mid", mid_score, asset, context)
    asset.long_action = action_from_horizon_score("long", long_score, asset, context)
    asset.composite_action = action_from_index(score_to_action_index((short_score + mid_score + long_score) / 3.0))
    asset.short_reason = derive_horizon_reason("short", asset, context, asset.short_action)
    asset.mid_reason = derive_horizon_reason("mid", asset, context, asset.mid_action)
    asset.long_reason = derive_horizon_reason("long", asset, context, asset.long_action)

    best_horizon = max(
        [
            ("short-term", asset.short_score, asset.short_reason),
            ("mid-term", asset.mid_score, asset.mid_reason),
            ("long-term", asset.long_score, asset.long_reason),
        ],
        key=lambda item: item[1],
    )
    asset.selection_reason = f"{best_horizon[0].title()}: {best_horizon[2]}"


def extract_detail_fundamentals(info: dict) -> dict[str, object]:
    return {
        "market_cap": safe_float(info.get("marketCap"), np.nan),
        "trailing_pe": safe_float(info.get("trailingPE"), np.nan),
        "forward_pe": safe_float(info.get("forwardPE"), np.nan),
        "revenue_growth": safe_float(info.get("revenueGrowth"), np.nan),
        "earnings_growth": safe_float(info.get("earningsGrowth"), np.nan),
        "gross_margin": safe_float(info.get("grossMargins"), np.nan),
        "operating_margin": safe_float(info.get("operatingMargins"), np.nan),
        "profit_margin": safe_float(info.get("profitMargins"), np.nan),
        "debt_to_equity": safe_float(info.get("debtToEquity"), np.nan),
        "return_on_equity": safe_float(info.get("returnOnEquity"), np.nan),
        "long_business_summary": safe_str(info.get("longBusinessSummary")),
        "website": safe_str(info.get("website")),
    }


def symbol_slug(symbol: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_", "."} else "_" for char in symbol)


def to_jsonable(value):
    if isinstance(value, dict):
        return {key: to_jsonable(val) for key, val in value.items()}
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [to_jsonable(item) for item in value]
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return None if pd.isna(value) else float(value)
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    return value


def save_symbol_detail_outputs(
    ranked_assets: list[RankedAsset],
    price_map: dict[str, pd.DataFrame],
    info_cache: dict[str, dict],
    outdir: Path,
) -> None:
    # These per-symbol artifacts keep the dashboard simple and avoid refetching the same price/fundamental data on every click.
    symbols_dir = outdir / "symbols"
    symbols_dir.mkdir(parents=True, exist_ok=True)
    updated_at = datetime.now(timezone.utc).isoformat()

    for asset in ranked_assets:
        symbol_dir = symbols_dir / symbol_slug(asset.symbol)
        symbol_dir.mkdir(parents=True, exist_ok=True)

        price_df = price_map.get(asset.symbol)
        if price_df is not None and not price_df.empty:
            history_df = price_df.reset_index().rename(columns={"Date": "date"})
            history_df.to_csv(symbol_dir / "history.csv", index=False)

        payload = {
            "symbol": asset.symbol,
            "updated_at_utc": updated_at,
            "summary": asdict(asset),
            "fundamentals": extract_detail_fundamentals(info_cache.get(asset.symbol, {})),
        }
        (symbol_dir / "summary.json").write_text(json.dumps(to_jsonable(payload), indent=2), encoding="utf-8")


# -----------------------------
# Core engine
# -----------------------------

def scan_symbols(
    symbols: list[str],
    top_n: int = TOP_N,
    news_limit: int = DEFAULT_NEWS_LIMIT,
    skip_news: bool = False,
    outdir: Optional[Path] = None,
) -> pd.DataFrame:
    print(f"[1/5] Downloading price history for {len(symbols)} symbols...")
    price_map = batch_download(symbols, DOWNLOAD_PERIOD)

    print("[2/5] Downloading macro proxies...")
    macro_price_map = batch_download(list(dict.fromkeys(MACRO_SYMBOLS.values())), DOWNLOAD_PERIOD)
    macro_closes: dict[str, pd.Series] = {}
    for name, sym in MACRO_SYMBOLS.items():
        df = macro_price_map.get(sym)
        if df is not None and not df.empty:
            macro_closes[name] = df["Close"]

    regime = compute_macro_regime(macro_closes)

    ranked: list[RankedAsset] = []
    info_cache: dict[str, dict] = {}
    horizon_context_cache: dict[str, dict[str, float | bool]] = {}
    ema20_cache: dict[str, float] = {}
    sma50_cache: dict[str, float] = {}
    macd_cache: dict[str, tuple[float, float]] = {}

    print("[3/5] Scoring symbols...")
    for i, symbol in enumerate(symbols, start=1):
        df = price_map.get(symbol)
        if df is None or df.empty or len(df) < 220:
            continue

        close = df["Close"].dropna()
        if close.empty:
            continue

        last_price = safe_float(close.iloc[-1], np.nan)
        avg_dollar_volume = safe_float((df["Close"].iloc[-20:] * df["Volume"].iloc[-20:]).mean(), np.nan)

        if np.isnan(last_price) or last_price < MIN_PRICE:
            continue
        if np.isnan(avg_dollar_volume) or avg_dollar_volume < MIN_AVG_DOLLAR_VOL:
            continue

        info = fetch_info(symbol)
        info_cache[symbol] = info
        asset_type = infer_asset_type(symbol, info)
        sector = infer_sector(symbol, asset_type, info)
        industry = safe_str(info.get("industry"))
        market_cap = safe_float(info.get("marketCap"), np.nan)

        if asset_type == "EQUITY" and (np.isnan(market_cap) or market_cap < MIN_MARKET_CAP):
            continue

        technical = technical_scorecard(df)
        earnings_date = parse_earnings_date(info)
        fundamentals = fundamentals_scorecard(info, asset_type)
        macro_score, macro_sensitivity, macro_note = score_macro_alignment(symbol, asset_type, sector, regime)

        macd_series = macd_hist(close)
        current_macd = safe_float(macd_series.iloc[-1], np.nan)
        previous_macd = safe_float(macd_series.iloc[-2], np.nan) if len(macd_series) >= 2 else np.nan
        risk_penalty, ann_vol, atr_pct, dd_pct = compute_risk_penalty(
            df,
            technical["current_rsi"],
            current_macd,
            previous_macd,
            earnings_date,
            asset_type,
        )

        news_score = 50.0
        headline_bias = "not yet enriched"
        upside_driver = derive_upside_driver(
            technical["technical_score"],
            safe_float(fundamentals["fundamental_score"]),
            news_score,
            macro_score,
        )
        key_risk = derive_key_risk(
            asset_type,
            technical["current_rsi"],
            current_macd,
            previous_macd,
            risk_penalty,
            earnings_date,
            "",
        )

        final_score = composite_score(
            asset_type,
            technical["technical_score"],
            safe_float(fundamentals["fundamental_score"]),
            news_score,
            macro_score,
            risk_penalty,
        )
        rating = rating_from_score(final_score)

        ema20_value = safe_float(ema(close, 20).iloc[-1])
        sma50_value = safe_float(sma(close, 50).iloc[-1])
        ema20_cache[symbol] = ema20_value
        sma50_cache[symbol] = sma50_value
        macd_cache[symbol] = (current_macd, previous_macd)
        horizon_context = build_horizon_context(df, technical, dd_pct)
        horizon_context_cache[symbol] = horizon_context

        asset = RankedAsset(
            symbol=symbol,
            asset_type=asset_type,
            sector=sector,
            industry=industry,
            price=round(last_price, 4),
            market_cap=round(market_cap, 2) if not np.isnan(market_cap) else np.nan,
            avg_dollar_volume=round(avg_dollar_volume, 2),
            dividend_yield=round(safe_float(info.get("dividendYield")), 2) if not np.isnan(safe_float(info.get("dividendYield"))) else np.nan,
            earnings_date=earnings_date,
            technical_score=round(technical["technical_score"], 2),
            trend_score=technical["trend_score"],
            supertrend_score=technical["supertrend_score"],
            momentum_score=technical["momentum_score"],
            breakout_score=technical["breakout_score"],
            relative_volume_score=technical["relative_volume_score"],
            avwap_score=technical["avwap_score"],
            fundamental_score=safe_float(fundamentals["fundamental_score"]),
            quality_score=safe_float(fundamentals["quality_score"]),
            growth_score=safe_float(fundamentals["growth_score"]),
            valuation_score=safe_float(fundamentals["valuation_score"]),
            news_score=round(news_score, 2),
            macro_score=round(macro_score, 2),
            risk_penalty=round(risk_penalty, 2),
            final_score=round(final_score, 2),
            short_score=np.nan,
            mid_score=np.nan,
            long_score=np.nan,
            rating=rating,
            setup_type=derive_setup_type(
                technical,
                last_price,
                technical["avwap_swing"],
                technical["supertrend_line"],
            ),
            short_action="WAIT / HOLD",
            mid_action="WAIT / HOLD",
            long_action="WAIT / HOLD",
            composite_action="WAIT / HOLD",
            short_reason="",
            mid_reason="",
            long_reason="",
            selection_reason="",
            entry_zone=derive_entry_zone(
                last_price,
                ema20_value,
                technical["avwap_ytd"],
                technical["avwap_swing"],
            ),
            invalidation_level=derive_invalidation_level(
                sma50_value,
                technical["supertrend_line"],
                technical["avwap_swing"],
            ),
            upside_driver=upside_driver,
            key_risk=key_risk,
            profitability_status=safe_str(fundamentals["profitability_status"]),
            valuation_flag=safe_str(fundamentals["valuation_flag"]),
            trailing_pe=safe_float(info.get("trailingPE"), np.nan),
            forward_pe=safe_float(info.get("forwardPE"), np.nan),
            revenue_growth=safe_float(info.get("revenueGrowth"), np.nan),
            earnings_growth=safe_float(info.get("earningsGrowth"), np.nan),
            gross_margin=safe_float(info.get("grossMargins"), np.nan),
            operating_margin=safe_float(info.get("operatingMargins"), np.nan),
            profit_margin=safe_float(info.get("profitMargins"), np.nan),
            debt_to_equity=safe_float(info.get("debtToEquity"), np.nan),
            return_on_equity=safe_float(info.get("returnOnEquity"), np.nan),
            macro_sensitivity=macro_sensitivity,
            confidence_level=derive_confidence_level(
                asset_type,
                technical["technical_score"],
                safe_float(fundamentals["fundamental_score"]),
                macro_score,
                news_score,
                risk_penalty,
            ),
            macro_note=macro_note,
            headline_bias=headline_bias,
            current_rsi=technical["current_rsi"],
            current_macd_hist=technical["current_macd_hist"],
            atr_pct=atr_pct,
            annualized_volatility=ann_vol,
            max_drawdown=dd_pct,
        )
        apply_horizon_recommendations(asset, horizon_context)
        ranked.append(asset)

        if i % 15 == 0:
            print(f"    scored {i}/{len(symbols)}...")
        time.sleep(0.03)

    if not ranked:
        return pd.DataFrame()

    print("[4/5] Enriching top names with headline / event context...")
    ranked.sort(key=lambda asset: asset.final_score, reverse=True)
    if not skip_news and news_limit > 0:
        for asset in ranked[: min(news_limit, len(ranked))]:
            if asset.asset_type not in {"EQUITY", "CRYPTO", "CRYPTO_PROXY"}:
                asset.headline_bias = "skipped for asset type"
                continue
            news_score, headline_bias, top_event, headline_risk = fetch_recent_news_score(asset.symbol)
            current_macd, previous_macd = macd_cache.get(asset.symbol, (np.nan, np.nan))
            asset.news_score = round(news_score, 2)
            asset.headline_bias = headline_bias
            asset.upside_driver = top_event or derive_upside_driver(
                asset.technical_score,
                asset.fundamental_score,
                asset.news_score,
                asset.macro_score,
            )
            asset.key_risk = derive_key_risk(
                asset.asset_type,
                asset.current_rsi,
                current_macd,
                previous_macd,
                asset.risk_penalty,
                asset.earnings_date,
                headline_risk,
            )
            asset.final_score = round(
                composite_score(
                    asset.asset_type,
                    asset.technical_score,
                    asset.fundamental_score,
                    asset.news_score,
                    asset.macro_score,
                    asset.risk_penalty,
                ),
                2,
            )
            asset.rating = rating_from_score(asset.final_score)
            asset.confidence_level = derive_confidence_level(
                asset.asset_type,
                asset.technical_score,
                asset.fundamental_score,
                asset.macro_score,
                asset.news_score,
                asset.risk_penalty,
            )
            apply_horizon_recommendations(asset, horizon_context_cache.get(asset.symbol, {}))

    print("[5/5] Building ranking table...")
    df_rank = pd.DataFrame([asdict(x) for x in ranked])
    if df_rank.empty:
        return df_rank

    df_rank = df_rank.sort_values(
        by=["final_score", "technical_score", "macro_score"],
        ascending=[False, False, False],
    ).reset_index(drop=True)

    if outdir is not None:
        save_symbol_detail_outputs(ranked, price_map, info_cache, outdir)

    return df_rank


def load_universe_from_csv(path: str) -> list[str]:
    df = pd.read_csv(path)
    for col in ["symbol", "ticker", "Symbol", "Ticker"]:
        if col in df.columns:
            values = [str(x).strip().upper() for x in df[col].dropna().tolist()]
            return list(dict.fromkeys(values))
    raise ValueError("CSV must include one of these columns: symbol, ticker, Symbol, Ticker")


def print_top_table(df_rank: pd.DataFrame, top_n: int):
    if df_rank.empty:
        print("No ranked symbols found.")
        return

    top = df_rank.head(top_n).copy()
    display = top[
        [
            "symbol",
            "asset_type",
            "sector",
            "price",
            "technical_score",
            "fundamental_score",
            "news_score",
            "macro_score",
            "risk_penalty",
            "final_score",
            "short_action",
            "mid_action",
            "long_action",
            "setup_type",
            "rating",
        ]
    ].copy()

    print("\nTOP CANDIDATES")
    print(display.to_string(index=False))


def save_snapshot(df_rank: pd.DataFrame, outdir: Path, snapshot_time: Optional[datetime] = None) -> Path:
    history_dir = outdir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)

    snapshot_time = snapshot_time or datetime.now(timezone.utc)
    timestamp_str = snapshot_time.strftime("%Y%m%d_%H%M%S")
    snapshot_path = history_dir / f"scan_{timestamp_str}.csv"

    snapshot_df = df_rank.copy()
    snapshot_df.insert(0, "timestamp_utc", snapshot_time.isoformat())
    snapshot_df.to_csv(snapshot_path, index=False)
    return snapshot_path


def load_snapshot_history(history_dir: str) -> pd.DataFrame:
    history_path = Path(history_dir)
    files = sorted(history_path.glob("scan_*.csv"))
    if not files:
        return pd.DataFrame()

    frames: list[pd.DataFrame] = []
    for path in files:
        try:
            df = pd.read_csv(path)
        except Exception:
            continue
        if df.empty:
            continue
        if "timestamp_utc" not in df.columns:
            inferred = path.stem.replace("scan_", "")
            try:
                ts = datetime.strptime(inferred, "%Y%m%d_%H%M%S").replace(tzinfo=timezone.utc)
                df.insert(0, "timestamp_utc", ts.isoformat())
            except Exception:
                continue
        df["source_file"] = path.name
        frames.append(df)

    if not frames:
        return pd.DataFrame()

    history_df = pd.concat(frames, ignore_index=True)
    history_df["timestamp_utc"] = pd.to_datetime(history_df["timestamp_utc"], utc=True, errors="coerce")
    history_df = history_df.dropna(subset=["timestamp_utc", "symbol", "price"]).copy()
    history_df["symbol"] = history_df["symbol"].astype(str).str.upper()
    history_df["price"] = pd.to_numeric(history_df["price"], errors="coerce")
    history_df = history_df.dropna(subset=["price"])
    history_df = history_df.sort_values(["timestamp_utc", "symbol"]).reset_index(drop=True)
    return history_df


def score_bucket_label(score: float) -> str:
    if pd.isna(score):
        return "unknown"
    if score >= 80:
        return "80+"
    if score >= 70:
        return "70-79"
    if score >= 60:
        return "60-69"
    if score >= 50:
        return "50-59"
    return "<50"


def compute_forward_returns(history_dir: str) -> pd.DataFrame:
    history_df = load_snapshot_history(history_dir)
    analysis_dir = Path(history_dir).parent / "analysis"
    analysis_dir.mkdir(parents=True, exist_ok=True)
    forward_path = analysis_dir / "forward_returns.csv"

    output_columns = [
        "timestamp_utc",
        "symbol",
        "asset_type",
        "sector",
        "rating",
        "setup_type",
        "final_score",
        "score_bucket",
        "forward_5d",
        "forward_10d",
        "forward_20d",
        "forward_60d",
    ]

    if history_df.empty:
        pd.DataFrame(columns=output_columns).to_csv(forward_path, index=False)
        return pd.DataFrame(columns=output_columns)

    history_df["score_bucket"] = history_df["final_score"].apply(score_bucket_label)

    symbols = sorted(history_df["symbol"].dropna().unique().tolist())
    min_date = history_df["timestamp_utc"].min().date() - timedelta(days=7)
    max_date = history_df["timestamp_utc"].max().date() + timedelta(days=120)

    print(f"[analysis 1/2] Downloading forward price history for {len(symbols)} symbols...")
    price_map = batch_download(
        symbols,
        start=min_date.isoformat(),
        end=max_date.isoformat(),
    )

    horizons = {
        "forward_5d": 5,
        "forward_10d": 10,
        "forward_20d": 20,
        "forward_60d": 60,
    }

    rows: list[dict[str, object]] = []
    for row in history_df.itertuples(index=False):
        symbol = row.symbol
        price_df = price_map.get(symbol)
        if price_df is None or price_df.empty:
            continue

        close = price_df["Close"].dropna()
        if close.empty:
            continue

        trade_dates = pd.to_datetime(close.index, utc=True).tz_localize(None).normalize()
        snapshot_date = pd.Timestamp(row.timestamp_utc).tz_convert("UTC").tz_localize(None).normalize()
        entry_pos = trade_dates.searchsorted(snapshot_date)
        if entry_pos >= len(close):
            continue

        entry_price = safe_float(row.price)
        if np.isnan(entry_price) or entry_price <= 0:
            continue

        result = {
            "timestamp_utc": pd.Timestamp(row.timestamp_utc).isoformat(),
            "symbol": symbol,
            "asset_type": getattr(row, "asset_type", ""),
            "sector": getattr(row, "sector", ""),
            "rating": getattr(row, "rating", ""),
            "setup_type": getattr(row, "setup_type", ""),
            "final_score": safe_float(getattr(row, "final_score", np.nan)),
            "score_bucket": getattr(row, "score_bucket", "unknown"),
        }

        for col_name, horizon in horizons.items():
            future_pos = entry_pos + horizon
            if future_pos >= len(close):
                result[col_name] = np.nan
                continue
            future_price = safe_float(close.iloc[future_pos])
            result[col_name] = round((future_price / entry_price) - 1.0, 6) if future_price > 0 else np.nan

        if any(pd.notna(result[col]) for col in horizons):
            rows.append(result)

    forward_df = pd.DataFrame(rows, columns=output_columns)
    forward_df.attrs["analysis_dir"] = str(analysis_dir)
    forward_df.to_csv(forward_path, index=False)
    return forward_df


def summarize_group_performance(df: pd.DataFrame, group_col: str, horizons: list[str]) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    if df.empty or group_col not in df.columns:
        return pd.DataFrame()

    for group_value, group_df in df.groupby(group_col, dropna=False):
        label = safe_str(group_value, "unknown") or "unknown"
        for horizon in horizons:
            valid = group_df[horizon].dropna()
            if valid.empty:
                continue
            negatives = valid[valid < 0]
            rows.append(
                {
                    "group_type": group_col,
                    "group_value": label,
                    "horizon": horizon.replace("forward_", ""),
                    "count": int(valid.count()),
                    "avg_return": round(valid.mean(), 6),
                    "median_return": round(valid.median(), 6),
                    "hit_rate": round((valid > 0).mean(), 6),
                    "avg_negative_return": round(negatives.mean(), 6) if not negatives.empty else np.nan,
                    "min_return": round(valid.min(), 6),
                }
            )
    return pd.DataFrame(rows)


def print_performance_section(summary_df: pd.DataFrame, group_type: str, title: str):
    section = summary_df[summary_df["group_type"] == group_type].copy()
    if section.empty:
        print(f"\n=== {title} ===")
        print("No completed forward-return observations yet.")
        return

    rows: list[dict[str, object]] = []
    for group_value, group_df in section.groupby("group_value"):
        item = {"label": group_value}
        for horizon in ["5d", "10d", "20d", "60d"]:
            horizon_df = group_df[group_df["horizon"] == horizon]
            if horizon_df.empty:
                item[f"avg_{horizon}"] = np.nan
                item[f"hit_{horizon}"] = np.nan
                item[f"n_{horizon}"] = 0
                continue
            row = horizon_df.iloc[0]
            item[f"avg_{horizon}"] = row["avg_return"]
            item[f"hit_{horizon}"] = row["hit_rate"]
            item[f"n_{horizon}"] = int(row["count"])
        rows.append(item)

    display = pd.DataFrame(rows).sort_values("label").reset_index(drop=True)
    percent_cols = [col for col in display.columns if col.startswith("avg_") or col.startswith("hit_")]
    for col in percent_cols:
        display[col] = display[col].apply(lambda x: f"{x * 100:.2f}%" if pd.notna(x) else "-")

    print(f"\n=== {title} ===")
    print(display.to_string(index=False))


def analyze_performance(forward_returns_df: pd.DataFrame) -> pd.DataFrame:
    analysis_dir = Path(forward_returns_df.attrs.get("analysis_dir", "scanner_output/analysis"))
    analysis_dir.mkdir(parents=True, exist_ok=True)

    horizons = ["forward_5d", "forward_10d", "forward_20d", "forward_60d"]
    summary_frames = [
        summarize_group_performance(forward_returns_df, "rating", horizons),
        summarize_group_performance(forward_returns_df, "setup_type", horizons),
        summarize_group_performance(forward_returns_df, "asset_type", horizons),
        summarize_group_performance(forward_returns_df, "score_bucket", horizons),
    ]
    summary_df = pd.concat([df for df in summary_frames if not df.empty], ignore_index=True) if any(not df.empty for df in summary_frames) else pd.DataFrame(
        columns=["group_type", "group_value", "horizon", "count", "avg_return", "median_return", "hit_rate", "avg_negative_return", "min_return"]
    )

    summary_path = analysis_dir / "performance_summary.csv"
    summary_df.to_csv(summary_path, index=False)

    print_performance_section(summary_df, "rating", "PERFORMANCE BY RATING")
    print_performance_section(summary_df, "setup_type", "PERFORMANCE BY SETUP")
    print_performance_section(summary_df, "asset_type", "PERFORMANCE BY ASSET TYPE")
    print_performance_section(summary_df, "score_bucket", "PERFORMANCE BY SCORE BUCKET")

    print(f"\nSaved performance summary to: {summary_path}")
    return summary_df


def main():
    global MIN_PRICE, MIN_AVG_DOLLAR_VOL, MIN_MARKET_CAP

    parser = argparse.ArgumentParser(description="Practical multi-asset ranking scanner")
    parser.add_argument("--universe-csv", help="Optional CSV with symbol/ticker column")
    parser.add_argument("--top", type=int, default=20, help="Number of top results to show")
    parser.add_argument("--outdir", default="scanner_output", help="Output directory")
    parser.add_argument("--min-price", type=float, default=MIN_PRICE)
    parser.add_argument("--min-dollar-volume", type=float, default=MIN_AVG_DOLLAR_VOL)
    parser.add_argument("--min-market-cap", type=float, default=MIN_MARKET_CAP)
    parser.add_argument("--news-limit", type=int, default=DEFAULT_NEWS_LIMIT, help="How many top names to enrich with recent headlines")
    parser.add_argument("--skip-news", action="store_true", help="Skip headline / event enrichment")
    parser.add_argument("--run-analysis", action="store_true", help="Compute forward returns and performance summaries from saved history")
    parser.add_argument("--save-history", dest="save_history", action="store_true", help="Save a timestamped snapshot after each scan")
    parser.add_argument("--no-save-history", dest="save_history", action="store_false", help="Do not save a timestamped snapshot")
    parser.add_argument("--send-alerts", action="store_true", help="Send Telegram alerts for new high-conviction signals")
    parser.set_defaults(save_history=True)
    args = parser.parse_args()

    MIN_PRICE = args.min_price
    MIN_AVG_DOLLAR_VOL = args.min_dollar_volume
    MIN_MARKET_CAP = args.min_market_cap

    if args.universe_csv:
        universe = load_universe_from_csv(args.universe_csv)
    else:
        universe = DEFAULT_UNIVERSE

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    df_rank = scan_symbols(universe, top_n=args.top, news_limit=args.news_limit, skip_news=args.skip_news, outdir=outdir)
    if df_rank.empty:
        print("No results. Try lowering filters or changing the universe.")
        sys.exit(1)

    full_path = outdir / "full_ranking.csv"
    top_path = outdir / "top_candidates.csv"
    history_path = None

    df_rank.to_csv(full_path, index=False)
    df_rank.head(args.top).to_csv(top_path, index=False)

    if args.save_history:
        history_path = save_snapshot(df_rank, outdir)

    print_top_table(df_rank, args.top)

    print(f"\nSaved full ranking to: {full_path}")
    print(f"Saved top {args.top} to: {top_path}")
    if history_path is not None:
        print(f"Saved scan snapshot to: {history_path}")

    if args.send_alerts:
        process_telegram_alerts(df_rank, outdir)

    if args.run_analysis:
        history_dir = outdir / "history"
        forward_df = compute_forward_returns(str(history_dir))
        if forward_df.empty:
            print("\nNo completed forward-return observations yet.")
        else:
            print(f"\nComputed forward returns for {len(forward_df)} snapshot rows.")
        analyze_performance(forward_df)

    print("\nImportant:")
    print("- This is a ranking engine, not financial advice or a prediction guarantee.")
    print("- Headline and macro layers are intentionally simple and can be wrong.")
    print("- AVWAP uses objective anchors (YTD and recent swing low) rather than hand-picked discretionary anchors.")
    print("- VPVR is intentionally not included because Yahoo daily bars are not reliable enough for it.")
    print("- Historical evaluation is useful, but it is not survivorship-free or point-in-time perfect.")


if __name__ == "__main__":
    main()
