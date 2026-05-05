from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, TypedDict

import numpy as np
import pandas as pd

from .data_fetch import batch_download
from .safety import utc_now
from .utils import safe_float

StandardRegime = Literal["BULL", "NEUTRAL", "OVERHEATED", "RISK_OFF", "BEAR"]


class RegimePolicy(TypedDict):
    adjusted_thresholds: dict[str, float]
    adjusted_weights: dict[str, float]
    impact_text: str
    reason_codes: list[str]
    regime: StandardRegime
    raw_regime: str


REGIME_PROXIES = {
    "spy": "SPY",
    "qqq": "QQQ",
    "dia": "DIA",
    "vix": "^VIX",
    "tlt": "TLT",
    "uup": "UUP",
}
BASE_REGIME_THRESHOLDS: dict[str, float] = {
    "buy_score": 80.0,
    "watch_score": 50.0,
    "confidence": 70.0,
}
BASE_REGIME_WEIGHTS: dict[str, float] = {
    "trend": 1.0,
    "momentum": 1.0,
    "breakout": 1.0,
    "risk": 1.0,
    "volatility": 1.0,
    "macro": 1.0,
    "data_quality": 1.0,
}


def _numeric(value: object) -> float | None:
    parsed = safe_float(value, np.nan)
    return None if np.isnan(parsed) else parsed


def _rsi(close: pd.Series, period: int = 14) -> float | None:
    clean = pd.to_numeric(close, errors="coerce").dropna()
    if len(clean) <= period:
        return None
    delta = clean.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    latest = 100 - (100 / (1 + rs.iloc[-1]))
    return _numeric(latest)


def _close_series(df: pd.DataFrame | None) -> pd.Series:
    if df is None or df.empty or "Close" not in df.columns:
        return pd.Series(dtype=float)
    return pd.to_numeric(df["Close"], errors="coerce").dropna()


