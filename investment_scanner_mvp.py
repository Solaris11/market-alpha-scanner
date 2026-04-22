
#!/usr/bin/env python3
"""
investment_scanner_mvp.py

MVP market scanner:
- Scans a configurable universe of equities, ETFs, crypto proxies, and commodity proxies
- Filters low-quality/noisy symbols
- Computes technical, momentum, volatility, and simple macro-alignment scores
- Produces a ranked Top 20 "STRONG BUY" candidate list
- Saves full ranking + top 20 to CSV

Notes:
- This is a scoring engine, not a guarantee engine.
- "Explosion score" is a composite opportunity score, not a true probability.
- Uses Yahoo Finance via yfinance for practicality in an MVP.
- BTC, Gold, Oil are represented with market proxies by default:
    BTC-USD, GLD, USO
- Dow/Nasdaq/SP500 components are seeded with a curated liquid list in this MVP.
  You can replace UNIVERSE with your own CSV or API-fed universe later.
"""

from __future__ import annotations

import argparse
import math
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

import numpy as np
import pandas as pd

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
    "dxy_proxy": "UUP",
    "bonds": "TLT",
    "high_yield": "HYG",
    "gold": "GLD",
    "oil": "USO",
    "btc": "BTC-USD",
}

MIN_PRICE = 5.0
MIN_AVG_DOLLAR_VOL = 20_000_000  # 20M USD/day approximate
MIN_MARKET_CAP = 1_000_000_000   # 1B
LOOKBACK_1M = 21
LOOKBACK_3M = 63
LOOKBACK_6M = 126
LOOKBACK_1Y = 252
DOWNLOAD_PERIOD = "2y"
TOP_N = 20


# -----------------------------
# Utility indicators
# -----------------------------

def safe_float(x, default=np.nan):
    try:
        if x is None:
            return default
        return float(x)
    except Exception:
        return default


def pct_change(series: pd.Series, periods: int) -> float:
    if len(series) <= periods:
        return np.nan
    old = float(series.iloc[-periods - 1])
    new = float(series.iloc[-1])
    if old == 0:
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
    hist = macd_line - signal
    return hist


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


def clamp_score(value: float, low: float = 0, high: float = 100) -> float:
    if np.isnan(value):
        return 0.0
    return float(max(low, min(high, value)))


# -----------------------------
# Scoring helpers
# -----------------------------

def score_trend(close: pd.Series) -> float:
    last = float(close.iloc[-1])
    ma20 = safe_float(sma(close, 20).iloc[-1])
    ma50 = safe_float(sma(close, 50).iloc[-1])
    ma200 = safe_float(sma(close, 200).iloc[-1])

    score = 0.0
    if last > ma20:
        score += 20
    if last > ma50:
        score += 25
    if last > ma200:
        score += 30
    if ma20 > ma50:
        score += 10
    if ma50 > ma200:
        score += 15
    return clamp_score(score)


def score_momentum(close: pd.Series) -> float:
    r1 = pct_change(close, LOOKBACK_1M)
    r3 = pct_change(close, LOOKBACK_3M)
    r6 = pct_change(close, LOOKBACK_6M)

    # Weighted momentum
    raw = 50 + (r1 * 120) + (r3 * 90) + (r6 * 70)
    return clamp_score(raw)


def score_breakout(close: pd.Series) -> float:
    last = float(close.iloc[-1])
    if len(close) < 60:
        return 0.0
    high_3m = float(close.iloc[-63:].max())
    high_1y = float(close.iloc[-252:].max()) if len(close) >= 252 else float(close.max())

    score = 0.0
    if last >= high_3m * 0.99:
        score += 45
    if last >= high_1y * 0.95:
        score += 35
    dist = (high_1y - last) / high_1y if high_1y else np.nan
    if not np.isnan(dist):
        score += max(0, 20 - dist * 100)
    return clamp_score(score)


def score_rsi_macd(close: pd.Series) -> float:
    current_rsi = safe_float(rsi(close, 14).iloc[-1], 50)
    current_macd_hist = safe_float(macd_hist(close).iloc[-1], 0)
    prev_macd_hist = safe_float(macd_hist(close).iloc[-2], 0) if len(close) > 2 else 0

    score = 0.0
    # Prefer healthy trend RSI, not too overheated
    if 52 <= current_rsi <= 68:
        score += 45
    elif 45 <= current_rsi < 52 or 68 < current_rsi <= 75:
        score += 30
    elif current_rsi > 75:
        score += 10
    else:
        score += 15

    if current_macd_hist > 0:
        score += 25
    if current_macd_hist > prev_macd_hist:
        score += 30

    return clamp_score(score)


