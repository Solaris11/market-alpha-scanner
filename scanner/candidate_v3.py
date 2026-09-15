"""Candidate v3 — an *actionable* decision stage, evaluated beside the live one.

v1 and v2 answered "is this safe to enter?" and, on a normal day, answered no
to every row: the live engine produces ENTER for ~0.05% of rows and v2 for
0.3-1%. Both inherit the same three upstream faults (a SELL action mapped
straight to EXIT, a `setup_type` that carries a verdict, and a score floor of
80 that sits above the band where the edge actually lives), and both judge
breakouts with a *partial* current-bar volume, which is why BREAKOUT is 0 on an
intraday scan.

v3 is built from the replay study in
`docs/analysis/candidate-v3-actionability-20260915.md`, run on matured
`forward_returns` from production (13,372 symbol-days, 2026-05-05 to
2026-09-09, deduplicated to one row per symbol per day). Two ENTER paths
survived that study:

  CORE      buy action, enterable location, a classified setup shape,
            effective confidence >= 75, final score inside the 55-70 band,
            balanced risk/reward >= 1.5.
            Replay: 5D median +0.74% / hit 56.6% / p10 -4.13%,
                    10D median +0.99% / hit 59.9%   (baseline +0.37 / 54.5 / -5.29)

  BREAKOUT  buy action, enterable location, breakout >= 72, *completed-bar*
            relative volume >= 55, momentum >= 60. Deliberately not gated on
            confidence or the score band: adding a confidence floor to this
            path halved the sample and turned the 10D median negative.
            Replay: 5D median +0.90% / hit 66.8%, 20D median +5.74% / hit 76.0%

  Union: 5D median +0.87% / hit 62.5% / p10 -4.55%, 10D median +0.99% /
  hit 60.0%, 20D median +2.97% / hit 69.9%, 4.2% of the non-sell universe,
  100% WHERE-complete, no sector above 24% and no symbol above 3.8%.

and one WAIT path:

  WAIT_PULLBACK  price has run past the entry (OVEREXTENDED / WAIT PULLBACK)
                 but the setup is real and a zone, a stop and a target exist.
                 These are the rows the live engine turns into AVOID, which is
                 what "we are missing opportunities" mostly means in practice.

Every actionable row answers the three questions the product asks:
WHAT (the decision), WHERE (entry zone, stop, three targets) and WHICH
(`candidate_v3_actionability_rank` plus `candidate_v3_capital_rank_reason`).

Like v2 this module is **observation only**: it writes `candidate_v3_*`
columns and never touches `final_decision`, in any `SCANNER_DECISION_MODE`.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Final

import numpy as np
import pandas as pd

from .decision_funnel import ADVISORY_VETOES, _veto_list
from .final_decision import BUY_ACTIONS, SELL_ACTIONS, _action_for_row, _normalized
from .utils import safe_float, safe_str

#: Data or risk conditions that genuinely stop a trade. Anything else is
#: advisory and costs confidence instead of blocking. POOR_RISK_REWARD is
#: deliberately absent: it is the live engine's verdict on the
#: nearest-resistance number, which the replay showed to be anti-predictive
#: (nearest-resistance rr >= 1.5 scored *below* the unfiltered pool). v3
#: re-derives it from the balanced target and only then treats it as severe.
V3_SEVERE_VETOES: Final[frozenset[str]] = frozenset(
    {"STALE_DATA", "PROVIDER_ERROR", "EXTREME_VOLATILITY", "STOP_RISK"}
)

#: Confidence cost per advisory flag, and the most they can cost together.
#: This moves the *reported* confidence and the capital ranking, never the
#: entry gate: the replay grid that fixed the 75 threshold measured the raw
#: score, so gating on a penalised one would claim evidence it does not have.
V3_ADVISORY_PENALTY: Final[float] = 4.0
V3_ADVISORY_PENALTY_CAP: Final[float] = 12.0

V3_ENTRY_STATUSES: Final[frozenset[str]] = frozenset({"GOOD ENTRY", "BUY ZONE", "NEAR ENTRY"})
V3_LATE_STATUSES: Final[frozenset[str]] = frozenset({"OVEREXTENDED", "WAIT PULLBACK"})

V3_COLUMNS: Final[tuple[str, ...]] = (
    "candidate_v3_decision",
    "candidate_v3_setup_type",
    "candidate_v3_path",
    "candidate_v3_reason_codes",
    "candidate_v3_confidence",
    "candidate_v3_entry_low",
    "candidate_v3_entry_high",
    "candidate_v3_stop",
    "candidate_v3_target_1",
    "candidate_v3_target_2",
    "candidate_v3_target_3",
    "candidate_v3_rr",
    "candidate_v3_actionability_rank",
    "candidate_v3_capital_rank_reason",
    "candidate_v3_why",
    "candidate_v3_why_wait",
    "candidate_v3_confirmation",
    "candidate_v3_invalidation",
)


@dataclass(frozen=True)
class V3Config:
    """Thresholds, each one carried by the replay grid rather than by taste."""

    core_confidence_min: float = 75.0
    core_band_low: float = 55.0
    core_band_high: float = 70.0
    core_rr_min: float = 1.5
    breakout_min: float = 72.0
    breakout_volume_min: float = 55.0
    breakout_momentum_min: float = 60.0
    wait_rr_min: float = 1.2
    #: Pre-expansion is evidence, never a gate: the field did not exist for any
    #: row with matured returns, so no threshold on it can claim replay support.
    pre_expansion_bonus: float = 45.0


V3_DEFAULTS: Final[V3Config] = V3Config()

#: Unsigned on purpose. Level fields are ranges written as "318.58-323.99",
#: and a signed pattern reads that hyphen as a minus, turning the top of the
#: entry zone into a negative number.
_NUMBER_RE: Final[re.Pattern[str]] = re.compile(r"\d+(?:\.\d+)?")


def _numbers(value: object) -> list[float]:
    if value is None:
        return []
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        return [] if np.isnan(number) else [number]
    text = safe_str(value, "")
    if not text or text.upper() in {"N/A", "NAN", "NONE"}:
        return []
    out: list[float] = []
    for match in _NUMBER_RE.findall(text.replace(",", "")):
        try:
            out.append(float(match))
        except ValueError:
            continue
    return out


def _level(row: pd.Series, *columns: str) -> float | None:
    for column in columns:
        numbers = _numbers(row.get(column))
        if numbers:
            return float(numbers[0])
    return None


def _zone(row: pd.Series) -> tuple[float | None, float | None]:
    low = safe_float(row.get("buy_zone_low"), np.nan)
    high = safe_float(row.get("buy_zone_high"), np.nan)
    if not np.isnan(low) and not np.isnan(high):
        return (min(float(low), float(high)), max(float(low), float(high)))
    for column in ("buy_zone", "entry_zone"):
        numbers = _numbers(row.get(column))
        if len(numbers) >= 2:
            return (min(numbers[0], numbers[1]), max(numbers[0], numbers[1]))
        if len(numbers) == 1:
            return (numbers[0], numbers[0])
    return (None, None)


def _completed(row: pd.Series, completed_column: str, live_column: str) -> float:
    """Prefer the last *completed* bar's feature. Intraday, the live value is
    computed on a partial bar: on production the median relative-volume score
    reads 24.6 live against 51.7 completed, which is the whole reason the live
    breakout branch never fires during a session."""
    value = safe_float(row.get(completed_column), np.nan)
    if not np.isnan(value):
        return float(value)
    return safe_float(row.get(live_column), np.nan)


def v3_setup_type(row: pd.Series) -> str:
    """Shape, never a verdict. Location is judged separately."""
    trend = safe_float(row.get("trend_score"), np.nan)
    momentum = safe_float(row.get("momentum_score"), np.nan)
    avwap = safe_float(row.get("avwap_score"), np.nan)
    breakout = _completed(row, "breakout_score_completed", "breakout_score")
    detail = _normalized(row.get("setup_detail"))
    if "BREAKOUT" in detail or (not np.isnan(breakout) and breakout >= V3_DEFAULTS.breakout_min):
        return "BREAKOUT"
    near_pullback = "PULLBACK" in detail or "AVWAP" in detail or (not np.isnan(avwap) and avwap >= 62.0)
    if near_pullback and not np.isnan(trend) and trend >= 70.0:
        return "PULLBACK"
    if not np.isnan(trend) and trend >= 72.0 and not np.isnan(momentum) and momentum >= 58.0:
        return "CONTINUATION"
    return "UNCLASSIFIED"


def _severe_and_advisory(row: pd.Series, balanced_rr: float, config: V3Config) -> tuple[list[str], list[str]]:
    codes = [safe_str(code, "").upper() for code in _veto_list(row.get("vetoes")) if safe_str(code, "")]
    severe = sorted({code for code in codes if code in V3_SEVERE_VETOES})
    advisory = sorted({code for code in codes if code in ADVISORY_VETOES})
    if "POOR_RISK_REWARD" in codes:
        # Re-decided on the balanced target. Severe only if that number is bad too.
        if not np.isnan(balanced_rr) and balanced_rr >= config.wait_rr_min:
            advisory.append("POOR_RISK_REWARD_NEAREST_RESISTANCE")
        else:
            severe.append("POOR_RISK_REWARD")
    return sorted(set(severe)), sorted(set(advisory))


def _where(row: pd.Series) -> dict[str, float | None]:
    entry_low, entry_high = _zone(row)
    stop = _level(row, "stop_loss", "invalidation_level")
    target_1 = _level(row, "conservative_target", "take_profit_low")
    target_2 = _level(row, "balanced_target")
    target_3 = _level(row, "aggressive_target", "take_profit_high")
    return {
        "entry_low": entry_low,
        "entry_high": entry_high,
        "stop": stop,
        "target_1": target_1,
        "target_2": target_2,
        "target_3": target_3,
    }


def _where_complete(where: dict[str, float | None]) -> bool:
    """WHERE-complete means a trader can act without inventing a number:
    an entry zone, an invalidation below it, and at least one target above."""
    entry_low, entry_high, stop = where["entry_low"], where["entry_high"], where["stop"]
    targets = [value for key, value in where.items() if key.startswith("target_") and value is not None]
    if entry_low is None or entry_high is None or stop is None or not targets:
        return False
    if entry_low <= 0 or stop <= 0 or stop >= entry_low:
        return False
    return max(targets) > entry_high


def _balanced_rr(row: pd.Series) -> float:
    balanced = safe_float(row.get("balanced_risk_reward_low"), np.nan)
    if not np.isnan(balanced):
        return float(balanced)
    return safe_float(row.get("risk_reward"), np.nan)


def _quality(path: str, confidence: float, rr: float, row: pd.Series, config: V3Config) -> float:
    """Ordering score for WHICH. Breakout leads because its replay cohort is
    the stronger one (5D hit 66.8% against 56.6% for the band core)."""
    breakout = _completed(row, "breakout_score_completed", "breakout_score")
    volume = _completed(row, "relative_volume_score_completed", "relative_volume_score")
    trend = safe_float(row.get("trend_score"), np.nan)
    pre = safe_float(row.get("pre_expansion_score"), np.nan)
    score = 0.0
    if path == "BREAKOUT":
        score += 30.0
        score += 0.0 if np.isnan(breakout) else min(breakout, 100.0) * 0.20
        score += 0.0 if np.isnan(volume) else min(volume, 100.0) * 0.15
    else:
        score += 0.0 if np.isnan(confidence) else confidence * 0.25
        score += 0.0 if np.isnan(trend) else trend * 0.05
    score += 0.0 if np.isnan(rr) else min(rr, 5.0) * 4.0
    if not np.isnan(pre) and pre >= config.pre_expansion_bonus:
        score += 3.0
    return round(score, 3)


def evaluate_candidate_v3(row: pd.Series, config: V3Config | None = None) -> dict[str, object]:
    settings = config if config is not None else V3_DEFAULTS
    action = _normalized(_action_for_row(row))
    entry_status = _normalized(row.get("entry_status"))
    setup_type = v3_setup_type(row)
    rr = _balanced_rr(row)
    severe, advisory = _severe_and_advisory(row, rr, settings)
    confidence = safe_float(row.get("confidence_score"), np.nan)
    penalty = min(V3_ADVISORY_PENALTY * len(advisory), V3_ADVISORY_PENALTY_CAP)
    effective = confidence - penalty if not np.isnan(confidence) else confidence
    where = _where(row)
    complete = _where_complete(where)
    score = safe_float(row.get("final_score"), np.nan)
    breakout = _completed(row, "breakout_score_completed", "breakout_score")
    volume = _completed(row, "relative_volume_score_completed", "relative_volume_score")
    momentum = safe_float(row.get("momentum_score"), np.nan)

    codes: list[str] = [f"ADVISORY_{code}" for code in advisory]
    if not np.isnan(volume) and safe_str(row.get("last_bar_partial"), "").lower() in {"true", "1", "yes"}:
        codes.append("VOLUME_COMPLETED_BAR")

    def out(decision: str, why: str, *extra: str, path: str = "", why_wait: str = "",
            confirmation: str = "", quality: float = 0.0) -> dict[str, object]:
        return {
            "candidate_v3_decision": decision,
            "candidate_v3_setup_type": setup_type,
            "candidate_v3_path": path,
            "candidate_v3_reason_codes": sorted(set(codes + list(extra))),
            "candidate_v3_confidence": None if np.isnan(effective) else round(float(effective), 2),
            "candidate_v3_entry_low": where["entry_low"],
            "candidate_v3_entry_high": where["entry_high"],
            "candidate_v3_stop": where["stop"],
            "candidate_v3_target_1": where["target_1"],
            "candidate_v3_target_2": where["target_2"],
            "candidate_v3_target_3": where["target_3"],
            "candidate_v3_rr": None if np.isnan(rr) else round(float(rr), 2),
            "candidate_v3_actionability_rank": 0,
            "candidate_v3_capital_rank_reason": "",
            "candidate_v3_why": why,
            "candidate_v3_why_wait": why_wait,
            "candidate_v3_confirmation": confirmation,
            "candidate_v3_invalidation": (
                f"{where['stop']:.2f}" if decision in {"ENTER", "WAIT_PULLBACK"} and where["stop"] is not None else ""
            ),
            "_v3_quality": quality,
        }

    if severe:
        return out(
            "AVOID",
            f"Blocked on data or risk integrity: {', '.join(severe)}.",
            "SEVERE_VETO",
            *[f"SEVERE_{code}" for code in severe],
        )
    if action in SELL_ACTIONS:
        # Not EXIT. EXIT is an instruction to someone holding the symbol; for
        # everyone else the honest label is "there is nothing to enter here".
        return out(
            "NO_ENTRY",
            "The trend model is on a sell signal, so there is no entry here. "
            "EXIT applies only to an open position in this symbol.",
            "SELL_SIGNAL",
        )
    if action not in BUY_ACTIONS:
        return out("WATCH", "The trend model is not on a buy signal yet.", "NO_BUY_SIGNAL")

    if entry_status in V3_ENTRY_STATUSES:
        if not complete:
            return out(
                "WATCH",
                "The setup is in an enterable location but the levels are incomplete, "
                "so there is no honest entry, stop and target to publish.",
                "WHERE_INCOMPLETE",
            )
        breakout_ok = (
            not np.isnan(breakout) and breakout >= settings.breakout_min
            and not np.isnan(volume) and volume >= settings.breakout_volume_min
            and not np.isnan(momentum) and momentum >= settings.breakout_momentum_min
        )
        if breakout_ok:
            quality = _quality("BREAKOUT", effective, rr, row, settings)
            return out(
                "ENTER",
                f"Breakout with real participation: breakout {breakout:.0f}, completed-bar volume "
                f"{volume:.0f}, momentum {momentum:.0f}, and price still inside the entry zone. "
                f"Risk/reward {rr:.2f} to the balanced target.",
                "BREAKOUT_CONFIRMED",
                "IN_ENTRY_ZONE",
                path="BREAKOUT",
                confirmation="Entry is live while price holds the zone; the trade is wrong below the stop.",
                quality=quality,
            )
        band_ok = not np.isnan(score) and settings.core_band_low <= score <= settings.core_band_high
        classified = setup_type != "UNCLASSIFIED"
        # The replay grid measured the raw confidence score, so that is what
        # gates. Advisory flags cost reported confidence and ranking position,
        # never the entry itself.
        confidence_ok = not np.isnan(confidence) and confidence >= settings.core_confidence_min
        rr_ok = not np.isnan(rr) and rr >= settings.core_rr_min
        if band_ok and classified and confidence_ok and rr_ok:
            quality = _quality("CORE", effective, rr, row, settings)
            return out(
                "ENTER",
                f"A {setup_type.lower()} setup with price in the entry zone: score {score:.0f} inside the "
                f"{settings.core_band_low:.0f}-{settings.core_band_high:.0f} evidence band, confidence "
                f"{confidence:.0f}{'' if not advisory else f' ({effective:.0f} after advisory flags)'}, "
                f"risk/reward {rr:.2f} to the balanced target.",
                "BAND_CORE",
                "IN_ENTRY_ZONE",
                path="CORE",
                confirmation="Entry is live while price holds the zone; the trade is wrong below the stop.",
                quality=quality,
            )
        missing: list[str] = []
        if not classified:
            missing.append("NO_SETUP_SHAPE")
        if not band_ok:
            missing.append("ABOVE_ENTRY_BAND" if not np.isnan(score) and score > settings.core_band_high else "BELOW_ENTRY_BAND")
        if not confidence_ok:
            missing.append("LOW_CONFIDENCE")
        if not rr_ok:
            missing.append("RR_BELOW_FLOOR")
        return out(
            "WATCH",
            "In an enterable location but short of the entry evidence: "
            + ", ".join(code.lower().replace("_", " ") for code in missing)
            + ".",
            *missing,
        )

    if entry_status in V3_LATE_STATUSES:
        classified = setup_type != "UNCLASSIFIED"
        rr_ok = not np.isnan(rr) and rr >= settings.wait_rr_min
        if complete and classified and rr_ok:
            low, high = where["entry_low"], where["entry_high"]
            quality = _quality("CORE", effective, rr, row, settings) - 10.0
            return out(
                "WAIT_PULLBACK",
                f"A {setup_type.lower()} setup worth owning, but price has run past the entry "
                f"({entry_status.lower()}). The zone below is where it becomes tradable again.",
                "LATE_ENTRY",
                "PULLBACK_ZONE_AVAILABLE",
                path="PULLBACK",
                why_wait=(
                    f"Buying here pays for the move that already happened. Wait for "
                    f"{low:.2f}-{high:.2f}."
                    if low is not None and high is not None
                    else "Buying here pays for the move that already happened."
                ),
                confirmation=(
                    f"Take the entry when price trades back into {low:.2f}-{high:.2f} and holds it on a close; "
                    f"abandon it if price closes below {where['stop']:.2f} first."
                    if low is not None and high is not None and where["stop"] is not None
                    else "Take the entry only on a close back inside the zone."
                ),
                quality=quality,
            )
        if not complete:
            return out("WATCH", "Price has run past the entry and no clean pullback level is available.", "LATE_ENTRY", "WHERE_INCOMPLETE")
        if not classified:
            return out("WATCH", "Price has run past the entry and the setup shape is unclear.", "LATE_ENTRY", "NO_SETUP_SHAPE")
        return out("WATCH", "Price has run past the entry and the pullback would still not pay for its risk.", "LATE_ENTRY", "RR_BELOW_FLOOR")

    return out("WATCH", f"Price is not in an actionable location ({entry_status.lower() or 'unknown'}).", "ENTRY_LOCATION")


def _rank_reason(rank: int, total: int, record: dict[str, object]) -> str:
    path = safe_str(record.get("candidate_v3_path"), "")
    rr = record.get("candidate_v3_rr")
    confidence = record.get("candidate_v3_confidence")
    decision = safe_str(record.get("candidate_v3_decision"), "")
    rr_text = f"{float(rr):.2f}R" if isinstance(rr, (int, float)) else "an unquantified reward"
    if decision == "ENTER" and path == "BREAKOUT":
        return (
            f"Rank {rank} of {total} actionable. Breakout path with completed-bar volume and {rr_text} to the "
            f"balanced target; in replay this cohort hit 66.8% at 5D against 56.6% for the band core, so it takes "
            f"capital ahead of pullback candidates of similar size."
        )
    if decision == "ENTER":
        conf_text = f"confidence {float(confidence):.0f}" if isinstance(confidence, (int, float)) else "confidence unavailable"
        return (
            f"Rank {rank} of {total} actionable. Band-core entry, {conf_text} and {rr_text} to the balanced target; "
            f"ranks by confidence and reward among entries that are live right now."
        )
    return (
        f"Rank {rank} of {total} actionable. Waiting on a pullback, so it holds no capital today; it ranks below "
        f"every live entry and above the rest of the book because the zone, stop and target are already defined."
    )


def apply_candidate_v3(df_rank: pd.DataFrame, config: V3Config | None = None) -> pd.DataFrame:
    """Add `candidate_v3_*` columns. Never touches `final_decision`, in any mode."""
    if df_rank.empty:
        return df_rank
    settings = config if config is not None else V3_DEFAULTS
    working = df_rank.copy()
    results = [evaluate_candidate_v3(row, settings) for _, row in working.iterrows()]

    order = {"ENTER": 0, "WAIT_PULLBACK": 1}
    actionable = [
        index for index, item in enumerate(results)
        if safe_str(item["candidate_v3_decision"], "") in order
    ]
    actionable.sort(
        key=lambda index: (
            order[safe_str(results[index]["candidate_v3_decision"], "")],
            -float(results[index].get("_v3_quality") or 0.0),
        )
    )
    total = len(actionable)
    for position, index in enumerate(actionable, start=1):
        results[index]["candidate_v3_actionability_rank"] = position
        results[index]["candidate_v3_capital_rank_reason"] = _rank_reason(position, total, results[index])

    for column in V3_COLUMNS:
        working[column] = [item[column] for item in results]
    return working


def candidate_v3_summary(df_rank: pd.DataFrame) -> dict[str, object]:
    if df_rank.empty or "candidate_v3_decision" not in df_rank.columns:
        return {"rows": 0}
    decisions = df_rank["candidate_v3_decision"].map(lambda value: safe_str(value, "").upper())
    counts: dict[str, int] = {}
    for value in decisions:
        counts[value] = counts.get(value, 0) + 1
    actionable = df_rank[decisions.isin(["ENTER", "WAIT_PULLBACK"])]
    enters = df_rank[decisions == "ENTER"]
    where_complete = 0
    for _, row in actionable.iterrows():
        levels = {
            "entry_low": row.get("candidate_v3_entry_low"),
            "entry_high": row.get("candidate_v3_entry_high"),
            "stop": row.get("candidate_v3_stop"),
            "target_1": row.get("candidate_v3_target_1"),
            "target_2": row.get("candidate_v3_target_2"),
            "target_3": row.get("candidate_v3_target_3"),
        }
        cleaned = {key: (None if value is None or (isinstance(value, float) and np.isnan(value)) else float(value)) for key, value in levels.items()}
        if _where_complete(cleaned):
            where_complete += 1
    paths = enters["candidate_v3_path"].map(lambda value: safe_str(value, "")) if not enters.empty else pd.Series(dtype=str)
    return {
        "rows": int(len(df_rank)),
        "by_decision": counts,
        "actionable": int(len(actionable)),
        "where_complete": int(where_complete),
        "enter_breakout": int((paths == "BREAKOUT").sum()) if len(paths) else 0,
        "enter_core": int((paths == "CORE").sum()) if len(paths) else 0,
    }
