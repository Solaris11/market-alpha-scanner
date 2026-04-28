from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

from .utils import safe_float, safe_str


QUALITY_ORDER = ("TRADE_READY", "WAIT_PULLBACK", "LOW_EDGE", "AVOID")


def _normalized(value: object) -> str:
    if value is None:
        return ""
    if _is_missing(value):
        return ""
    return re.sub(r"\s+", " ", safe_str(value, "").strip().upper())


def _is_missing(value: Any) -> bool:
    try:
        return bool(pd.isna(value))
    except TypeError:
        return False


def _extract_numbers(value: object) -> list[float]:
    if value is None:
        return []
    normalized = str(value).replace(",", "").replace("–", "-").replace("—", "-")
    return [float(match) for match in re.findall(r"(?<!\d)-?\d+(?:\.\d+)?", normalized)]


def _range_from_fields(row: pd.Series, low_column: str, high_column: str, text_columns: tuple[str, ...]) -> tuple[float | None, float | None]:
    low = safe_float(row.get(low_column), np.nan)
    high = safe_float(row.get(high_column), np.nan)
    if not np.isnan(low) and not np.isnan(high):
        return (min(float(low), float(high)), max(float(low), float(high)))
    for column in text_columns:
        numbers = _extract_numbers(row.get(column))
        if len(numbers) >= 2:
            return (min(numbers[0], numbers[1]), max(numbers[0], numbers[1]))
        if len(numbers) == 1:
            return (numbers[0], numbers[0])
    if not np.isnan(low) or not np.isnan(high):
        value = float(low if not np.isnan(low) else high)
        return (value, value)
    return (None, None)


def _action_for_row(row: pd.Series) -> str:
    for column in ("action", "recommended_action", "composite_action", "mid_action", "short_action", "long_action"):
        raw_value = row.get(column)
        if raw_value is None:
            continue
        try:
            if pd.isna(raw_value):
                continue
        except TypeError:
            pass
        value = safe_str(raw_value, "")
        if value:
            return value
    return ""


def _entry_status_for_row(row: pd.Series) -> str:
    explicit = _normalized(row.get("entry_status"))
    if explicit:
        return explicit

    price = safe_float(row.get("price"), np.nan)
    stop = safe_float(row.get("stop_loss"), np.nan)
    if np.isnan(stop):
        stop = safe_float(row.get("invalidation_level"), np.nan)
    buy_low, buy_high = _range_from_fields(row, "buy_zone_low", "buy_zone_high", ("buy_zone", "entry_zone"))

    if not np.isnan(price) and not np.isnan(stop) and price > 0 and (price <= stop or (price - stop) / price <= 0.03):
        return "STOP RISK"
    if not np.isnan(price) and buy_low is not None and buy_high is not None:
        if buy_low <= price <= buy_high:
            return "BUY ZONE"
        if buy_high < price <= buy_high * 1.02:
            return "NEAR ENTRY"
        if price > buy_high * 1.02:
            return "OVEREXTENDED"

    text = " ".join(
        _normalized(row.get(column))
        for column in ("trade_quality", "trade_quality_note", "target_warning")
    )
    if "LOW EDGE" in text or "EXTENDED" in text:
        return "OVEREXTENDED"
    if "GOOD" in text:
        return "GOOD ENTRY"
    if "ACCEPTABLE" in text:
        return "NEAR ENTRY"
    return "REVIEW"


def _risk_reward_for_row(row: pd.Series) -> float | None:
    candidates = (
        row.get("risk_reward"),
        row.get("risk_reward_low"),
        row.get("balanced_risk_reward_low"),
        row.get("conservative_risk_reward"),
        row.get("risk_reward_label"),
        row.get("target_risk_reward_label"),
    )
    for value in candidates:
        numeric_value = safe_float(value, np.nan)
        if not np.isnan(numeric_value):
            return float(numeric_value)
        numbers = _extract_numbers(value)
        if numbers:
            return float(numbers[0])
    return None


def _score_bucket_adjustment(score: float) -> tuple[int, str]:
    if np.isnan(score):
        return (-10, "missing score")
    if score >= 80:
        return (10, "80+ score")
    if score >= 70:
        return (5, "70-79 score")
    if score >= 60:
        return (0, "60-69 score")
    return (-10, "sub-60 score")


def _classification(score: float) -> str:
    if score >= 75:
        return "TRADE_READY"
    if score >= 60:
        return "WAIT_PULLBACK"
    if score >= 40:
        return "LOW_EDGE"
    return "AVOID"