def score_volume(df: pd.DataFrame) -> float:
    if len(df) < 30:
        return 0.0
    recent_vol = float(df["Volume"].iloc[-1])
    avg20 = float(df["Volume"].iloc[-20:].mean())
    if avg20 <= 0:
        return 0.0
    ratio = recent_vol / avg20
    # 1.0 => 40, 1.5 => 70, 2.0 => 100 approx
    score = 40 + (ratio - 1.0) * 60
    return clamp_score(score)


def score_risk(df: pd.DataFrame) -> tuple[float, float]:
    close = df["Close"]
    vol = annualized_volatility(close, 63)
    dd = max_drawdown(close, 252)
    atr_ratio = safe_float(atr(df, 14).iloc[-1] / close.iloc[-1], np.nan)

    penalty = 0.0

    if not np.isnan(vol):
        if vol > 0.70:
            penalty += 35
        elif vol > 0.50:
            penalty += 22
        elif vol > 0.35:
            penalty += 10

    if not np.isnan(dd):
        if dd < -0.50:
            penalty += 30
        elif dd < -0.35:
            penalty += 18
        elif dd < -0.20:
            penalty += 8

    if not np.isnan(atr_ratio):
        if atr_ratio > 0.08:
            penalty += 20
        elif atr_ratio > 0.05:
            penalty += 10

    risk_score = clamp_score(100 - penalty)
    return risk_score, penalty


def score_fundamentals(info: dict, asset_type: str) -> float:
    # For ETFs/crypto/direct commodity proxies, keep neutral-simple
    if asset_type in {"ETF", "CRYPTO", "COMMODITY_PROXY"}:
        return 55.0

    market_cap = safe_float(info.get("marketCap"))
    pe = safe_float(info.get("forwardPE"))
    revenue_growth = safe_float(info.get("revenueGrowth"))
    earnings_growth = safe_float(info.get("earningsGrowth"))
    operating_margin = safe_float(info.get("operatingMargins"))
    debt_to_equity = safe_float(info.get("debtToEquity"))

    score = 50.0

    if not np.isnan(market_cap):
        if market_cap > 100_000_000_000:
            score += 10
        elif market_cap > 10_000_000_000:
            score += 6

    if not np.isnan(revenue_growth):
        score += min(15, max(-10, revenue_growth * 50))

    if not np.isnan(earnings_growth):
        score += min(15, max(-12, earnings_growth * 40))

    if not np.isnan(operating_margin):
        score += min(10, max(-8, operating_margin * 30))

    if not np.isnan(pe):
        if 8 <= pe <= 35:
            score += 8
        elif pe > 80:
            score -= 10

    if not np.isnan(debt_to_equity):
        if debt_to_equity < 80:
            score += 6
        elif debt_to_equity > 200:
            score -= 8

    return clamp_score(score)


def infer_asset_type(symbol: str, info: dict) -> str:
    q = str(info.get("quoteType", "")).upper()
    if symbol.endswith("-USD"):
        return "CRYPTO"
    if q in {"ETF"}:
        return "ETF"
    if symbol in {"GLD", "SLV", "USO"}:
        return "COMMODITY_PROXY"
    return "EQUITY"


def compute_macro_regime(macro_closes: dict[str, pd.Series]) -> dict[str, float]:
    """
    Simple macro regime approximation.
    Positive for risk-on when SPY/QQQ trend up and TLT not collapsing badly.
    Slight positives for gold/oil/BTC when their own trends are supportive.
    """
    result = {
        "risk_on": 50.0,
        "equity_tailwind": 50.0,
        "commodity_tailwind": 50.0,
        "crypto_tailwind": 50.0,
    }

    spy = macro_closes.get("spx")
    qqq = macro_closes.get("qqq")
    tlt = macro_closes.get("bonds")
    uup = macro_closes.get("dxy_proxy")
    gold = macro_closes.get("gold")
    oil = macro_closes.get("oil")
    btc = macro_closes.get("btc")

    def trend_strength(series: Optional[pd.Series]) -> float:
        if series is None or len(series) < 200:
            return 50.0
        return score_trend(series)

    spx_tr = trend_strength(spy)
    qqq_tr = trend_strength(qqq)
    tlt_tr = trend_strength(tlt)
    dxy_tr = trend_strength(uup)
    gold_tr = trend_strength(gold)
    oil_tr = trend_strength(oil)
    btc_tr = trend_strength(btc)

    risk_on = (spx_tr * 0.4) + (qqq_tr * 0.4) + ((100 - dxy_tr) * 0.1) + (tlt_tr * 0.1)
    result["risk_on"] = clamp_score(risk_on)
    result["equity_tailwind"] = clamp_score((spx_tr * 0.45) + (qqq_tr * 0.35) + ((100 - dxy_tr) * 0.20))
    result["commodity_tailwind"] = clamp_score((gold_tr * 0.4) + (oil_tr * 0.4) + ((100 - dxy_tr) * 0.2))
    result["crypto_tailwind"] = clamp_score((btc_tr * 0.55) + (qqq_tr * 0.25) + (result["risk_on"] * 0.20))
    return result


