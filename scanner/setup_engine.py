from __future__ import annotations

from collections.abc import Mapping
from typing import Final, Literal, TypedDict

import numpy as np
import pandas as pd

from .utils import clamp_score, safe_float, safe_str


SetupType = Literal["PULLBACK", "BREAKOUT", "CONTINUATION", "AVOID"]


class SetupThresholds(TypedDict):
    score: float
    confidence: float
    min_setup_strength: float
    min_risk_reward: float
    min_volume: float
    min_momentum: float
    min_trend: float
    max_atr_pct: float


class SetupEvaluation(TypedDict):
    setup_type: SetupType
    setup_detail: str
    setup_strength: float
    setup_reason_codes: list[str]
    setup_thresholds: SetupThresholds


SETUP_TYPES: Final[tuple[SetupType, ...]] = ("PULLBACK", "BREAKOUT", "CONTINUATION", "AVOID")
SEVERE_DATA_VETOES: Final[set[str]] = {"STALE_DATA", "LOW_CONFIDENCE_DATA", "PROVIDER_ERROR"}
SEVERE_RISK_VETOES: Final[set[str]] = {"EXTREME_VOLATILITY", "POOR_RISK_REWARD", "STOP_RISK"}

SETUP_THRESHOLDS: Final[dict[SetupType, SetupThresholds]] = {
    "PULLBACK": {
        "score": 80.0,
        "confidence": 70.0,
        "min_setup_strength": 64.0,
        "min_risk_reward": 1.10,
        "min_volume": 45.0,
        "min_momentum": 55.0,
        "min_trend": 70.0,
        "max_atr_pct": 7.0,
    },
    "BREAKOUT": {
        "score": 88.0,
        "confidence": 78.0,
        "min_setup_strength": 74.0,
        "min_risk_reward": 1.50,
        "min_volume": 65.0,
        "min_momentum": 68.0,
        "min_trend": 65.0,
        "max_atr_pct": 6.0,
    },
    "CONTINUATION": {
        "score": 84.0,
        "confidence": 74.0,
        "min_setup_strength": 70.0,
        "min_risk_reward": 1.30,
        "min_volume": 50.0,
        "min_momentum": 62.0,
        "min_trend": 72.0,
        "max_atr_pct": 7.0,
    },
    "AVOID": {
        "score": 101.0,
        "confidence": 101.0,
        "min_setup_strength": 101.0,
        "min_risk_reward": 99.0,
        "min_volume": 101.0,
        "min_momentum": 101.0,
        "min_trend": 101.0,
        "max_atr_pct": 0.0,
    },
}


def apply_setup_decision_layer(df: pd.DataFrame) -> pd.DataFrame:
    working = df.copy()
    if working.empty:
        return working

    rows = _records_from_dataframe(working)
    evaluations = [classify_setup(row) for row in rows]
    return working.assign(
        setup_detail=pd.Series([item["setup_detail"] for item in evaluations], index=working.index, dtype="object"),
        setup_type=pd.Series([item["setup_type"] for item in evaluations], index=working.index, dtype="object"),
        setup_strength=pd.Series([item["setup_strength"] for item in evaluations], index=working.index),
        setup_reason_codes=pd.Series([item["setup_reason_codes"] for item in evaluations], index=working.index, dtype="object"),
        setup_thresholds=pd.Series([item["setup_thresholds"] for item in evaluations], index=working.index, dtype="object"),
    )


