"""Shadow evaluation of an alternative entry rule.

`docs/analysis/entry-score-threshold-holdout-study.md` established, out of
sample, that after the setup, veto and confidence gates **no** holdout signal
reached a `final_score` of 80 at any horizon -- the production zero-ENTER rate
is a structural consequence of where the floor sits. The same study measured a
55-70 band inside the real decision cohort: 1,302 / 792 / 207 entries at 5D /
10D / 20D, mean +0.50 / +1.35 / +0.88 percent, hit rates 56-61%, beating
baseline in 8 of 9 walk-forward cells where the floor managed 3 of 9.

It also said, explicitly, that this is **not** enough to change the live rule,
and proposed shadow mode instead. This module is that proposal, unchanged.

What it does: evaluate both rules on every scan and record both answers side by
side. What it does not do: influence `final_decision`. The live rule stays the
floor unless someone deliberately sets the mode, and even then this module only
writes `shadow_*` columns -- nothing reads them back into the decision path.

The point is to accumulate live, matured forward returns for the band rule so
the question can be settled with evidence the way the historical study settled
it, rather than by argument about a constant.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Final

import numpy as np
import pandas as pd

from .decision_funnel import evaluate_decision_funnel
from .utils import safe_float, safe_str

#: Defaults reproduce current production behaviour exactly. Changing the mode
#: changes only what the shadow columns say, never `final_decision`.
DEFAULT_ENTRY_MODE: Final[str] = "floor"
DEFAULT_BAND_LOW: Final[float] = 55.0
DEFAULT_BAND_HIGH: Final[float] = 70.0


@dataclass(frozen=True)
class ShadowConfig:
    mode: str
    band_low: float
    band_high: float

    @property
    def label(self) -> str:
        if self.mode == "band":
            return f"band:{self.band_low:.0f}-{self.band_high:.0f}"
        return "floor"


def shadow_config(env: dict[str, str] | None = None) -> ShadowConfig:
    """Read the shadow rule from the environment, falling back to today's rule.

    A malformed value falls back rather than raising: this is instrumentation,
    and a typo in an environment variable must not be able to stop a scan.
    """
    source = env if env is not None else os.environ
    mode = safe_str(source.get("TRADEVETO_ENTRY_SCORE_MODE"), DEFAULT_ENTRY_MODE).strip().lower()
    if mode not in {"floor", "band"}:
        mode = DEFAULT_ENTRY_MODE

    def _bound(key: str, fallback: float) -> float:
        value = safe_float(source.get(key), np.nan)
        return float(value) if not np.isnan(value) else fallback

    low = _bound("TRADEVETO_ENTRY_SCORE_BAND_LOW", DEFAULT_BAND_LOW)
    high = _bound("TRADEVETO_ENTRY_SCORE_BAND_HIGH", DEFAULT_BAND_HIGH)
    if low > high:
        low, high = high, low
    return ShadowConfig(mode=mode, band_low=low, band_high=high)


@dataclass(frozen=True)
class ShadowDecision:
    decision: str
    blocking_gate: str
    rule: str
    differs_from_live: bool
    entry_zone: str
    stop_loss: str
    target_zone: str
    risk_reward: float


#: Every gate except the score one. The band rule keeps all of them: the
#: holdout study found setup, veto and confidence filtering roughly doubles the
#: band's edge, so "replace the floor" must not quietly become "remove the
#: gates".
_NON_SCORE_GATES: Final[tuple[str, ...]] = (
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
    "confidence_score",
)


def evaluate_shadow_decision(row: pd.Series, config: ShadowConfig | None = None) -> ShadowDecision:
    """What the alternative rule would have said about this row.

    Reuses the funnel observer for every gate except the score, so the two
    rules differ in exactly one place and any divergence is attributable.
    """
    settings = config if config is not None else shadow_config()
    funnel = evaluate_decision_funnel(row)
    by_gate = {gate.gate: gate for gate in funnel.gates}

    live_decision = safe_str(row.get("final_decision"), "").upper()
    blocking = next((name for name in _NON_SCORE_GATES if name in by_gate and not by_gate[name].passed), None)

    if blocking is not None:
        # Something other than the score stopped it; both rules agree.
        decision = funnel.predicted_decision
        gate = blocking
    else:
        score = safe_float(row.get("final_score"), np.nan)
        if np.isnan(score):
            decision, gate = funnel.predicted_decision, funnel.blocking_gate
        elif settings.mode == "band":
            inside = settings.band_low <= score <= settings.band_high
            decision = "ENTER" if inside else "WATCH"
            gate = "passed" if inside else "final_score_band"
        else:
            score_gate = by_gate.get("final_score")
            passed = bool(score_gate.passed) if score_gate is not None else False
            decision = "ENTER" if passed else "WATCH"
            gate = "passed" if passed else "final_score"

    return ShadowDecision(
        decision=decision,
        blocking_gate=gate,
        rule=settings.label,
        differs_from_live=bool(live_decision and decision != live_decision),
        # The trade plan already exists on every row; what has been missing is a
        # decision that lets it be shown. Nothing here is recomputed.
        entry_zone=safe_str(row.get("buy_zone"), "") or safe_str(row.get("entry_zone"), ""),
        stop_loss=safe_str(row.get("stop_loss"), ""),
        target_zone=safe_str(row.get("take_profit_zone"), ""),
        risk_reward=safe_float(row.get("risk_reward"), np.nan),
    )


SHADOW_COLUMNS: Final[tuple[str, ...]] = (
    "shadow_decision",
    "shadow_blocking_gate",
    "shadow_rule",
    "shadow_differs_from_live",
    "shadow_entry_zone",
    "shadow_stop_loss",
    "shadow_target_zone",
    "shadow_risk_reward",
)


def apply_shadow_decision(df_rank: pd.DataFrame, config: ShadowConfig | None = None) -> pd.DataFrame:
    """Add the `shadow_*` columns. Touches no existing column."""
    if df_rank.empty:
        return df_rank
    settings = config if config is not None else shadow_config()
    working = df_rank.copy()
    evaluations = [evaluate_shadow_decision(row, settings) for _, row in working.iterrows()]
    working["shadow_decision"] = [item.decision for item in evaluations]
    working["shadow_blocking_gate"] = [item.blocking_gate for item in evaluations]
    working["shadow_rule"] = [item.rule for item in evaluations]
    working["shadow_differs_from_live"] = [item.differs_from_live for item in evaluations]
    working["shadow_entry_zone"] = [item.entry_zone for item in evaluations]
    working["shadow_stop_loss"] = [item.stop_loss for item in evaluations]
    working["shadow_target_zone"] = [item.target_zone for item in evaluations]
    working["shadow_risk_reward"] = [item.risk_reward for item in evaluations]
    return working


def shadow_summary(df_rank: pd.DataFrame) -> dict[str, object]:
    """Scan-level comparison of the two rules."""
    if df_rank.empty or "shadow_decision" not in df_rank.columns:
        return {"rows": 0, "rule": None, "shadow_enter": 0, "live_enter": 0, "differs": 0}

    live = df_rank.get("final_decision", pd.Series(dtype=str)).map(lambda value: safe_str(value, "").upper())
    shadow = df_rank["shadow_decision"].map(lambda value: safe_str(value, "").upper())
    rules = [value for value in df_rank["shadow_rule"] if safe_str(value, "")]
    return {
        "rows": int(len(df_rank)),
        "rule": rules[0] if rules else None,
        "live_enter": int((live == "ENTER").sum()),
        "shadow_enter": int((shadow == "ENTER").sum()),
        "differs": int(df_rank["shadow_differs_from_live"].astype(bool).sum()),
    }