# -----------------------------
# Data access
# -----------------------------

def normalize_symbol_for_download(symbol: str) -> str:
    # yfinance usually accepts BRK-B as BRK-B, keep as-is
    return symbol


def batch_download(symbols: list[str], period: str = DOWNLOAD_PERIOD) -> dict[str, pd.DataFrame]:
    out = {}
    # Batch download keeps request count lower
    joined = " ".join(normalize_symbol_for_download(s) for s in symbols)
    raw = yf.download(
        tickers=joined,
        period=period,
        interval="1d",
        auto_adjust=True,
        progress=False,
        group_by="ticker",
        threads=True,
    )

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
    else:
        # Single symbol fallback
        if len(symbols) == 1:
            out[symbols[0]] = raw.dropna(how="all").copy()

    return out


def fetch_info(symbol: str) -> dict:
    try:
        t = yf.Ticker(symbol)
        info = t.info or {}
        return info
    except Exception:
        return {}


# -----------------------------
# Core engine
# -----------------------------

@dataclass
class RankedAsset:
    symbol: str
    asset_type: str
    price: float
    market_cap: float
    avg_dollar_volume: float
    trend_score: float
    momentum_score: float
    breakout_score: float
    rsi_macd_score: float
    volume_score: float
    fundamentals_score: float
    macro_score: float
    risk_score: float
    risk_penalty: float
    total_score: float
    explosion_score: float
    rating: str
    note: str


def rating_from_score(score: float) -> str:
    if score >= 80:
        return "STRONG BUY"
    if score >= 65:
        return "BUY"
    if score >= 50:
        return "WATCH"
    return "PASS"


def build_note(asset_type: str, total: float, explosion: float, trend: float, momentum: float, macro: float) -> str:
    tags = []
    if trend >= 75:
        tags.append("strong trend")
    if momentum >= 75:
        tags.append("high momentum")
    if macro >= 65:
        tags.append("macro tailwind")
    if explosion >= 75:
        tags.append("breakout candidate")
    if total >= 80 and not tags:
        tags.append("broad strength")
    if asset_type == "CRYPTO":
        tags.append("higher risk")
    return ", ".join(tags[:4]) or "mixed setup"


def scan_symbols(symbols: list[str], top_n: int = TOP_N) -> pd.DataFrame:
    print(f"[1/4] Downloading price history for {len(symbols)} symbols...")
    price_map = batch_download(symbols, DOWNLOAD_PERIOD)

    print("[2/4] Downloading macro proxies...")
    macro_price_map = batch_download(list(MACRO_SYMBOLS.values()), DOWNLOAD_PERIOD)
    macro_closes = {}
    for name, sym in MACRO_SYMBOLS.items():
        df = macro_price_map.get(sym)
        if df is not None and not df.empty:
            macro_closes[name] = df["Close"]

    macro_regime = compute_macro_regime(macro_closes)

    ranked: list[RankedAsset] = []

    print("[3/4] Scoring symbols...")
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
        asset_type = infer_asset_type(symbol, info)
        market_cap = safe_float(info.get("marketCap"), np.nan)

        # Keep crypto/ETF proxies even without market cap
        if asset_type == "EQUITY":
            if np.isnan(market_cap) or market_cap < MIN_MARKET_CAP:
                continue

        trend = score_trend(close)
        momentum = score_momentum(close)
        breakout = score_breakout(close)
        rsi_macd = score_rsi_macd(close)
        vol_score = score_volume(df)
        fundamentals = score_fundamentals(info, asset_type)
        risk_score, risk_penalty = score_risk(df)

        if asset_type == "EQUITY" or asset_type == "ETF":
            macro_score = macro_regime["equity_tailwind"]
        elif asset_type == "CRYPTO":
            macro_score = macro_regime["crypto_tailwind"]
        else:
            macro_score = macro_regime["commodity_tailwind"]

        total_score = (
            trend * 0.24
            + momentum * 0.22
            + breakout * 0.12
            + rsi_macd * 0.10
            + vol_score * 0.07
            + fundamentals * 0.15
            + macro_score * 0.10
            + risk_score * 0.10
            - risk_penalty * 0.20
        )
        total_score = clamp_score(total_score)

        explosion_score = clamp_score(
            breakout * 0.30
            + vol_score * 0.18
            + momentum * 0.22
            + trend * 0.15
            + macro_score * 0.15
        )

        rating = rating_from_score(total_score)
        note = build_note(asset_type, total_score, explosion_score, trend, momentum, macro_score)

        ranked.append(
            RankedAsset(
                symbol=symbol,
                asset_type=asset_type,
                price=round(last_price, 4),
                market_cap=round(market_cap, 2) if not np.isnan(market_cap) else np.nan,
                avg_dollar_volume=round(avg_dollar_volume, 2),
                trend_score=round(trend, 2),
                momentum_score=round(momentum, 2),
                breakout_score=round(breakout, 2),
                rsi_macd_score=round(rsi_macd, 2),
                volume_score=round(vol_score, 2),
                fundamentals_score=round(fundamentals, 2),
                macro_score=round(macro_score, 2),
                risk_score=round(risk_score, 2),
                risk_penalty=round(risk_penalty, 2),
                total_score=round(total_score, 2),
                explosion_score=round(explosion_score, 2),
                rating=rating,
                note=note,
            )
        )

        if i % 15 == 0:
            print(f"    scored {i}/{len(symbols)}...")

        # tiny sleep to be nice with info calls
        time.sleep(0.03)

    print("[4/4] Building ranking table...")
    df_rank = pd.DataFrame([x.__dict__ for x in ranked])
    if df_rank.empty:
        return df_rank

    df_rank = df_rank.sort_values(
        by=["total_score", "explosion_score", "momentum_score"],
        ascending=[False, False, False],
    ).reset_index(drop=True)

    return df_rank


