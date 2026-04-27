from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .data_fetch import batch_download
from .safety import utc_now
from .utils import safe_float


REGIME_PROXIES = {
    "spy": "SPY",
    "qqq": "QQQ",
    "dia": "DIA",
    "vix": "^VIX",
    "tlt": "TLT",
    "uup": "UUP",
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

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "regime": regime,
        "trend": trend,
        "confidence": confidence,
        "spy": spy,
        "qqq": qqq,
        "dia": dia,
        "vix": vix,
        "tlt": tlt,
        "uup": uup,
    }


def regime_adjustment_for_row(row: dict[str, Any] | pd.Series, regime_payload: dict[str, Any] | None) -> float:
    regime = str((regime_payload or {}).get("regime") or "").upper()
    setup_type = str(row.get("setup_type", "") if hasattr(row, "get") else "").lower()
    entry_text = " ".join(
        str(row.get(column, "") if hasattr(row, "get") else "")
        for column in ("trade_quality", "trade_quality_note", "target_warning")
    ).upper()
    if regime == "RISK_ON":
        return 4.0
    if regime == "OVERHEATED":
        return -6.0 if "EXTENDED" in entry_text or "LOW EDGE" in entry_text else -3.0
    if regime == "PULLBACK":
        return 2.0 if "pullback" in setup_type or "avwap" in setup_type else 0.0
    if regime == "RISK_OFF":
        return -10.0 if "EXTENDED" in entry_text or "LOW EDGE" in entry_text else -6.0
    return 0.0


def apply_regime_adjustments(df: pd.DataFrame, regime_payload: dict[str, Any] | None) -> pd.DataFrame:
    if df.empty:
        return df
    working = df.copy()
    adjustments = working.apply(lambda row: regime_adjustment_for_row(row, regime_payload), axis=1)
    working["market_regime"] = str((regime_payload or {}).get("regime") or "UNKNOWN")
    working["regime_adjustment"] = adjustments.round(2)
    working["final_score_adjusted"] = (pd.to_numeric(working["final_score"], errors="coerce") + adjustments).clip(lower=0, upper=100).round(2)
    return working


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
