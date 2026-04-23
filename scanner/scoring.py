from __future__ import annotations

from collections.abc import Sequence

import numpy as np
import pandas as pd

from .config import (
    ACTION_LEVELS,
    BOND_PROXIES,
    COMMODITY_PROXIES,
    CRYPTO_PROXY_ETFS,
    CURRENCY_PROXIES,
    ETF_SECTOR_MAP,
    LOOKBACK_1M,
    LOOKBACK_3M,
    LOOKBACK_6M,
    LOOKBACK_1Y,
)
from .models import RankedAsset
from .utils import (
    anchored_vwap,
    annualized_volatility,
    atr,
    clamp_score,
    days_until,
    ema,
    first_index_of_year,
    macd_hist,
    max_drawdown,
    pct_change,
    rsi,
    safe_float,
    safe_str,
    series_trend_score,
    slope_percent,
    sma,
)


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
        final_upper.iloc[i] = upper.iloc[i] if upper.iloc[i] < final_upper.iloc[i - 1] or prev_close > final_upper.iloc[i - 1] else final_upper.iloc[i - 1]
        final_lower.iloc[i] = lower.iloc[i] if lower.iloc[i] > final_lower.iloc[i - 1] or prev_close < final_lower.iloc[i - 1] else final_lower.iloc[i - 1]

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
    score += 25 if direction > 0 else -20

    if not np.isnan(line):
        score += 15 if last > line else -15

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
    recent_close_values = pd.to_numeric(recent_window["Close"], errors="coerce").to_numpy(dtype=float)
    swing_low_pos = max(0, len(df) - 63 + int(np.argmin(recent_close_values)))

    avwap_ytd = anchored_vwap(df, ytd_pos)
    avwap_swing = anchored_vwap(df, swing_low_pos)
    ytd_val = safe_float(avwap_ytd.iloc[-1])
    swing_val = safe_float(avwap_swing.iloc[-1])

    score = 50.0
    if not np.isnan(ytd_val):
        score += 15 if last > ytd_val else -12
    if not np.isnan(swing_val):
        score += 20 if last > swing_val else -18

    if not (np.isnan(ytd_val) and np.isnan(swing_val)):
        active_anchor = max(v for v in [ytd_val, swing_val] if not np.isnan(v))
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


def infer_asset_type(symbol: str, info: dict[str, object]) -> str:
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


def infer_sector(symbol: str, asset_type: str, info: dict[str, object]) -> str:
    sector = safe_str(info.get("sector"))
    if sector:
        return sector
    if asset_type != "EQUITY":
        return ETF_SECTOR_MAP.get(symbol, asset_type.replace("_", " ").title())
    return "Unknown"


def score_quality(info: dict[str, object]) -> float:
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


def score_growth(info: dict[str, object]) -> float:
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


def score_valuation(info: dict[str, object]) -> float:
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


def infer_profitability_status(info: dict[str, object]) -> str:
    net = safe_float(info.get("profitMargins"))
    fcf = safe_float(info.get("freeCashflow"))
    earnings_growth = safe_float(info.get("earningsGrowth"))

    if not np.isnan(net) and net > 0 and not np.isnan(fcf) and fcf > 0:
        return "profitable / growing" if not np.isnan(earnings_growth) and earnings_growth > 0 else "profitable"
    if not np.isnan(fcf) and fcf > 0:
        return "cash generative"
    if not np.isnan(net) and net <= 0:
        return "loss-making"
    return "mixed"


def infer_valuation_flag(info: dict[str, object]) -> str:
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


def fundamentals_scorecard(info: dict[str, object], asset_type: str) -> dict[str, float | str]:
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


