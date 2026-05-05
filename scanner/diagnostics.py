from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Final

import numpy as np
import pandas as pd

from .scoring import score_weights
from .utils import clamp_score, parse_datetime_like, safe_float, safe_str


CORE_NUMERIC_FIELDS: Final[tuple[str, ...]] = (
    "price",
    "final_score",
    "technical_score",
    "trend_score",
    "momentum_score",
    "breakout_score",
    "relative_volume_score",
    "macro_score",
    "risk_reward",
    "atr_pct",
    "annualized_volatility",
)
MIN_HISTORY_DAYS: Final[int] = 220
STALE_DATA_HOURS: Final[float] = 36.0
HIGH_VOLATILITY_ANNUALIZED: Final[float] = 0.70
EXTREME_VOLATILITY_ANNUALIZED: Final[float] = 0.90
HIGH_ATR_PCT: Final[float] = 7.0
EXTREME_ATR_PCT: Final[float] = 10.0


def apply_scoring_diagnostics(df: pd.DataFrame) -> pd.DataFrame:
    working = df.copy()
    if working.empty:
        return working

    rows = _records_from_dataframe(working)
    diagnostics = [scoring_diagnostics_for_row(row) for row in rows]

    diagnostic_columns = {
        "factor_scores": pd.Series([item["factor_scores"] for item in diagnostics], index=working.index, dtype="object"),
        "factor_weights": pd.Series([item["factor_weights"] for item in diagnostics], index=working.index, dtype="object"),
        "vetoes": pd.Series([item["vetoes"] for item in diagnostics], index=working.index, dtype="object"),
        "confidence_score": pd.Series([item["confidence_score"] for item in diagnostics], index=working.index),
        "decision_reason_codes": pd.Series([item["decision_reason_codes"] for item in diagnostics], index=working.index, dtype="object"),
        "trade_permitted": pd.Series([item["trade_permitted"] for item in diagnostics], index=working.index),
        "data_provider": pd.Series([item["data_provider"] for item in diagnostics], index=working.index),
        "data_timestamp": pd.Series([item["data_timestamp"] for item in diagnostics], index=working.index),
        "history_days": pd.Series([item["history_days"] for item in diagnostics], index=working.index, dtype="object"),
        "missing_fields": pd.Series([item["missing_fields"] for item in diagnostics], index=working.index, dtype="object"),
        "stale_data": pd.Series([item["stale_data"] for item in diagnostics], index=working.index),
        "low_confidence_data": pd.Series([item["low_confidence_data"] for item in diagnostics], index=working.index),
        "provider_error": pd.Series([item["provider_error"] for item in diagnostics], index=working.index),
        "data_quality_score": pd.Series([item["data_quality_score"] for item in diagnostics], index=working.index),
    }
    return working.assign(**diagnostic_columns)


def scoring_diagnostics_for_row(row: Mapping[str, object]) -> dict[str, object]:
    data_quality = data_quality_flags(row)
    factor_scores = factor_scores_for_row(row, data_quality_score=safe_float(data_quality["data_quality_score"], 0.0))
    vetoes = vetoes_for_row(row, data_quality)
    reason_codes = decision_reason_codes_for_row(row, vetoes)
    confidence = confidence_score_for_row(row, factor_scores, vetoes)
    final_decision = safe_str(row.get("final_decision"), "").upper()
    trade_permitted = final_decision == "ENTER" and not vetoes

    return {
        "factor_scores": factor_scores,
        "factor_weights": factor_weights_for_asset(safe_str(row.get("asset_type"), "")),
        "vetoes": vetoes,
        "confidence_score": confidence,
        "decision_reason_codes": reason_codes,
        "trade_permitted": trade_permitted,
        "data_provider": safe_str(data_quality["data_provider"], "unknown"),
        "data_timestamp": data_quality["data_timestamp"],
        "history_days": data_quality["history_days"],
        "missing_fields": data_quality["missing_fields"],
        "stale_data": data_quality["stale_data"],
        "low_confidence_data": data_quality["low_confidence_data"],
        "provider_error": data_quality["provider_error"],
        "data_quality_score": data_quality["data_quality_score"],
    }


def factor_weights_for_asset(asset_type: str) -> dict[str, float]:
    return {key: round(value, 4) for key, value in score_weights(asset_type.upper()).items()}