def _proxy_snapshot(df: pd.DataFrame | None) -> dict[str, Any]:
    close = _close_series(df)
    if close.empty:
        return {
            "price": None,
            "ma20": None,
            "ma50": None,
            "ma200": None,
            "rsi14": None,
            "pct_above_ma20": None,
            "trend": "UNKNOWN",
        }

    price = _numeric(close.iloc[-1])
    ma20 = _numeric(close.rolling(20).mean().iloc[-1]) if len(close) >= 20 else None
    ma50 = _numeric(close.rolling(50).mean().iloc[-1]) if len(close) >= 50 else None
    ma200 = _numeric(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else None
    pct_above_ma20 = (price / ma20 - 1.0) if price is not None and ma20 not in (None, 0) else None

    if price is not None and ma50 is not None and ma200 is not None:
        if price > ma50 > ma200:
            trend = "UP"
        elif price < ma50 < ma200:
            trend = "DOWN"
        elif price < ma50 and price < ma200:
            trend = "DOWN"
        else:
            trend = "MIXED"
    else:
        trend = "UNKNOWN"

    return {
        "price": price,
        "ma20": ma20,
        "ma50": ma50,
        "ma200": ma200,
        "rsi14": _rsi(close),
        "pct_above_ma20": pct_above_ma20,
        "trend": trend,
    }


def _vix_snapshot(df: pd.DataFrame | None) -> dict[str, Any]:
    close = _close_series(df)
    if close.empty:
        return {"price": None, "ma10": None, "ma20": None, "trend": "unknown"}
    price = _numeric(close.iloc[-1])
    ma10 = _numeric(close.rolling(10).mean().iloc[-1]) if len(close) >= 10 else None
    ma20 = _numeric(close.rolling(20).mean().iloc[-1]) if len(close) >= 20 else None
    if price is not None and ma10 is not None and ma20 is not None:
        trend = "rising" if price > ma10 > ma20 else "falling" if price < ma10 < ma20 else "stable"
    else:
        trend = "unknown"
    return {"price": price, "ma10": ma10, "ma20": ma20, "trend": trend}


def _trend_is_above(snapshot: dict[str, Any]) -> bool:
    price = snapshot.get("price")
    ma50 = snapshot.get("ma50")
    ma200 = snapshot.get("ma200")
    return isinstance(price, (int, float)) and isinstance(ma50, (int, float)) and isinstance(ma200, (int, float)) and price > ma50 and price > ma200


def _trend_is_below(snapshot: dict[str, Any]) -> bool:
    price = snapshot.get("price")
    ma50 = snapshot.get("ma50")
    ma200 = snapshot.get("ma200")
    return isinstance(price, (int, float)) and isinstance(ma50, (int, float)) and isinstance(ma200, (int, float)) and price < ma50 and price < ma200


def _near_ma50(snapshot: dict[str, Any]) -> bool:
    price = snapshot.get("price")
    ma50 = snapshot.get("ma50")
    if not isinstance(price, (int, float)) or not isinstance(ma50, (int, float)) or ma50 == 0:
        return False
    return abs(price / ma50 - 1.0) <= 0.025


def detect_market_regime(price_map: dict[str, pd.DataFrame] | None = None) -> dict[str, Any]:
    if price_map is None:
        price_map = batch_download(list(REGIME_PROXIES.values()), period="2y")

    spy = _proxy_snapshot(price_map.get("SPY"))
    qqq = _proxy_snapshot(price_map.get("QQQ"))
    dia = _proxy_snapshot(price_map.get("DIA"))
    tlt = _proxy_snapshot(price_map.get("TLT"))
    uup = _proxy_snapshot(price_map.get("UUP"))
    vix_df = price_map.get("^VIX")
    if vix_df is None:
        vix_df = price_map.get("VIX")
    vix = _vix_snapshot(vix_df)

    spy_rsi = spy.get("rsi14")
    qqq_rsi = qqq.get("rsi14")
    max_rsi = max([value for value in (spy_rsi, qqq_rsi) if isinstance(value, (int, float))], default=None)
    spy_over_ma20 = spy.get("pct_above_ma20")
    qqq_over_ma20 = qqq.get("pct_above_ma20")
    max_above_ma20 = max([value for value in (spy_over_ma20, qqq_over_ma20) if isinstance(value, (int, float))], default=None)

    spy_up = _trend_is_above(spy)
    qqq_up = _trend_is_above(qqq)
    spy_down = _trend_is_below(spy)
    qqq_down = _trend_is_below(qqq)
    vix_trend = str(vix.get("trend") or "unknown")

    if (spy_down or qqq_down) and vix_trend == "rising":
        regime = "RISK_OFF"
    elif (max_rsi is not None and max_rsi > 70) or (max_above_ma20 is not None and max_above_ma20 >= 0.05):
        regime = "OVERHEATED"
    elif (_near_ma50(spy) or _near_ma50(qqq)) and any(isinstance(value, (int, float)) and 40 <= value <= 55 for value in (spy_rsi, qqq_rsi)):
        regime = "PULLBACK"
    elif spy_up and qqq_up and all(isinstance(value, (int, float)) and 50 <= value <= 70 for value in (spy_rsi, qqq_rsi)) and vix_trend in {"stable", "falling"}:
        regime = "RISK_ON"
    elif spy_down or qqq_down:
        regime = "RISK_OFF"
    elif spy_up and qqq_up:
        regime = "RISK_ON"
    else:
        regime = "PULLBACK"

    trend = "UP" if spy_up and qqq_up else "DOWN" if spy_down or qqq_down else "MIXED"
    confidence = 45
    if regime in {"RISK_ON", "RISK_OFF"}:
        confidence += 20
    if vix_trend in {"rising", "falling", "stable"}:
        confidence += 10
    if max_rsi is not None:
        confidence += 10
    if spy.get("ma200") is not None and qqq.get("ma200") is not None:
        confidence += 10
    confidence = int(max(0, min(100, confidence)))

    payload: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "regime": regime,
        "raw_regime": regime,
        "trend": trend,
        "confidence": confidence,
        "spy": spy,
        "qqq": qqq,
        "dia": dia,
        "vix": vix,
        "tlt": tlt,
        "uup": uup,
    }
    payload["regime"] = standardize_regime(payload)
    return payload


def standardize_regime(regime_payload: dict[str, Any] | None) -> StandardRegime:
    payload = regime_payload or {}
    raw_regime = str(payload.get("regime") or payload.get("raw_regime") or "").strip().upper()
    trend = str(payload.get("trend") or "").strip().upper()
    vix_payload = payload.get("vix")
    vix_trend = ""
    if isinstance(vix_payload, dict):
        vix_trend = str(vix_payload.get("trend") or "").strip().lower()

    if raw_regime in {"BULL", "RISK_ON"}:
        return "BULL"
    if raw_regime == "OVERHEATED":
        return "OVERHEATED"
    if raw_regime == "BEAR":
        return "BEAR"
    if raw_regime == "RISK_OFF":
        return "BEAR" if trend == "DOWN" and vix_trend == "rising" else "RISK_OFF"
    if raw_regime in {"PULLBACK", "NEUTRAL", "MIXED"}:
        return "NEUTRAL"
    return "NEUTRAL"