def compute_vix_stress(vix_series: pd.Series | None) -> float:
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

    risk_on = clamp_score((spx_tr * 0.25) + (qqq_tr * 0.25) + (iwm_tr * 0.15) + (hyg_tr * 0.15) + ((100 - dxy_tr) * 0.10) + ((100 - vix_stress) * 0.10))
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
        score += (risk_on - 50) * 0.60 + (50 - dollar_strength) * 0.20 + (safe_float(regime.get("btc_trend"), 50) - 50) * 0.20
        if risk_on >= 60:
            drivers.append("risk appetite supportive")
        if dollar_strength >= 60:
            drivers.append("strong dollar is a headwind")
    elif asset_type == "CRYPTO_PROXY":
        sensitivity = "crypto beta"
        score += (risk_on - 50) * 0.45 + (safe_float(regime.get("btc_trend"), 50) - 50) * 0.35 + (50 - dollar_strength) * 0.20
    elif asset_type == "COMMODITY_PROXY":
        if symbol in {"GLD", "SLV"}:
            sensitivity = "dollar / stress hedge"
            score += (50 - dollar_strength) * 0.35 + (defensive_bid - 50) * 0.35 + (gold_trend - 50) * 0.30
        elif symbol == "USO":
            sensitivity = "oil-sensitive"
            score += (oil_trend - 50) * 0.65 + (risk_on - 50) * 0.15 - max(0, dollar_strength - 60) * 0.15
        if oil_trend >= 60 and symbol == "USO":
            drivers.append("oil trend supportive")
        if defensive_bid >= 60 and symbol in {"GLD", "SLV"}:
            drivers.append("defensive bid supportive")
    elif asset_type == "BOND_PROXY":
        sensitivity = "duration / credit"
        if symbol == "TLT":
            score += (bond_trend - 50) * 0.70 - (dollar_strength - 50) * 0.10
        else:
            score += (credit_trend - 50) * 0.55 + (risk_on - 50) * 0.20 - max(0, vix_stress - 55) * 0.20
    elif asset_type == "FX_PROXY":
        sensitivity = "dollar"
        score = dollar_strength
        if dollar_strength >= 60:
            drivers.append("dollar trend supportive")
    elif sector in {"Technology", "Communication Services", "Semiconductors", "Growth / Nasdaq", "High Beta Growth"}:
        sensitivity = "rates-sensitive growth"
        score += (qqq_trend - 50) * 0.45 + (risk_on - 50) * 0.20 - (rates_pressure - 50) * 0.35 - (dollar_strength - 50) * 0.15
    elif sector in {"Energy", "Oil"}:
        sensitivity = "oil-sensitive"
        score += (oil_trend - 50) * 0.55 + (risk_on - 50) * 0.15
    elif sector in {"Financial Services", "Banks", "Insurance"}:
        sensitivity = "rates / credit"
        score += (credit_trend - 50) * 0.35 + (risk_on - 50) * 0.20 - max(0, vix_stress - 60) * 0.25
    elif sector in {"Consumer Defensive", "Healthcare", "Utilities", "Real Estate"}:
        sensitivity = "defensive / rates"
        score += (defensive_bid - 50) * 0.20 + (risk_on - 50) * 0.10 - (rates_pressure - 50) * 0.15
    else:
        sensitivity = "equity beta"
        score += (risk_on - 50) * 0.45 - (dollar_strength - 50) * 0.15

    if rates_pressure >= 60 and "rates" in sensitivity:
        drivers.append("rates backdrop matters")
    if risk_on >= 60 and sensitivity in {"equity beta", "rates-sensitive growth", "crypto beta"}:
        drivers.append("risk-on supportive")
    if vix_stress >= 65:
        drivers.append("volatility backdrop is a risk")
    return clamp_score(score), sensitivity, ", ".join(drivers[:3]) or safe_str(regime.get("macro_note"))


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


def composite_score(asset_type: str, technical_score: float, fundamental_score: float, news_score: float, macro_score: float, risk_penalty: float) -> float:
    weights = score_weights(asset_type)
    base = technical_score * weights["technical"] + fundamental_score * weights["fundamental"] + news_score * weights["news"] + macro_score * weights["macro"]
    return clamp_score(base - risk_penalty)


def derive_setup_type(technical: dict[str, float], price: float, avwap_swing: float, supertrend_line: float) -> str:
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
        return f"{price:.2f}" if not np.isnan(price) else "-"
    center = float(np.mean(anchors[-2:]))
    return f"{center * 0.99:.2f}-{center * 1.01:.2f}"


def derive_invalidation_level(sma50_value: float, supertrend_line: float, avwap_swing: float) -> str:
    candidates = [v for v in [sma50_value, supertrend_line, avwap_swing] if not np.isnan(v)]
    return f"{min(candidates):.2f}" if candidates else "-"


def derive_upside_driver(technical_score: float, fundamental_score: float, news_score: float, macro_score: float) -> str:
    driver_map = {
        "technical breakout": technical_score,
        "fundamental quality": fundamental_score,
        "headline / event flow": news_score,
        "macro tailwind": macro_score,
    }
    return max(driver_map.items(), key=lambda item: item[1])[0]


def derive_key_risk(asset_type: str, current_rsi: float, current_macd: float, previous_macd: float, risk_penalty: float, earnings_date: str, headline_risk: str) -> str:
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


def derive_confidence_level(asset_type: str, technical_score: float, fundamental_score: float, macro_score: float, news_score: float, risk_penalty: float) -> str:
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