def factor_scores_for_row(row: Mapping[str, object], *, data_quality_score: float | None = None) -> dict[str, float]:
    risk_penalty = safe_float(row.get("risk_penalty"), 0.0)
    volatility_score = _volatility_score(row)
    risk_reward = safe_float(row.get("risk_reward"), np.nan)
    risk_reward_component = 50.0 if np.isnan(risk_reward) else clamp_score(risk_reward * 35.0)
    risk_score = clamp_score(100.0 - risk_penalty * 3.0 + (risk_reward_component - 50.0) * 0.35)
    quality_score = safe_float(row.get("quality_score"), np.nan)
    factor_scores = {
        "trend": _bounded_score(row.get("trend_score")),
        "momentum": _bounded_score(row.get("momentum_score")),
        "risk": round(risk_score, 2),
        "volatility": round(volatility_score, 2),
        "breakout": _bounded_score(row.get("breakout_score")),
        "volume": _bounded_score(row.get("relative_volume_score")),
        "macro": _bounded_score(row.get("macro_score")),
        "fundamental": _bounded_score(row.get("fundamental_score")),
        "news": _bounded_score(row.get("news_score")),
        "data_quality": _bounded_score(data_quality_score if data_quality_score is not None else 100.0),
    }
    if not np.isnan(quality_score):
        factor_scores["recommendation_quality"] = _bounded_score(quality_score)
    return factor_scores


def data_quality_flags(row: Mapping[str, object]) -> dict[str, object]:
    missing_fields = [field for field in CORE_NUMERIC_FIELDS if _is_missing_number(row.get(field))]
    history_days = _optional_int(row.get("history_days"))
    price_history_rows = _optional_int(row.get("price_history_rows"))
    effective_history = history_days if history_days is not None else price_history_rows
    timestamp_text = _timestamp_text(row.get("data_timestamp"))
    stale_data = _is_stale_timestamp(row.get("data_timestamp"))
    provider_error = safe_str(row.get("provider_error"), "")
    fallback_used = _boolish(row.get("data_provider_fallback_used"))
    provider_latency_ms = safe_float(row.get("provider_latency_ms"), np.nan)

    score = 100.0
    score -= min(35.0, float(len(missing_fields)) * 4.0)
    if "price" in missing_fields:
        score -= 20.0
    if "final_score" in missing_fields:
        score -= 15.0
    if effective_history is None:
        score -= 10.0
    elif effective_history < MIN_HISTORY_DAYS:
        score -= 25.0
    if stale_data:
        score -= 30.0
    if provider_error:
        score -= 35.0
    if fallback_used:
        score -= 5.0
    if not np.isnan(provider_latency_ms) and provider_latency_ms > 5000.0:
        score -= 5.0

    low_confidence = score < 70.0
    return {
        "data_provider": safe_str(row.get("data_provider"), "yfinance"),
        "data_timestamp": timestamp_text,
        "history_days": effective_history,
        "missing_fields": missing_fields,
        "stale_data": stale_data,
        "low_confidence_data": low_confidence,
        "provider_error": provider_error,
        "data_quality_score": round(clamp_score(score), 2),
    }


def vetoes_for_row(row: Mapping[str, object], data_quality: Mapping[str, object] | None = None) -> list[str]:
    quality = data_quality if data_quality is not None else data_quality_flags(row)
    vetoes: list[str] = []
    if bool(quality.get("stale_data")):
        vetoes.append("STALE_DATA")
    if bool(quality.get("low_confidence_data")):
        vetoes.append("LOW_CONFIDENCE_DATA")
    if safe_str(quality.get("provider_error"), ""):
        vetoes.append("PROVIDER_ERROR")

    annualized_volatility = safe_float(row.get("annualized_volatility"), np.nan)
    atr_pct = safe_float(row.get("atr_pct"), np.nan)
    if _gte(annualized_volatility, EXTREME_VOLATILITY_ANNUALIZED) or _gte(atr_pct, EXTREME_ATR_PCT):
        vetoes.append("EXTREME_VOLATILITY")
    elif _gte(annualized_volatility, HIGH_VOLATILITY_ANNUALIZED) or _gte(atr_pct, HIGH_ATR_PCT):
        vetoes.append("HIGH_VOLATILITY")

    risk_reward = safe_float(row.get("risk_reward"), np.nan)
    if not np.isnan(risk_reward) and risk_reward < 1.0:
        vetoes.append("POOR_RISK_REWARD")

    entry_status = safe_str(row.get("entry_status"), "").upper()
    if entry_status == "OVEREXTENDED":
        vetoes.append("OVEREXTENDED_ENTRY")
    elif entry_status == "STOP RISK":
        vetoes.append("STOP_RISK")

    market_regime = safe_str(row.get("market_regime"), "").upper()
    if market_regime == "RISK_OFF":
        vetoes.append("RISK_OFF_MARKET")
    elif market_regime == "OVERHEATED":
        vetoes.append("OVERHEATED_MARKET")

    return _unique_codes(vetoes)