def regime_policy(regime_payload: dict[str, Any] | None) -> RegimePolicy:
    payload = regime_payload or {}
    raw_regime = str(payload.get("raw_regime") or payload.get("regime") or "UNKNOWN").strip().upper() or "UNKNOWN"
    regime = standardize_regime(regime_payload)
    adjusted_weights = dict(BASE_REGIME_WEIGHTS)
    adjusted_thresholds = dict(BASE_REGIME_THRESHOLDS)
    reason_codes: list[str] = []

    if regime == "BULL":
        adjusted_weights.update({"momentum": 1.05, "breakout": 1.04, "risk": 0.98})
        reason_codes.append("REGIME_BULL_MODE")
        impact_text = "Bull regime: scanner allows constructive momentum and structure to count, while risk gates remain active."
    elif regime == "OVERHEATED":
        adjusted_weights.update({"breakout": 0.85, "risk": 1.25, "volatility": 1.25})
        adjusted_thresholds.update({"buy_score": 85.0, "watch_score": 55.0, "confidence": 75.0})
        reason_codes.extend(["REGIME_OVERHEATED_FILTER", "BREAKOUT_IMPACT_REDUCED", "RISK_FILTER_INCREASED"])
        impact_text = "Overheated market: scanner is reducing breakout signals and increasing risk filters."
    elif regime == "RISK_OFF":
        adjusted_weights.update({"breakout": 0.8, "risk": 1.3, "data_quality": 1.2})
        adjusted_thresholds.update({"buy_score": 90.0, "watch_score": 60.0, "confidence": 80.0})
        reason_codes.extend(["REGIME_RISK_OFF_STRICT", "DATA_QUALITY_FILTER_INCREASED"])
        impact_text = "Risk-off market: scanner requires stronger confirmation and is filtering weaker setups."
    elif regime == "BEAR":
        adjusted_weights.update({"breakout": 0.7, "risk": 1.35, "data_quality": 1.2})
        adjusted_thresholds.update({"buy_score": 92.0, "watch_score": 60.0, "confidence": 82.0})
        reason_codes.extend(["REGIME_BEAR_DEFENSIVE", "BREAKOUT_BUY_DISABLED"])
        impact_text = "Bear regime: scanner is disabling breakout-style buy intent and emphasizing risk controls."
    else:
        reason_codes.append("REGIME_NEUTRAL_BALANCED")
        impact_text = "Neutral regime: scanner is using balanced scoring and standard risk filters."

    return {
        "adjusted_thresholds": adjusted_thresholds,
        "adjusted_weights": adjusted_weights,
        "impact_text": impact_text,
        "reason_codes": reason_codes,
        "regime": regime,
        "raw_regime": raw_regime,
    }


def regime_adjustment_for_row(row: dict[str, Any] | pd.Series, regime_payload: dict[str, Any] | None) -> float:
    policy = regime_policy(regime_payload)
    regime = policy["regime"]
    setup_type = str(row.get("setup_type", "") if hasattr(row, "get") else "").lower()
    entry_text = " ".join(
        str(row.get(column, "") if hasattr(row, "get") else "")
        for column in ("trade_quality", "trade_quality_note", "target_warning")
    ).upper()
    entry_status = str(row.get("entry_status", "") if hasattr(row, "get") else "").upper()
    momentum_score = safe_float(row.get("momentum_score", np.nan) if hasattr(row, "get") else np.nan, np.nan)
    breakout_score = safe_float(row.get("breakout_score", np.nan) if hasattr(row, "get") else np.nan, np.nan)
    data_quality_score = safe_float(row.get("data_quality_score", 100.0) if hasattr(row, "get") else 100.0, 100.0)
    risk_penalty = safe_float(row.get("risk_penalty", 0.0) if hasattr(row, "get") else 0.0, 0.0)
    atr_pct = safe_float(row.get("atr_pct", np.nan) if hasattr(row, "get") else np.nan, np.nan)
    annualized_volatility = safe_float(row.get("annualized_volatility", np.nan) if hasattr(row, "get") else np.nan, np.nan)

    if regime == "BULL":
        momentum_bonus = max(0.0, momentum_score - 65.0) * 0.03 if not np.isnan(momentum_score) else 0.0
        breakout_bonus = max(0.0, breakout_score - 70.0) * 0.02 if not np.isnan(breakout_score) else 0.0
        risk_drag = min(1.0, max(0.0, risk_penalty) * 0.04)
        return round(_clamp(momentum_bonus + breakout_bonus - risk_drag, -2.0, 2.0), 2)
    if regime == "OVERHEATED":
        adjustment = -3.0
        adjustment -= max(0.0, breakout_score - 60.0) * 0.03 if not np.isnan(breakout_score) else 0.0
        adjustment -= max(0.0, risk_penalty) * 0.12
        if entry_status == "OVEREXTENDED" or "EXTENDED" in entry_text or "LOW EDGE" in entry_text:
            adjustment -= 3.0
        if _elevated_volatility(annualized_volatility, atr_pct):
            adjustment -= 2.0
        return round(_clamp(adjustment, -14.0, 0.0), 2)
    if regime == "RISK_OFF":
        adjustment = -6.0
        adjustment -= max(0.0, breakout_score - 55.0) * 0.03 if not np.isnan(breakout_score) else 0.0
        adjustment -= max(0.0, 75.0 - data_quality_score) * 0.08
        adjustment -= max(0.0, risk_penalty) * 0.18
        if entry_status == "OVEREXTENDED" or "EXTENDED" in entry_text or "LOW EDGE" in entry_text:
            adjustment -= 2.0
        return round(_clamp(adjustment, -18.0, 0.0), 2)
    if regime == "BEAR":
        adjustment = -8.0
        adjustment -= max(0.0, risk_penalty) * 0.2
        adjustment -= max(0.0, 75.0 - data_quality_score) * 0.1
        if "breakout" in setup_type:
            adjustment -= 4.0
        return round(_clamp(adjustment, -22.0, 0.0), 2)
    return 0.0