def compute_risk_penalty(df: pd.DataFrame, current_rsi: float, current_macd: float, previous_macd: float, earnings_date: str, asset_type: str) -> tuple[float, float, float, float]:
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
        "long_return_score": clamp_score((return_to_score(ret_6m, upside_scale=130, downside_scale=120) * 0.55) + (return_to_score(ret_1y, upside_scale=105, downside_scale=95) * 0.45)),
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
        if bool(context.get("rsi_overbought", False)) and asset.breakout_score < 55:
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


def rank_reason_candidates(candidates: Sequence[tuple[bool, float, str]]) -> list[tuple[float, str]]:
    filtered = [(weight, text) for keep, weight, text in candidates if keep and text]
    return sorted(filtered, key=lambda item: item[0], reverse=True)


def build_reason_text(
    positive_candidates: Sequence[tuple[bool, float, str]],
    negative_candidates: Sequence[tuple[bool, float, str]],
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
            (asset.trend_score >= 70 and bool(context.get("above_sma200", False)), asset.trend_score, "healthy long-term trend structure"),
            (asset.asset_type != "EQUITY" or asset.fundamental_score >= 65, asset.fundamental_score, "strong fundamentals support the long-term case"),
            (safe_float(context.get("distance_to_high"), np.nan) <= 0.08 and safe_float(context.get("ret_6m"), np.nan) > 0, 80 - safe_float(context.get("distance_to_high"), 0) * 100, "price is trading near the 52-week high"),
            (asset.macro_score >= 58, asset.macro_score, "macro backdrop supports the long-term view"),
            (safe_float(context.get("drawdown_quality"), np.nan) >= 65, safe_float(context.get("drawdown_quality"), 50), "drawdown profile is manageable"),
        ]
        negatives = [
            (asset.trend_score <= 45 or not bool(context.get("above_sma200", False)), 100 - asset.trend_score, "price is below long-term trend support"),
            (asset.asset_type == "EQUITY" and asset.fundamental_score < 45, 100 - asset.fundamental_score, "poor fundamentals weaken the long-term case"),
            (safe_float(context.get("ret_1y"), np.nan) <= -0.05, 100 - safe_float(context.get("long_return_score"), 50), "long-term momentum is weak"),
            (asset.risk_penalty >= 12, asset.risk_penalty * 4, "risk profile remains elevated"),
            (safe_float(context.get("drawdown_quality"), np.nan) <= 40, 100 - safe_float(context.get("drawdown_quality"), 50), "drawdown history is still heavy"),
        ]
    return build_reason_text(positives, negatives, action)


def apply_horizon_recommendations(asset: RankedAsset, context: dict[str, float | bool]) -> None:
    # Keep the scoring separate so it is easier to test without touching I/O.
    short_score = clamp_score((asset.momentum_score * 0.30) + (asset.breakout_score * 0.20) + (asset.relative_volume_score * 0.15) + (asset.avwap_score * 0.10) + (safe_float(context.get("short_return_score"), 50) * 0.10) + (asset.news_score * 0.10) + (asset.macro_score * 0.05) + (safe_float(context.get("proximity_score"), 50) * 0.05) - asset.risk_penalty)
    mid_score = clamp_score((asset.trend_score * 0.26) + (asset.momentum_score * 0.18) + (asset.breakout_score * 0.14) + (asset.avwap_score * 0.10) + (safe_float(context.get("mid_return_score"), 50) * 0.12) + (asset.macro_score * 0.10) + (asset.fundamental_score * 0.06) + (asset.news_score * 0.04) - (asset.risk_penalty * 0.80))
    long_score = clamp_score((asset.trend_score * 0.24) + (asset.fundamental_score * 0.22) + (asset.quality_score * 0.10) + (asset.growth_score * 0.10) + (asset.valuation_score * 0.06) + (asset.macro_score * 0.12) + (safe_float(context.get("long_return_score"), 50) * 0.10) + (safe_float(context.get("drawdown_quality"), 50) * 0.06) + (safe_float(context.get("proximity_score"), 50) * 0.05) - (asset.risk_penalty * 0.55))

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
    best_horizon = max([("short-term", asset.short_score, asset.short_reason), ("mid-term", asset.mid_score, asset.mid_reason), ("long-term", asset.long_score, asset.long_reason)], key=lambda item: item[1])
    asset.selection_reason = f"{best_horizon[0].title()}: {best_horizon[2]}"


def extract_detail_fundamentals(info: dict[str, object]) -> dict[str, object]:
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