def decision_reason_codes_for_row(row: Mapping[str, object], vetoes: list[str] | None = None) -> list[str]:
    codes: list[str] = []
    if safe_float(row.get("trend_score"), np.nan) >= 70.0:
        codes.append("TREND_CONFIRMED")
    if safe_float(row.get("momentum_score"), np.nan) >= 65.0:
        codes.append("MOMENTUM_CONFIRMED")
    if safe_float(row.get("relative_volume_score"), np.nan) >= 60.0:
        codes.append("VOLUME_CONFIRMED")
    if safe_float(row.get("macro_score"), np.nan) >= 60.0:
        codes.append("MACRO_ALIGNED")
    else:
        codes.append("MACRO_MISMATCH")

    risk_reward = safe_float(row.get("risk_reward"), np.nan)
    if not np.isnan(risk_reward) and risk_reward >= 1.5:
        codes.append("RISK_REWARD_ACCEPTABLE")
    setup_type = safe_str(row.get("setup_type"), "").lower()
    if "pullback" in setup_type or "avwap" in setup_type:
        codes.append("PULLBACK_SETUP")
    elif "breakout" in setup_type:
        codes.append("BREAKOUT_SETUP")
    elif "trend continuation" in setup_type:
        codes.append("TREND_CONTINUATION_SETUP")
    elif "mixed" in setup_type:
        codes.append("MIXED_SETUP")

    final_score = safe_float(row.get("final_score"), np.nan)
    if not np.isnan(final_score) and final_score >= 80.0:
        codes.append("HIGH_SCORE")
    elif not np.isnan(final_score) and final_score < 50.0:
        codes.append("LOW_SCORE")

    for veto in vetoes or vetoes_for_row(row):
        codes.append(veto)
    return _unique_codes(codes)


def confidence_score_for_row(row: Mapping[str, object], factor_scores: Mapping[str, float] | None = None, vetoes: list[str] | None = None) -> float:
    scores = factor_scores if factor_scores is not None else factor_scores_for_row(row)
    veto_codes = vetoes if vetoes is not None else vetoes_for_row(row)
    confidence = 45.0
    confidence += _above(scores.get("trend"), 70.0, 10.0)
    confidence += _above(scores.get("momentum"), 65.0, 8.0)
    confidence += _above(scores.get("macro"), 60.0, 8.0)
    confidence += _above(scores.get("volume"), 60.0, 6.0)
    confidence += _above(scores.get("risk"), 70.0, 8.0)
    confidence += _above(scores.get("data_quality"), 85.0, 10.0)
    confidence += _above(safe_float(row.get("risk_reward"), np.nan), 1.5, 5.0)

    penalty_by_code = {
        "STALE_DATA": 25.0,
        "LOW_CONFIDENCE_DATA": 12.0,
        "PROVIDER_ERROR": 30.0,
        "EXTREME_VOLATILITY": 22.0,
        "HIGH_VOLATILITY": 12.0,
        "POOR_RISK_REWARD": 15.0,
        "OVEREXTENDED_ENTRY": 10.0,
        "STOP_RISK": 18.0,
        "RISK_OFF_MARKET": 18.0,
        "OVERHEATED_MARKET": 8.0,
    }
    for code in veto_codes:
        confidence -= penalty_by_code.get(code, 0.0)
    return round(clamp_score(confidence), 2)


def _records_from_dataframe(df: pd.DataFrame) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for row in df.to_dict(orient="records"):
        records.append({str(key): value for key, value in row.items()})
    return records


def _bounded_score(value: object) -> float:
    return round(clamp_score(safe_float(value, np.nan)), 2)


def _volatility_score(row: Mapping[str, object]) -> float:
    annualized_volatility = safe_float(row.get("annualized_volatility"), np.nan)
    atr_pct = safe_float(row.get("atr_pct"), np.nan)
    score = 100.0
    if not np.isnan(annualized_volatility):
        score -= max(0.0, annualized_volatility - 0.25) * 85.0
    if not np.isnan(atr_pct):
        score -= max(0.0, atr_pct - 3.0) * 5.0
    return clamp_score(score)


def _is_missing_number(value: object) -> bool:
    numeric = safe_float(value, np.nan)
    return bool(np.isnan(numeric))


def _optional_int(value: object) -> int | None:
    numeric = safe_float(value, np.nan)
    if np.isnan(numeric):
        return None
    return int(numeric)


def _timestamp_text(value: object) -> str:
    parsed = parse_datetime_like(value)
    if parsed is None:
        return ""
    return parsed.isoformat()


def _is_stale_timestamp(value: object) -> bool:
    parsed = parse_datetime_like(value)
    if parsed is None:
        return False
    now = datetime.now(timezone.utc)
    age_hours = (now - parsed.to_pydatetime()).total_seconds() / 3600.0
    return age_hours > STALE_DATA_HOURS


def _boolish(value: object) -> bool:
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    return safe_str(value, "").lower() in {"true", "1", "yes", "y"}


def _gte(value: float, threshold: float) -> bool:
    return not np.isnan(value) and value >= threshold


def _above(value: float | None, threshold: float, points: float) -> float:
    if value is None or np.isnan(value):
        return 0.0
    return points if value >= threshold else 0.0


def _unique_codes(codes: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for code in codes:
        if code and code not in seen:
            seen.add(code)
            unique.append(code)
    return unique