def apply_regime_adjustments(df: pd.DataFrame, regime_payload: dict[str, Any] | None) -> pd.DataFrame:
    if df.empty:
        return df
    working = df.copy()
    policy = regime_policy(regime_payload)
    adjustments = working.apply(lambda row: regime_adjustment_for_row(row, regime_payload), axis=1)
    base_scores = pd.to_numeric(working["final_score"], errors="coerce")
    adjusted_scores = (base_scores + adjustments).clip(lower=0, upper=100).round(2)
    working["market_regime_raw"] = policy["raw_regime"]
    working["market_regime"] = policy["regime"]
    working["regime_adjustment"] = adjustments.round(2)
    working["final_score_base"] = base_scores.round(2)
    working["final_score_adjusted"] = adjusted_scores
    working["final_score"] = adjusted_scores
    working["rating"] = adjusted_scores.apply(_rating_from_score)
    working["regime_adjustment_applied"] = policy["regime"] != "NEUTRAL"
    working["adjusted_weights"] = pd.Series([policy["adjusted_weights"] for _ in range(len(working))], index=working.index, dtype="object")
    working["adjusted_thresholds"] = pd.Series([policy["adjusted_thresholds"] for _ in range(len(working))], index=working.index, dtype="object")
    working["regime_reason_codes"] = pd.Series([_regime_reason_codes_for_row(row, policy) for _, row in working.iterrows()], index=working.index, dtype="object")
    working["regime_impact"] = policy["impact_text"]
    return working


def _regime_reason_codes_for_row(row: pd.Series, policy: RegimePolicy) -> list[str]:
    codes = list(policy["reason_codes"])
    regime = policy["regime"]
    entry_status = str(row.get("entry_status", "")).upper()
    setup_type = str(row.get("setup_type", "")).lower()
    data_quality_score = safe_float(row.get("data_quality_score"), 100.0)
    if regime == "OVERHEATED" and entry_status == "OVEREXTENDED":
        codes.append("OVERHEATED_OVEREXTENDED_HARD_VETO")
    if regime == "BEAR" and "breakout" in setup_type:
        codes.append("BEAR_BREAKOUT_BUY_DISABLED")
    if regime in {"RISK_OFF", "BEAR"} and data_quality_score < 75.0:
        codes.append("REGIME_DATA_QUALITY_PENALTY")
    return _unique_codes(codes)


def _rating_from_score(score: object) -> str:
    value = safe_float(score, np.nan)
    if np.isnan(value):
        return "PASS"
    if value >= 80.0:
        return "TOP"
    if value >= 65.0:
        return "ACTIONABLE"
    if value >= 50.0:
        return "WATCH"
    return "PASS"


def _elevated_volatility(annualized_volatility: float, atr_pct: float) -> bool:
    return (not np.isnan(annualized_volatility) and annualized_volatility >= 0.45) or (not np.isnan(atr_pct) and atr_pct >= 5.0)


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _unique_codes(codes: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for code in codes:
        if code and code not in seen:
            seen.add(code)
            unique.append(code)
    return unique


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return None if np.isnan(value) or not np.isfinite(value) else float(value)
    if value is None:
        return None
    return value


def write_market_regime(outdir: Path, regime_payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = regime_payload or detect_market_regime()
    analysis_dir = outdir / "analysis"
    analysis_dir.mkdir(parents=True, exist_ok=True)
    path = analysis_dir / "market_regime.json"
    tmp_path = path.with_name(f"{path.name}.{os.getpid()}.{utc_now().timestamp():.6f}.tmp")
    try:
        tmp_path.write_text(json.dumps(_json_safe(payload), indent=2, sort_keys=True), encoding="utf-8")
        tmp_path.replace(path)
    finally:
        tmp_path.unlink(missing_ok=True)
    return payload


def read_market_regime(outdir: Path) -> dict[str, Any] | None:
    path = outdir / "analysis" / "market_regime.json"
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None