def classify_setup(row: Mapping[str, object]) -> SetupEvaluation:
    detail = _setup_detail(row)
    detail_key = detail.lower()
    vetoes = set(_code_list(row.get("vetoes")))
    scores = _factor_scores(row)
    trend = scores["trend"]
    momentum = scores["momentum"]
    breakout = scores["breakout"]
    volume = scores["volume"]
    risk = scores["risk"]
    data_quality = scores["data_quality"]
    avwap = safe_float(row.get("avwap_score"), np.nan)
    risk_reward = safe_float(row.get("risk_reward"), np.nan)
    atr_pct = safe_float(row.get("atr_pct"), np.nan)
    rsi_value = safe_float(row.get("current_rsi"), np.nan)

    reasons: list[str] = []
    if detail:
        reasons.append("SETUP_DETAIL_PRESERVED")
    if trend >= 70.0:
        reasons.append("TREND_INTACT")
    if momentum >= 65.0:
        reasons.append("MOMENTUM_CONFIRMED")
    if volume >= 60.0:
        reasons.append("VOLUME_CONFIRMED")
    if data_quality < 70.0 or vetoes.intersection(SEVERE_DATA_VETOES):
        reasons.append("DATA_QUALITY_SETUP_RISK")
    if not np.isnan(risk_reward) and risk_reward < 1.0:
        reasons.append("POOR_RISK_REWARD_SETUP")
    if _is_elevated_volatility(row):
        reasons.append("HIGH_VOLATILITY_SETUP")

    overextended = _is_overextended(row, detail_key, rsi_value)
    if overextended:
        reasons.append("SETUP_REJECTED_EXTENDED")

    if vetoes.intersection(SEVERE_DATA_VETOES) or vetoes.intersection(SEVERE_RISK_VETOES):
        setup_type: SetupType = "AVOID"
        reasons.append("SETUP_AVOID")
    elif "breakout" in detail_key or breakout >= 72.0:
        if overextended:
            setup_type = "AVOID"
            reasons.append("BREAKOUT_REJECTED_EXTENDED")
        elif volume >= SETUP_THRESHOLDS["BREAKOUT"]["min_volume"] and momentum >= SETUP_THRESHOLDS["BREAKOUT"]["min_momentum"]:
            setup_type = "BREAKOUT"
            reasons.append("SETUP_BREAKOUT")
        else:
            setup_type = "AVOID"
            reasons.append("WEAK_VOLUME_FOR_BREAKOUT")
            reasons.append("SETUP_AVOID")
    elif _near_pullback_context(detail_key, avwap) and trend >= SETUP_THRESHOLDS["PULLBACK"]["min_trend"] and not overextended:
        setup_type = "PULLBACK"
        reasons.append("SETUP_PULLBACK")
        reasons.append("NEAR_AVWAP_OR_MA")
    elif trend >= SETUP_THRESHOLDS["CONTINUATION"]["min_trend"] and momentum >= 58.0 and not overextended:
        setup_type = "CONTINUATION"
        reasons.append("SETUP_CONTINUATION")
    else:
        setup_type = "AVOID"
        reasons.append("MIXED_SETUP_AVOIDED")
        reasons.append("SETUP_AVOID")

    setup_strength = setup_strength_for_type(setup_type, row)
    reasons.extend(_threshold_reason_codes(setup_type, row, setup_strength))
    return {
        "setup_type": setup_type,
        "setup_detail": detail,
        "setup_strength": setup_strength,
        "setup_reason_codes": _unique_codes(reasons),
        "setup_thresholds": SETUP_THRESHOLDS[setup_type],
    }


def setup_strength_for_type(setup_type: SetupType, row: Mapping[str, object]) -> float:
    scores = _factor_scores(row)
    risk_reward = safe_float(row.get("risk_reward"), np.nan)
    rr_component = 50.0 if np.isnan(risk_reward) else clamp_score(risk_reward * 35.0)

    if setup_type == "PULLBACK":
        raw = scores["trend"] * 0.30 + scores["risk"] * 0.24 + scores["momentum"] * 0.18 + scores["data_quality"] * 0.16 + rr_component * 0.12
    elif setup_type == "BREAKOUT":
        raw = scores["breakout"] * 0.28 + scores["volume"] * 0.24 + scores["momentum"] * 0.22 + scores["risk"] * 0.14 + scores["data_quality"] * 0.12
    elif setup_type == "CONTINUATION":
        raw = scores["trend"] * 0.30 + scores["momentum"] * 0.24 + scores["risk"] * 0.18 + scores["macro"] * 0.14 + scores["data_quality"] * 0.14
    else:
        raw = min(scores["trend"], scores["risk"], scores["data_quality"])

    penalty = _setup_penalty(row)
    if setup_type == "AVOID":
        return round(min(49.0, clamp_score(raw - penalty)), 2)
    return round(clamp_score(raw - penalty), 2)


def _threshold_reason_codes(setup_type: SetupType, row: Mapping[str, object], setup_strength: float) -> list[str]:
    if setup_type == "AVOID":
        return []
    thresholds = SETUP_THRESHOLDS[setup_type]
    scores = _factor_scores(row)
    risk_reward = safe_float(row.get("risk_reward"), np.nan)
    atr_pct = safe_float(row.get("atr_pct"), np.nan)
    codes: list[str] = []
    if setup_strength < thresholds["min_setup_strength"]:
        codes.append("SETUP_STRENGTH_BELOW_THRESHOLD")
    if scores["trend"] < thresholds["min_trend"]:
        codes.append("SETUP_TREND_BELOW_THRESHOLD")
    if scores["momentum"] < thresholds["min_momentum"]:
        codes.append("SETUP_MOMENTUM_BELOW_THRESHOLD")
    if scores["volume"] < thresholds["min_volume"]:
        codes.append("SETUP_VOLUME_BELOW_THRESHOLD")
    if not np.isnan(risk_reward) and risk_reward < thresholds["min_risk_reward"]:
        codes.append("SETUP_RISK_REWARD_BELOW_THRESHOLD")
    if not np.isnan(atr_pct) and atr_pct > thresholds["max_atr_pct"]:
        codes.append("SETUP_ATR_ABOVE_THRESHOLD")
    return codes