def load_universe_from_csv(path: str) -> list[str]:
    df = pd.read_csv(path)
    for col in ["symbol", "ticker", "Symbol", "Ticker"]:
        if col in df.columns:
            values = [str(x).strip().upper() for x in df[col].dropna().tolist()]
            return list(dict.fromkeys(values))
    raise ValueError("CSV must include one of these columns: symbol, ticker, Symbol, Ticker")


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


def print_top_table(df_rank: pd.DataFrame, top_n: int):
    if df_rank.empty:
        print("No ranked symbols found.")
        return

    top = df_rank.head(top_n).copy()
    display = top[[
        "symbol", "asset_type", "price", "total_score", "explosion_score",
        "momentum_score", "trend_score", "macro_score", "rating", "note"
    ]].copy()

    print("\nTOP CANDIDATES")
    print(display.to_string(index=False))


def main():
    global MIN_PRICE, MIN_AVG_DOLLAR_VOL, MIN_MARKET_CAP
    parser = argparse.ArgumentParser(description="Multi-asset ranking scanner MVP")
    parser.add_argument("--universe-csv", help="Optional CSV with symbol/ticker column")
    parser.add_argument("--top", type=int, default=20, help="Number of top results to show")
    parser.add_argument("--outdir", default="scanner_output", help="Output directory")
    parser.add_argument("--min-price", type=float, default=MIN_PRICE)
    parser.add_argument("--min-dollar-volume", type=float, default=MIN_AVG_DOLLAR_VOL)
    parser.add_argument("--min-market-cap", type=float, default=MIN_MARKET_CAP)
    args = parser.parse_args()

    # Update globals with command line arguments
    MIN_PRICE = args.min_price
    MIN_AVG_DOLLAR_VOL = args.min_dollar_volume
    MIN_MARKET_CAP = args.min_market_cap

    if args.universe_csv:
        universe = load_universe_from_csv(args.universe_csv)
    else:
        universe = DEFAULT_UNIVERSE

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    df_rank = scan_symbols(universe, top_n=args.top)
    if df_rank.empty:
        print("No results. Try lowering filters or changing the universe.")
        sys.exit(1)

    full_path = outdir / "full_ranking.csv"
    top_path = outdir / "top_candidates.csv"

    df_rank.to_csv(full_path, index=False)
    df_rank.head(args.top).to_csv(top_path, index=False)

    print_top_table(df_rank, args.top)

    print(f"\nSaved full ranking to: {full_path}")
    print(f"Saved top {args.top} to: {top_path}")
    print("\nImportant:")
    print("- This output is a ranking model, not financial advice.")
    print("- 'Explosion score' is a composite opportunity score, not a guaranteed probability.")
    print("- Best next step: add backtesting before trusting this with real capital.")


if __name__ == "__main__":
    main()
