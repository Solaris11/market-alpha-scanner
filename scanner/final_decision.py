from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

from .utils import safe_float, safe_str


BUY_ACTIONS = {"BUY", "STRONG BUY"}
SELL_ACTIONS = {"SELL", "STRONG SELL"}
FINAL_DECISION_COLUMNS = ("final_decision", "decision_reason", "suggested_entry", "entry_distance_pct")


def _is_missing(value: Any) -> bool:
    try:
        return bool(pd.isna(value))
    except TypeError:
        return False


def _normalized(value: object) -> str:
    if value is None or _is_missing(value):
        return ""
    return re.sub(r"\s+", " ", safe_str(value, "").strip().upper())


def _normalized_quality(value: object) -> str:
    return _normalized(value).replace(" ", "_")


def _extract_numbers(value: object) -> list[float]:
    if value is None or _is_missing(value):
        return []
    normalized = safe_str(value, "").replace(",", "").replace("–", "-").replace("—", "-")
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
        value = row.get(column)
        if value is None or _is_missing(value):
            continue
        text = safe_str(value, "")
        if text and text.lower() not in {"nan", "none", "null", "n/a"}:
            return text
    return ""


def _entry_zone_label(row: pd.Series) -> str:
    for column in ("buy_zone", "entry_zone"):
        value = row.get(column)
        if value is None or _is_missing(value):
            continue
        text = safe_str(value, "")
        if text:
            return text
    return ""


def _current_price(row: pd.Series) -> float | None:
    price = safe_float(row.get("price"), np.nan)
    if np.isnan(price) or price <= 0:
        return None
    return float(price)


def _buy_zone_high(row: pd.Series) -> float | None:
    _, high = _range_from_fields(row, "buy_zone_low", "buy_zone_high", ("buy_zone", "entry_zone"))
    return high


def _wait_entry_distance_pct(row: pd.Series) -> float | None:
    price = _current_price(row)
    buy_high = _buy_zone_high(row)
    if price is None or buy_high is None:
        return None
    return round((price - buy_high) / price, 6)


def _wait_suggested_entry(row: pd.Series) -> object:
    label = _entry_zone_label(row)
    if label:
        return label
    buy_high = _buy_zone_high(row)
    return round(buy_high, 4) if buy_high is not None else np.nan


def _enter_suggested_entry(row: pd.Series) -> object:
    price = _current_price(row)
    return round(price, 4) if price is not None else np.nan


def evaluate_final_trade_decision(row: pd.Series) -> dict[str, object]:
    action = _normalized(_action_for_row(row))
    quality = _normalized_quality(row.get("recommendation_quality"))
    entry_status = _normalized(row.get("entry_status"))

    if action in SELL_ACTIONS:
        return {
            "final_decision": "EXIT",
            "decision_reason": "Sell signal or invalidation triggered",
            "suggested_entry": np.nan,
            "entry_distance_pct": np.nan,
        }

    if quality == "AVOID":
        return {
            "final_decision": "AVOID",
            "decision_reason": "Poor risk/reward or overextended in current market conditions",
            "suggested_entry": np.nan,
            "entry_distance_pct": np.nan,
        }

    if quality == "LOW_EDGE":
        return {
            "final_decision": "WATCH",
            "decision_reason": "Setup has low edge; monitor but avoid entry",
            "suggested_entry": np.nan,
            "entry_distance_pct": np.nan,
        }

    if quality == "WAIT_PULLBACK" or (quality == "TRADE_READY" and action in BUY_ACTIONS and entry_status == "OVEREXTENDED"):
        entry_distance_pct = _wait_entry_distance_pct(row)
        return {
            "final_decision": "WAIT_PULLBACK",
            "decision_reason": "Strong setup but price extended; wait for pullback to entry zone",
            "suggested_entry": _wait_suggested_entry(row),
            "entry_distance_pct": entry_distance_pct if entry_distance_pct is not None else np.nan,
        }

    if quality == "TRADE_READY" and action in BUY_ACTIONS and entry_status != "OVEREXTENDED":
        return {
            "final_decision": "ENTER",
            "decision_reason": "Good entry with strong trend and acceptable risk/reward",
            "suggested_entry": _enter_suggested_entry(row),
            "entry_distance_pct": np.nan,
        }

    return {
        "final_decision": "WATCH",
        "decision_reason": "No clean entry signal; monitor until conditions improve",
        "suggested_entry": np.nan,
        "entry_distance_pct": np.nan,
    }


def apply_final_trade_decision(df: pd.DataFrame) -> pd.DataFrame:
    working = df.copy()
    if working.empty:
        for column in FINAL_DECISION_COLUMNS:
            working[column] = []
        return working
    decisions = working.apply(evaluate_final_trade_decision, axis=1)
    for column in FINAL_DECISION_COLUMNS:
        working[column] = decisions.map(lambda item: item[column])
    return working