def _setup_detail(row: Mapping[str, object]) -> str:
    existing_detail = safe_str(row.get("setup_detail"), "")
    if existing_detail:
        return existing_detail
    setup_type = safe_str(row.get("setup_type"), "")
    if setup_type in SETUP_TYPES:
        return ""
    return setup_type


def _factor_scores(row: Mapping[str, object]) -> dict[str, float]:
    structured = row.get("factor_scores")
    if isinstance(structured, dict):
        return {
            "trend": _score_from_mapping(structured, "trend", row.get("trend_score")),
            "momentum": _score_from_mapping(structured, "momentum", row.get("momentum_score")),
            "breakout": _score_from_mapping(structured, "breakout", row.get("breakout_score")),
            "volume": _score_from_mapping(structured, "volume", row.get("relative_volume_score")),
            "risk": _score_from_mapping(structured, "risk", None),
            "macro": _score_from_mapping(structured, "macro", row.get("macro_score")),
            "data_quality": _score_from_mapping(structured, "data_quality", row.get("data_quality_score")),
        }
    risk_penalty = safe_float(row.get("risk_penalty"), 0.0)
    return {
        "trend": _bounded(row.get("trend_score")),
        "momentum": _bounded(row.get("momentum_score")),
        "breakout": _bounded(row.get("breakout_score")),
        "volume": _bounded(row.get("relative_volume_score")),
        "risk": _bounded(100.0 - risk_penalty * 3.0),
        "macro": _bounded(row.get("macro_score")),
        "data_quality": _bounded(row.get("data_quality_score"), default=100.0),
    }


def _score_from_mapping(mapping: Mapping[object, object], key: str, fallback: object) -> float:
    return _bounded(mapping.get(key), fallback=fallback)


def _bounded(value: object, fallback: object = None, *, default: float = 50.0) -> float:
    numeric = safe_float(value, np.nan)
    if np.isnan(numeric) and fallback is not None:
        numeric = safe_float(fallback, np.nan)
    if np.isnan(numeric):
        numeric = default
    return round(clamp_score(numeric), 2)


def _near_pullback_context(detail_key: str, avwap_score: float) -> bool:
    return "pullback" in detail_key or "avwap" in detail_key or "ma20" in detail_key or "ma50" in detail_key or (not np.isnan(avwap_score) and avwap_score >= 62.0)


def _is_overextended(row: Mapping[str, object], detail_key: str, rsi_value: float) -> bool:
    text = " ".join(
        safe_str(row.get(column), "")
        for column in ("entry_status", "trade_quality", "trade_quality_note", "target_warning")
    ).lower()
    return "overextended" in text or "extended" in detail_key or (not np.isnan(rsi_value) and rsi_value >= 74.0)


def _is_elevated_volatility(row: Mapping[str, object]) -> bool:
    atr_pct = safe_float(row.get("atr_pct"), np.nan)
    annualized_volatility = safe_float(row.get("annualized_volatility"), np.nan)
    return (not np.isnan(atr_pct) and atr_pct >= 7.0) or (not np.isnan(annualized_volatility) and annualized_volatility >= 0.70)


def _setup_penalty(row: Mapping[str, object]) -> float:
    penalty = 0.0
    for code in _code_list(row.get("vetoes")):
        if code in SEVERE_DATA_VETOES:
            penalty += 22.0
        elif code in SEVERE_RISK_VETOES:
            penalty += 18.0
        elif code in {"HIGH_VOLATILITY", "OVEREXTENDED_ENTRY", "OVERHEATED_MARKET"}:
            penalty += 10.0
        elif code in {"RISK_OFF_MARKET", "BEAR_MARKET"}:
            penalty += 14.0
    return min(60.0, penalty)


def _records_from_dataframe(df: pd.DataFrame) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for row in df.to_dict(orient="records"):
        records.append({str(key): value for key, value in row.items()})
    return records


def _code_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [safe_str(item, "").upper() for item in value if safe_str(item, "")]
    if isinstance(value, tuple):
        return [safe_str(item, "").upper() for item in value if safe_str(item, "")]
    text = safe_str(value, "")
    if not text:
        return []
    return [part.strip().strip("'\"").upper() for part in text.strip("[]").split(",") if part.strip()]


def _unique_codes(codes: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for code in codes:
        if code and code not in seen:
            seen.add(code)
            unique.append(code)
    return unique
