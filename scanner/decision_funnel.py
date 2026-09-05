"""Per-symbol instrumentation of the decision funnel.

Production turns roughly 238,000 signal rows a week into about 128 ENTERs, and
until now nothing recorded *which* gate did the cutting. `ScannerAccounting`
covers selection and scoring; a symbol eliminated at the decision stage stays
`state="ranked"` and leaves only a free-text `decision_reason` behind. The
funnel that produces the 0.05% ENTER rate has only ever been reconstructed
offline, by hand, in a one-off study.

This module is an **observer**. It re-derives the same gates from a finished
row and reports which one blocked it and by how much. It is deliberately not
wired into the control flow: nothing here can change a decision, because
nothing here is consulted when a decision is made. That is a structural
guarantee rather than a promise, and `predicted_decision` exists so the
guarantee is testable -- if the observer and the engine ever disagree, the test
says so and the observer is what is wrong.

The margins are the point. Knowing that 89% of rows die at the setup gate is
useful; knowing that the median survivor misses the score floor by 24 points
rather than 2 is what tells you whether a threshold is slightly or structurally
misplaced.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Final, Literal

import numpy as np
import pandas as pd

from .final_decision import (
    BUY_ACTIONS,
    ENTER_ENTRY_STATUSES,
    SELL_ACTIONS,
    _action_for_row,
    _has_suggested_entry,
    _normalized,
    _normalized_quality,
    _wait_suggested_entry,
)
from .setup_engine import SEVERE_DATA_VETOES, SEVERE_RISK_VETOES
from .utils import safe_float, safe_str

GateName = Literal[
    "sell_action",
    "quality_avoid",
    "quality_low_edge",
    "quality_wait_pullback",
    "action_not_buy",
    "entry_status",
    "setup_type_avoid",
    "setup_strength",
    "trade_permitted",
    "regime_hard_veto",
    "final_score",
    "confidence_score",
    "passed",
]

#: Advisory conditions currently indistinguishable from severe ones inside
#: `trade_permitted`, which requires the veto list to be completely empty.
#: Recorded separately so the cost of that conflation is visible before anyone
#: argues about changing it.
ADVISORY_VETOES: Final[frozenset[str]] = frozenset(
    {"HIGH_VOLATILITY", "OVEREXTENDED_ENTRY", "RISK_OFF_MARKET", "BEAR_MARKET", "OVERHEATED_MARKET"}
)
SEVERE_VETOES: Final[frozenset[str]] = frozenset(SEVERE_DATA_VETOES | SEVERE_RISK_VETOES)


@dataclass(frozen=True)
class GateEvaluation:
    """One gate, and how close the row came to clearing it."""

    gate: str
    passed: bool
    detail: str
    observed: float | str | None = None
    threshold: float | str | None = None
    #: Signed distance from passing, for numeric gates only. Negative means it
    #: fell short, by this much. None where the gate is categorical.
    margin: float | None = None


@dataclass(frozen=True)
class DecisionFunnel:
    gates: list[GateEvaluation]
    #: The first gate that blocked, or "passed".
    blocking_gate: str
    #: What this observer believes the engine decided. Compared against the real
    #: value in tests; never used to set anything.
    predicted_decision: str
    vetoes: list[str] = field(default_factory=list)
    severe_vetoes: list[str] = field(default_factory=list)
    advisory_vetoes: list[str] = field(default_factory=list)


def _numeric_gate(gate: str, observed: float, threshold: float, detail: str) -> GateEvaluation:
    if np.isnan(observed):
        # A missing value does not block in the engine either; both of its
        # numeric gates are guarded by `not np.isnan(...)`.
        return GateEvaluation(gate=gate, passed=True, detail=f"{detail} (not measured)", threshold=threshold)
    return GateEvaluation(
        gate=gate,
        passed=bool(observed >= threshold),
        detail=detail,
        observed=round(float(observed), 2),
        threshold=round(float(threshold), 2),
        margin=round(float(observed) - float(threshold), 2),
    )


def _veto_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [safe_str(item, "").strip().upper() for item in value if safe_str(item, "").strip()]
    text = safe_str(value, "").strip()
    if not text:
        return []
    return [part.strip().upper() for part in text.replace("|", ",").split(",") if part.strip()]


def _threshold_from(mapping: object, key: str, fallback: float) -> float:
    if isinstance(mapping, dict):
        candidate = safe_float(mapping.get(key), np.nan)
        if not np.isnan(candidate):
            return float(candidate)
    return float(fallback)


def evaluate_decision_funnel(row: pd.Series) -> DecisionFunnel:
    """Re-derive the gate sequence for one finished row.

    Order mirrors `final_decision.evaluate_final_trade_decision` followed by
    `engine.apply_decision_safety_gates`. Every gate is evaluated even after one
    has blocked, because "it failed the setup gate" and "it failed the setup
    gate and would also have missed the score floor by 30" are different facts
    and only the second one tells you where to look.
    """
    action = _normalized(_action_for_row(row))
    quality = _normalized_quality(row.get("recommendation_quality"))
    entry_status = _normalized(row.get("entry_status"))
    setup_type = _normalized(row.get("setup_type"))

    vetoes = _veto_list(row.get("vetoes"))
    severe = [code for code in vetoes if code in SEVERE_VETOES]
    advisory = [code for code in vetoes if code in ADVISORY_VETOES]

    confidence_threshold = _threshold_from(row.get("adjusted_thresholds"), "confidence", 70.0)
    buy_score_threshold = _threshold_from(row.get("adjusted_thresholds"), "buy_score", 80.0)
    setup_thresholds = row.get("setup_thresholds")
    buy_score_threshold = max(buy_score_threshold, _threshold_from(setup_thresholds, "score", buy_score_threshold))
    confidence_threshold = max(confidence_threshold, _threshold_from(setup_thresholds, "confidence", confidence_threshold))
    setup_strength_threshold = _threshold_from(setup_thresholds, "min_setup_strength", 0.0)

    gates: list[GateEvaluation] = [
        GateEvaluation(
            gate="sell_action",
            passed=action not in SELL_ACTIONS,
            detail="composite action is a sell signal" if action in SELL_ACTIONS else "action is not a sell",
            observed=action or None,
        ),
        GateEvaluation(
            gate="quality_avoid",
            passed=quality != "AVOID",
            detail="recommendation quality is AVOID",
            observed=quality or None,
        ),
        GateEvaluation(
            gate="quality_low_edge",
            passed=quality != "LOW_EDGE",
            detail="recommendation quality is LOW_EDGE",
            observed=quality or None,
        ),
        GateEvaluation(
            gate="quality_wait_pullback",
            passed=quality != "WAIT_PULLBACK",
            detail="quality gate wants a pullback first",
            observed=quality or None,
        ),
        GateEvaluation(
            gate="action_not_buy",
            passed=action in BUY_ACTIONS,
            detail="composite action is not BUY or STRONG BUY",
            observed=action or None,
        ),
        GateEvaluation(
            gate="entry_status",
            passed=entry_status in ENTER_ENTRY_STATUSES,
            detail="price is not in an enterable entry state",
            observed=entry_status or None,
            threshold="GOOD ENTRY | BUY ZONE | NEAR ENTRY",
        ),
        GateEvaluation(
            gate="setup_type_avoid",
            passed=setup_type != "AVOID",
            detail="setup classifier returned AVOID",
            observed=setup_type or None,
        ),
        _numeric_gate(
            "setup_strength",
            safe_float(row.get("setup_strength"), np.nan),
            setup_strength_threshold,
            "setup strength below its per-setup floor",
        ),
        GateEvaluation(
            gate="trade_permitted",
            passed=not vetoes,
            detail="trade_permitted requires an empty veto list",
            observed=",".join(vetoes) if vetoes else None,
        ),
        GateEvaluation(
            gate="regime_hard_veto",
            passed=not any(code in {"RISK_OFF_MARKET", "BEAR_MARKET", "OVERHEATED_MARKET"} for code in vetoes),
            detail="market-wide regime veto",
            observed=_normalized(row.get("market_regime")) or None,
        ),
        _numeric_gate(
            "final_score",
            safe_float(row.get("final_score"), np.nan),
            buy_score_threshold,
            "final score below the entry floor",
        ),
        _numeric_gate(
            "confidence_score",
            safe_float(row.get("confidence_score"), np.nan),
            confidence_threshold,
            "confidence below the entry floor",
        ),
    ]

    blocking = next((gate.gate for gate in gates if not gate.passed), "passed")
    # The WAIT_PULLBACK branch is not unconditional: without a usable entry zone
    # the engine falls through to WATCH rather than telling a reader to wait for
    # a level it cannot name. The grid test found this; the single-gate tests
    # did not, because they all carried an entry zone.
    has_entry_zone = _has_suggested_entry(_wait_suggested_entry(row))
    return DecisionFunnel(
        gates=gates,
        blocking_gate=blocking,
        predicted_decision=_predicted_decision(blocking, quality, entry_status, severe, vetoes, has_entry_zone),
        vetoes=vetoes,
        severe_vetoes=severe,
        advisory_vetoes=advisory,
    )


def _predicted_decision(
    blocking: str,
    quality: str,
    entry_status: str,
    severe: list[str],
    vetoes: list[str],
    has_entry_zone: bool = True,
) -> str:
    """What the engine decides, given which gate blocked first.

    Mirrors the two functions rather than re-deriving their intent, including
    the branch where WAIT_PULLBACK quality in a BUY ZONE becomes WATCH instead.
    """
    if blocking == "sell_action":
        return "EXIT"
    if blocking == "quality_avoid":
        return "AVOID"
    if blocking == "quality_low_edge":
        return "WATCH"
    if blocking == "quality_wait_pullback":
        if entry_status == "BUY ZONE":
            return "WATCH"
        return "WAIT_PULLBACK" if has_entry_zone else "WATCH"
    if blocking in {"action_not_buy", "entry_status"}:
        return "WATCH"
    if blocking == "setup_type_avoid":
        return "AVOID"
    if blocking == "setup_strength":
        return "WATCH"
    if blocking == "trade_permitted":
        regime_hard = any(code in {"RISK_OFF_MARKET", "BEAR_MARKET", "OVERHEATED_MARKET"} for code in vetoes)
        return "AVOID" if severe or regime_hard else "WAIT_PULLBACK"
    if blocking == "regime_hard_veto":
        return "AVOID"
    if blocking in {"final_score", "confidence_score"}:
        return "WATCH"
    return "ENTER"


def funnel_columns_for_row(row: pd.Series) -> dict[str, object]:
    """The per-row columns persisted alongside the decision."""
    funnel = evaluate_decision_funnel(row)
    shortfalls = {
        gate.gate: gate.margin
        for gate in funnel.gates
        if gate.margin is not None and gate.margin < 0
    }
    return {
        "funnel_blocking_gate": funnel.blocking_gate,
        "funnel_predicted_decision": funnel.predicted_decision,
        "funnel_shortfalls": shortfalls,
        "funnel_severe_vetoes": funnel.severe_vetoes,
        "funnel_advisory_vetoes": funnel.advisory_vetoes,
    }


def apply_decision_funnel(df_rank: pd.DataFrame) -> pd.DataFrame:
    """Add the observer's columns. Reads the frame; changes no existing column."""
    if df_rank.empty:
        return df_rank
    working = df_rank.copy()
    records = [funnel_columns_for_row(row) for _, row in working.iterrows()]
    for column in (
        "funnel_blocking_gate",
        "funnel_predicted_decision",
        "funnel_shortfalls",
        "funnel_severe_vetoes",
        "funnel_advisory_vetoes",
    ):
        working[column] = [record[column] for record in records]
    return working