def _reason(quality: str, positives: list[str], negatives: list[str]) -> str:
    if quality == "TRADE_READY":
        return f"{positives[0] if positives else 'Strong signal'}; {positives[1] if len(positives) > 1 else 'quality gate passed'}."
    if quality == "WAIT_PULLBACK":
        return f"{positives[0] if positives else 'Constructive signal'}, but {negatives[0] if negatives else 'entry needs confirmation'}."
    if quality == "LOW_EDGE":
        return f"{negatives[0] if negatives else 'Mixed setup'}; {negatives[1] if len(negatives) > 1 else 'wait for better edge'}."
    return f"{negatives[0] if negatives else 'Poor setup'}; avoid until conditions improve."


def evaluate_recommendation_quality(row: pd.Series, market_structure: dict[str, Any] | None = None) -> dict[str, object]:
    score = 50
    positives: list[str] = []
    negatives: list[str] = []

    entry_status = _entry_status_for_row(row)
    if entry_status == "GOOD ENTRY":
        score += 20
        positives.append("good entry")
    elif entry_status == "NEAR ENTRY":
        score += 10
        positives.append("near entry")
    elif entry_status == "BUY ZONE":
        score += 5
        positives.append("inside buy zone")
    elif entry_status == "OVEREXTENDED":
        score -= 20
        negatives.append("overextended entry")
    elif entry_status == "STOP RISK":
        score -= 30
        negatives.append("near stop risk")

    rr = _risk_reward_for_row(row)
    if rr is not None:
        if rr >= 2:
            score += 20
            positives.append("strong risk/reward")
        elif rr >= 1:
            score += 10
            positives.append("acceptable risk/reward")
        else:
            score -= 15
            negatives.append("low risk/reward")
    else:
        negatives.append("risk/reward unavailable")

    regime = _normalized(row.get("market_regime"))
    if regime == "RISK_ON":
        score += 10
        positives.append("RISK_ON market")
    elif regime == "PULLBACK":
        score += 10
        positives.append("pullback market regime")
    elif regime == "OVERHEATED":
        score -= 15
        negatives.append("overheated market")
    elif regime == "RISK_OFF":
        score -= 25
        negatives.append("RISK_OFF market")

    breadth = _normalized((market_structure or {}).get("breadth"))
    leadership = _normalized((market_structure or {}).get("leadership"))
    if breadth == "STRONG":
        score += 10
        positives.append("strong breadth")
    elif breadth == "WEAK":
        score -= 10
        negatives.append("weak breadth")
    if leadership == "CONCENTRATED":
        score -= 10
        negatives.append("concentrated leadership")

    setup = safe_str(row.get("setup_type"), "").lower()
    if "breakout continuation" in setup:
        score += 10
        positives.append("breakout continuation")
    elif "trend continuation" in setup:
        score += 5
        positives.append("trend continuation")
    elif "pullback to avwap" in setup or "avwap" in setup:
        score += 5
        positives.append("pullback to AVWAP")
    elif "mixed" in setup:
        score -= 5
        negatives.append("mixed setup")

    bucket_adjustment, bucket_reason = _score_bucket_adjustment(safe_float(row.get("final_score"), np.nan))
    score += bucket_adjustment
    if bucket_adjustment > 0:
        positives.append(bucket_reason)
    elif bucket_adjustment < 0:
        negatives.append(bucket_reason)

    score = max(0, min(100, int(round(score))))
    quality = _classification(score)
    return {
        "entry_status": entry_status,
        "recommendation_quality": quality,
        "quality_score": score,
        "quality_reason": _reason(quality, positives, negatives),
    }


def apply_recommendation_quality(df: pd.DataFrame, market_structure: dict[str, Any] | None = None) -> pd.DataFrame:
    if df.empty:
        return df
    working = df.copy()
    if "quality_score" in working.columns and "fundamental_quality_score" not in working.columns:
        working["fundamental_quality_score"] = working["quality_score"]
    evaluations = working.apply(lambda row: evaluate_recommendation_quality(row, market_structure), axis=1)
    working["entry_status"] = evaluations.map(lambda item: item["entry_status"])
    working["recommendation_quality"] = evaluations.map(lambda item: item["recommendation_quality"])
    working["quality_score"] = evaluations.map(lambda item: item["quality_score"])
    working["quality_reason"] = evaluations.map(lambda item: item["quality_reason"])
    return working