def funnel_summary(df_rank: pd.DataFrame) -> dict[str, Any]:
    """Scan-level counts, for the scan log and the ops snapshot.

    `median_shortfall` is reported per gate because the size of the miss is what
    separates a threshold that is slightly high from one nothing can reach.
    """
    if df_rank.empty or "funnel_blocking_gate" not in df_rank.columns:
        return {"rows": 0, "by_gate": {}, "median_shortfall": {}, "agreement": None}

    by_gate: dict[str, int] = {}
    for value in df_rank["funnel_blocking_gate"]:
        key = safe_str(value, "unknown")
        by_gate[key] = by_gate.get(key, 0) + 1

    shortfalls: dict[str, list[float]] = {}
    for mapping in df_rank.get("funnel_shortfalls", []):
        if not isinstance(mapping, dict):
            continue
        for gate, margin in mapping.items():
            if margin is None:
                continue
            shortfalls.setdefault(gate, []).append(float(margin))

    agreement = None
    if "final_decision" in df_rank.columns and "funnel_predicted_decision" in df_rank.columns:
        actual = df_rank["final_decision"].map(lambda value: safe_str(value, "").upper())
        predicted = df_rank["funnel_predicted_decision"].map(lambda value: safe_str(value, "").upper())
        matches = int((actual == predicted).sum())
        agreement = {"matched": matches, "rows": int(len(df_rank)), "rate": round(matches / max(1, len(df_rank)), 4)}

    return {
        "rows": int(len(df_rank)),
        "by_gate": dict(sorted(by_gate.items(), key=lambda item: item[1], reverse=True)),
        "median_shortfall": {
            gate: round(float(np.median(values)), 2) for gate, values in sorted(shortfalls.items())
        },
        "agreement": agreement,
    }
