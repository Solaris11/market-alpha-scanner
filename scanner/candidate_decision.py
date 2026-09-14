"""A candidate decision engine, evaluated beside the live one.

The live engine produces ENTER for about 0.05% of rows. The audit
(`docs/analysis/scanner-decision-audit-20260905.md`) traced that to four
structural faults rather than one threshold:

  1. `setup_type` carries a *verdict* ("AVOID") in a *classification* field,
     arriving through the catch-all else branch, so it is the default outcome.
  2. That verdict is then counted twice -- once as a class, again as a -25
     quality penalty via a capped `setup_strength`.
  3. `trade_permitted` requires the veto list to be empty, so an advisory flag
     like HIGH_VOLATILITY blocks entry exactly as hard as a stale feed, and a
     market-wide regime flag would block every symbol at once.
  4. Every expansion feature is backward-looking, so a move is only visible
     after it happens -- and is then rejected for having happened.

This module fixes all four, and is wired to nothing by default.
`SCANNER_DECISION_MODE` selects which engine's verdict becomes
`final_decision`; it defaults to `current`, so a deploy changes no behaviour.
In either mode the candidate's full reasoning is written to `candidate_*`
columns, which is what makes the comparison measurable before it is trusted.

The design rule throughout: **a candidate that simply says ENTER more often is
a worse engine, not a better one.** Every relaxation here is paired with a
constraint the live engine does not have -- chase rejection, an entry band
rather than a floor, a real risk/reward minimum per setup shape, and honest
abstention when the data cannot support a call.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Final, Literal

import numpy as np
import pandas as pd

from .decision_funnel import ADVISORY_VETOES, SEVERE_VETOES, _veto_list
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
from .utils import safe_float, safe_str

SetupClass = Literal["PULLBACK", "BREAKOUT", "CONTINUATION", "NONE"]

DEFAULT_DECISION_MODE: Final[str] = "current"

#: The band the holdout study measured inside the real decision cohort.
DEFAULT_BAND_LOW: Final[float] = 55.0
DEFAULT_BAND_HIGH: Final[float] = 70.0

#: Risk/reward floors by setup shape. The live engine carries these in
#: SETUP_THRESHOLDS but never applies min_risk_reward at the decision stage.
MIN_RISK_REWARD: Final[dict[str, float]] = {
    "PULLBACK": 1.10,
    "BREAKOUT": 1.50,
    "CONTINUATION": 1.30,
    "NONE": 1.20,
}

#: A pre-expansion score below this is not a setup worth entering, even if
#: every other gate passes. None (unmeasurable) is treated as "unknown", which
#: abstains rather than admits.
MIN_PRE_EXPANSION: Final[float] = 45.0

#: The entry_status values that mean *price has run past the entry*, as
#: opposed to the location simply being unknown. `analysis._entry_status` and
#: `analysis._lifecycle_entry_status` between them emit GOOD ENTRY, NEAR ENTRY,
#: BUY ZONE, WAIT PULLBACK, OVEREXTENDED, STOP RISK and REVIEW. Only the two
#: below describe a move that has already left its zone, and only for those is
#: "wait for the pullback" the honest answer rather than a guess.
LATE_ENTRY_STATUSES: Final[frozenset[str]] = frozenset({"OVEREXTENDED", "WAIT PULLBACK"})


@dataclass(frozen=True)
class CandidateConfig:
    mode: str = DEFAULT_DECISION_MODE
    band_low: float = DEFAULT_BAND_LOW
    band_high: float = DEFAULT_BAND_HIGH
    require_pre_expansion: bool = True

    @property
    def is_candidate(self) -> bool:
        return self.mode == "candidate"


def candidate_config(env: dict[str, str] | None = None) -> CandidateConfig:
    """Read the engine selection. Anything unrecognised falls back to current."""
    source = env if env is not None else os.environ
    mode = safe_str(source.get("SCANNER_DECISION_MODE"), DEFAULT_DECISION_MODE).strip().lower()
    if mode not in {"current", "candidate"}:
        mode = DEFAULT_DECISION_MODE

    def _bound(key: str, fallback: float) -> float:
        value = safe_float(source.get(key), np.nan)
        return float(value) if not np.isnan(value) else fallback

    low = _bound("SCANNER_ENTRY_BAND_LOW", DEFAULT_BAND_LOW)
    high = _bound("SCANNER_ENTRY_BAND_HIGH", DEFAULT_BAND_HIGH)
    if low > high:
        low, high = high, low
    require = safe_str(source.get("SCANNER_REQUIRE_PRE_EXPANSION"), "1").strip().lower() not in {"0", "false", "no"}
    return CandidateConfig(mode=mode, band_low=low, band_high=high, require_pre_expansion=require)


@dataclass(frozen=True)
class CandidateDecision:
    decision: str
    entry_status: str
    setup_class: str
    reason_codes: list[str] = field(default_factory=list)
    why: str = ""
    entry_zone: str = ""
    stop_loss: str = ""
    target_zone: str = ""
    risk_reward: float = float("nan")
    pre_expansion_score: float | None = None
    already_expanded: bool = False
    severe_vetoes: list[str] = field(default_factory=list)
    advisory_vetoes: list[str] = field(default_factory=list)
    confidence_penalty: float = 0.0


def _setup_class(row: pd.Series) -> str:
    """The setup's *shape*, never a verdict.

    The live classifier returns AVOID in the same field as PULLBACK, which
    conflates "this is not a shape I recognise" with "do not trade this". Here
    an unrecognised shape is NONE and carries no penalty of its own -- the
    verdict is reached separately, from evidence, and stated separately.
    """
    declared = _normalized(row.get("setup_type"))
    if declared in {"PULLBACK", "BREAKOUT", "CONTINUATION"}:
        return declared

    # `setup_detail` is the free-text shape `derive_setup_type` produced --
    # "pullback to AVWAP", "breakout continuation", "trend continuation",
    # "extended / watch pullback", "mixed setup". `setup_engine` preserves it
    # in that column and then overwrites `setup_type` with the verdict AVOID,
    # so the shape survives even when the classification has been thrown away.
    # Order matters: "breakout continuation" is a breakout, so breakout is
    # tested before continuation.
    detail = _normalized(row.get("setup_detail"))
    if "EXTENDED" in detail:
        # The scorer already knows the move has run. That is a location, not a
        # shape, and it is handled by the chase discriminator below -- but it
        # is emphatically not a breakout to be entered.
        return "PULLBACK" if "PULLBACK" in detail else "NONE"
    if "BREAKOUT" in detail:
        return "BREAKOUT"
    if "PULLBACK" in detail or "AVWAP" in detail:
        return "PULLBACK"
    if "CONTINUATION" in detail or "TREND" in detail:
        return "CONTINUATION"
    return "NONE"


def evaluate_candidate_decision(row: pd.Series, config: CandidateConfig | None = None) -> CandidateDecision:
    settings = config if config is not None else candidate_config()

    action = _normalized(_action_for_row(row))
    quality = _normalized_quality(row.get("recommendation_quality"))
    live_entry_status = _normalized(row.get("entry_status"))
    setup_class = _setup_class(row)

    vetoes = _veto_list(row.get("vetoes"))
    severe = [code for code in vetoes if code in SEVERE_VETOES]
    advisory = [code for code in vetoes if code in ADVISORY_VETOES]

    score = safe_float(row.get("final_score"), np.nan)
    confidence = safe_float(row.get("confidence_score"), np.nan)
    risk_reward = safe_float(row.get("risk_reward"), np.nan)
    pre_expansion = row.get("pre_expansion_score")
    pre_score = None if pre_expansion is None or (isinstance(pre_expansion, float) and np.isnan(pre_expansion)) else float(pre_expansion)
    already_expanded = bool(row.get("pre_expansion_already_expanded", False))

    entry_zone = safe_str(row.get("buy_zone"), "") or safe_str(row.get("entry_zone"), "")
    stop_loss = safe_str(row.get("stop_loss"), "")
    target_zone = safe_str(row.get("take_profit_zone"), "")

    reasons: list[str] = []
    # Advisory conditions cost confidence instead of blocking outright. The
    # live engine cannot express this: `trade_permitted` requires an empty
    # list, so HIGH_VOLATILITY blocks exactly as hard as a stale feed.
    confidence_penalty = 6.0 * len(advisory)
    effective_confidence = confidence - confidence_penalty if not np.isnan(confidence) else confidence
    for code in advisory:
        reasons.append(f"ADVISORY_{code}")

    def verdict(decision: str, why: str, *codes: str) -> CandidateDecision:
        return CandidateDecision(
            decision=decision,
            entry_status=live_entry_status,
            setup_class=setup_class,
            reason_codes=sorted(set(reasons + list(codes))),
            why=why,
            entry_zone=entry_zone,
            stop_loss=stop_loss,
            target_zone=target_zone,
            risk_reward=risk_reward,
            pre_expansion_score=pre_score,
            already_expanded=already_expanded,
            severe_vetoes=severe,
            advisory_vetoes=advisory,
            confidence_penalty=confidence_penalty,
        )

    # --- hard stops ------------------------------------------------------
    if action in SELL_ACTIONS:
        return verdict("EXIT", "The trend model is on a sell signal, so there is nothing to enter.", "SELL_SIGNAL")

    if severe:
        return verdict(
            "AVOID",
            f"Blocked on data or risk integrity: {', '.join(severe)}. The scan will not guess past this.",
            "SEVERE_VETO",
        )

    if not np.isnan(risk_reward) and risk_reward < MIN_RISK_REWARD.get(setup_class, 1.2):
        floor = MIN_RISK_REWARD.get(setup_class, 1.2)
        return verdict(
            "AVOID",
            f"Risk/reward is {risk_reward:.2f} against a {floor:.2f} minimum for a {setup_class.lower()} setup.",
            "POOR_RISK_REWARD",
        )

    # --- the chase discriminator -----------------------------------------
    # This is the fault the whole exercise exists to fix. The live engine sees
    # expansion only after it happens and then rejects it as OVEREXTENDED,
    # which reads to a trader as "no signal" rather than "you are late".
    if already_expanded:
        if _has_suggested_entry(_wait_suggested_entry(row)):
            return verdict(
                "WAIT_PULLBACK",
                "The move has already expanded. This is a chase from here; the entry zone below is where it becomes "
                "interesting again.",
                "ALREADY_EXPANDED",
            )
        return verdict(
            "WATCH",
            "The move has already expanded and there is no defined pullback level yet, so there is nothing to act on.",
            "ALREADY_EXPANDED",
            "NO_PULLBACK_LEVEL",
        )

    # --- evidence sufficiency --------------------------------------------
    if settings.require_pre_expansion and pre_score is None:
        return verdict(
            "WATCH",
            "There is not enough price history to judge whether a move is building. Abstaining rather than guessing.",
            "PRE_EXPANSION_UNAVAILABLE",
        )

    if settings.require_pre_expansion and pre_score is not None and pre_score < MIN_PRE_EXPANSION:
        return verdict(
            "WATCH",
            f"No setup is building yet: pre-expansion reads {pre_score:.0f} against a {MIN_PRE_EXPANSION:.0f} minimum.",
            "NO_SETUP_FORMING",
        )

    # --- shape and entry -------------------------------------------------
    if quality == "AVOID":
        return verdict("AVOID", "The quality model rates this poor on its own evidence.", "LOW_QUALITY")

    if action not in BUY_ACTIONS:
        return verdict("WATCH", "The trend model is not on a buy signal yet.", "NO_BUY_SIGNAL")

    if live_entry_status not in ENTER_ENTRY_STATUSES:
        # "Not enterable" covers two different situations and the live engine
        # renders both as silence. A move that has run past its zone has a
        # level worth waiting for; an unknown location does not. Saying WATCH
        # to the first is what reads to a trader as "no signal" when the truth
        # is "you are late, here is where it becomes interesting again".
        if live_entry_status in LATE_ENTRY_STATUSES and _has_suggested_entry(_wait_suggested_entry(row)):
            return verdict(
                "WAIT_PULLBACK",
                f"Price has run past the entry ({live_entry_status.lower()}); the zone below is where the setup "
                "becomes tradable again.",
                "ENTRY_LOCATION",
                "LATE_ENTRY",
            )
        return verdict(
            "WATCH",
            f"Price is not in an enterable location ({live_entry_status.lower() or 'unknown'}).",
            "ENTRY_LOCATION",
        )

    # --- the entry band, not a floor -------------------------------------
    if np.isnan(score):
        return verdict("WATCH", "No final score was produced for this row.", "NO_SCORE")

    if score > settings.band_high:
        # Deliberately not an ENTER. The holdout study found the top decile
        # underperforms baseline at 5D and 10D; a very high score means the
        # move is usually already understood by the market.
        return verdict(
            "WAIT_PULLBACK" if _has_suggested_entry(_wait_suggested_entry(row)) else "WATCH",
            f"Score {score:.0f} is above the {settings.band_high:.0f} band. Historically this range has been late "
            "rather than early.",
            "ABOVE_ENTRY_BAND",
        )

    if score < settings.band_low:
        return verdict(
            "WATCH",
            f"Score {score:.0f} is below the {settings.band_low:.0f} band; the evidence is not there yet.",
            "BELOW_ENTRY_BAND",
        )

    if not np.isnan(effective_confidence) and effective_confidence < 70.0:
        detail = f" after a {confidence_penalty:.0f}-point advisory penalty" if confidence_penalty else ""
        return verdict(
            "WATCH",
            f"Confidence is {effective_confidence:.0f}{detail}, below the 70 needed to act.",
            "LOW_CONFIDENCE",
        )

    pre_text = f"pre-expansion {pre_score:.0f}" if pre_score is not None else "pre-expansion not required"
    return verdict(
        "ENTER",
        f"A {setup_class.lower()} setup is building and price is still in the entry zone: score {score:.0f} inside the "
        f"{settings.band_low:.0f}-{settings.band_high:.0f} band, {pre_text}, risk/reward {risk_reward:.2f}. "
        "Invalidation is the stop below.",
        "SETUP_FORMING",
        "IN_ENTRY_BAND",
    )


# --- candidate v2 --------------------------------------------------------
# Observation only, written beside the v1 candidate. Built from the P1-1
# replay evidence (docs/analysis/scanner-decision-engine-p1-1-24h-followup-
# 20260915.md §5): the band cohort beats baseline, the setup gate earns its
# keep when it is a class rather than a verdict, the nearest-resistance
# risk/reward removes rows that are not worse than baseline, and the
# self-cancelled breakouts are the best cohort in the data. v2 therefore:
#   1. takes freshness from the market-calendar shadow list (`mcal_severe_
#      vetoes`) when present, so a Friday bar on Monday pre-open is not a
#      severe veto;
#   2. classifies the shape from the numeric scores, never from the verdict;
#   3. lets the balanced 1.5R target stand in for a nearest-resistance target
#      that sits inside the breakout band (within BREAKOUT_TARGET_BAND of
#      price), keeping POOR_RISK_REWARD severe only when both fail;
#   4. does not read `recommendation_quality` (it carries the -25 double count);
#   5. keeps the SELL action, the entry-location, the pre-expansion and the
#      band/confidence tests exactly as v1, and additionally records whether
#      the row would have passed everything but the pre-expansion gate, so
#      that gate can be judged on forward returns before it is trusted.
BREAKOUT_TARGET_BAND: Final[float] = 0.04
V2_BREAKOUT_MIN_VOLUME: Final[float] = 55.0

CANDIDATE_V2_COLUMNS: Final[tuple[str, ...]] = (
    "candidate_v2_decision",
    "candidate_v2_setup_class",
    "candidate_v2_reason_codes",
    "candidate_v2_why",
    "candidate_v2_risk_reward",
    "candidate_v2_band_ok",
)


def _v2_setup_class(row: pd.Series) -> str:
    """Shape from the factor scores. Overextension is a location, handled
    later by the entry-status test, and never changes the class."""
    trend = safe_float(row.get("trend_score"), np.nan)
    momentum = safe_float(row.get("momentum_score"), np.nan)
    breakout = safe_float(row.get("breakout_score"), np.nan)
    avwap = safe_float(row.get("avwap_score"), np.nan)
    detail = _normalized(row.get("setup_detail"))
    if "BREAKOUT" in detail or (not np.isnan(breakout) and breakout >= 72.0):
        return "BREAKOUT"
    near_pullback = "PULLBACK" in detail or "AVWAP" in detail or (not np.isnan(avwap) and avwap >= 62.0)
    if near_pullback and not np.isnan(trend) and trend >= 70.0:
        return "PULLBACK"
    if not np.isnan(trend) and trend >= 72.0 and not np.isnan(momentum) and momentum >= 58.0:
        return "CONTINUATION"
    return "NONE"


def _v2_risk_reward(row: pd.Series, setup_class: str) -> tuple[float, str | None]:
    """Nearest-resistance rr, unless that resistance sits inside the breakout
    band above price, in which case the balanced (1.5R) target is the honest
    number. Returns (rr, reason_code_or_None)."""
    rr = safe_float(row.get("risk_reward"), np.nan)
    balanced = safe_float(row.get("balanced_risk_reward_low"), np.nan)
    price = safe_float(row.get("price"), np.nan)
    target_low = safe_float(row.get("take_profit_low"), np.nan)
    floor = MIN_RISK_REWARD.get(setup_class, 1.2)
    if np.isnan(rr) or rr >= floor or np.isnan(balanced):
        return rr, None
    target_inside_band = (
        not np.isnan(price) and price > 0 and not np.isnan(target_low) and target_low > price
        and (target_low - price) / price <= BREAKOUT_TARGET_BAND
    )
    if (setup_class == "BREAKOUT" or target_inside_band) and balanced >= floor:
        return balanced, "RR_BALANCED_TARGET"
    return rr, None


def _v2_severe_and_advisory(row: pd.Series) -> tuple[list[str], list[str], bool]:
    """Severe/advisory split using the market-calendar shadow list when the
    scan persisted one; otherwise the live list. The bool says which."""
    live = _veto_list(row.get("vetoes"))
    mcal = row.get("mcal_vetoes")
    used_mcal = isinstance(mcal, (list, tuple))
    source = list(mcal) if used_mcal else live
    codes = [safe_str(code, "").upper() for code in source if safe_str(code, "")]
    severe = [code for code in codes if code in SEVERE_VETOES]
    advisory = [code for code in codes if code in ADVISORY_VETOES]
    return severe, advisory, used_mcal


def evaluate_candidate_v2(row: pd.Series, config: CandidateConfig | None = None) -> dict[str, object]:
    settings = config if config is not None else candidate_config()
    action = _normalized(_action_for_row(row))
    entry_status = _normalized(row.get("entry_status"))
    setup_class = _v2_setup_class(row)
    severe, advisory, used_mcal = _v2_severe_and_advisory(row)
    rr, rr_code = _v2_risk_reward(row, setup_class)
    floor = MIN_RISK_REWARD.get(setup_class, 1.2)
    # POOR_RISK_REWARD is the live engine's verdict on the nearest-resistance
    # number. v2 re-derives it from its own rr, so drop the inherited code.
    severe = [code for code in severe if code != "POOR_RISK_REWARD"]
    if not np.isnan(rr) and rr < floor:
        severe.append("POOR_RISK_REWARD")
    score = safe_float(row.get("final_score"), np.nan)
    confidence = safe_float(row.get("confidence_score"), np.nan)
    penalty = 6.0 * len(advisory)
    effective_confidence = confidence - penalty if not np.isnan(confidence) else confidence
    pre_raw = row.get("pre_expansion_score")
    pre_score = None if pre_raw is None or (isinstance(pre_raw, float) and np.isnan(pre_raw)) else safe_float(pre_raw, np.nan)
    if pre_score is not None and np.isnan(pre_score):
        pre_score = None
    already_expanded = bool(row.get("pre_expansion_already_expanded", False))
    has_zone = _has_suggested_entry(_wait_suggested_entry(row))

    codes: list[str] = [f"ADVISORY_{code}" for code in advisory]
    if used_mcal:
        codes.append("FRESHNESS_MARKET_CALENDAR")
    if rr_code:
        codes.append(rr_code)
    if setup_class == "BREAKOUT":
        volume = safe_float(row.get("relative_volume_score"), np.nan)
        if not np.isnan(volume) and volume < V2_BREAKOUT_MIN_VOLUME:
            codes.append("BREAKOUT_VOLUME_LIGHT")

    def out(decision: str, why: str, *extra: str, band_ok: bool = False) -> dict[str, object]:
        return {
            "candidate_v2_decision": decision,
            "candidate_v2_setup_class": setup_class,
            "candidate_v2_reason_codes": sorted(set(codes + list(extra))),
            "candidate_v2_why": why,
            "candidate_v2_risk_reward": rr,
            "candidate_v2_band_ok": band_ok,
        }

    if action in SELL_ACTIONS:
        return out("EXIT", "The trend model is on a sell signal, so there is nothing to enter.", "SELL_SIGNAL")
    if severe:
        return out("AVOID", f"Blocked on data or risk integrity: {', '.join(sorted(set(severe)))}.", "SEVERE_VETO", *[f"SEVERE_{c}" for c in sorted(set(severe))])
    if already_expanded:
        return out("WAIT_PULLBACK" if has_zone else "WATCH", "The move has already expanded; this is a chase from here.", "ALREADY_EXPANDED")
    if action not in BUY_ACTIONS:
        return out("WATCH", "The trend model is not on a buy signal yet.", "NO_BUY_SIGNAL")
    if entry_status not in ENTER_ENTRY_STATUSES:
        if entry_status in LATE_ENTRY_STATUSES and has_zone:
            return out("WAIT_PULLBACK", f"Price has run past the entry ({entry_status.lower()}); the zone below is where it becomes tradable again.", "ENTRY_LOCATION", "LATE_ENTRY")
        return out("WATCH", f"Price is not in an enterable location ({entry_status.lower() or 'unknown'}).", "ENTRY_LOCATION")
    if np.isnan(score):
        return out("WATCH", "No final score was produced for this row.", "NO_SCORE")
    if score > settings.band_high:
        return out("WAIT_PULLBACK" if has_zone else "WATCH", f"Score {score:.0f} is above the {settings.band_high:.0f} band; historically late rather than early.", "ABOVE_ENTRY_BAND")
    if score < settings.band_low:
        return out("WATCH", f"Score {score:.0f} is below the {settings.band_low:.0f} band; the evidence is not there yet.", "BELOW_ENTRY_BAND")
    if not np.isnan(effective_confidence) and effective_confidence < 70.0:
        return out("WATCH", f"Confidence is {effective_confidence:.0f} after advisory penalties, below the 70 needed to act.", "LOW_CONFIDENCE")
    # Everything but the pre-expansion gate has passed.
    if settings.require_pre_expansion and pre_score is None:
        return out("WATCH", "Not enough price history to judge whether a move is building; abstaining.", "PRE_EXPANSION_UNAVAILABLE", band_ok=True)
    if settings.require_pre_expansion and pre_score is not None and pre_score < MIN_PRE_EXPANSION:
        return out("WATCH", f"No setup is building yet: pre-expansion reads {pre_score:.0f} against a {MIN_PRE_EXPANSION:.0f} minimum.", "NO_SETUP_FORMING", band_ok=True)
    pre_text = f"pre-expansion {pre_score:.0f}" if pre_score is not None else "pre-expansion not required"
    return out(
        "ENTER",
        f"A {setup_class.lower()} setup is building and price is in the entry zone: score {score:.0f} inside the "
        f"{settings.band_low:.0f}-{settings.band_high:.0f} band, {pre_text}, risk/reward {rr:.2f}.",
        "SETUP_FORMING",
        "IN_ENTRY_BAND",
        band_ok=True,
    )


def apply_candidate_v2(df_rank: pd.DataFrame, config: CandidateConfig | None = None) -> pd.DataFrame:
    """Add `candidate_v2_*` columns. Never touches final_decision in any mode."""
    if df_rank.empty:
        return df_rank
    settings = config if config is not None else candidate_config()
    working = df_rank.copy()
    results = [evaluate_candidate_v2(row, settings) for _, row in working.iterrows()]
    for column in CANDIDATE_V2_COLUMNS:
        working[column] = [item[column] for item in results]
    return working


def candidate_v2_summary(df_rank: pd.DataFrame) -> dict[str, object]:
    if df_rank.empty or "candidate_v2_decision" not in df_rank.columns:
        return {"rows": 0}
    decisions = df_rank["candidate_v2_decision"].map(lambda value: safe_str(value, "").upper())
    counts: dict[str, int] = {}
    for value in decisions:
        counts[value] = counts.get(value, 0) + 1
    return {
        "rows": int(len(df_rank)),
        "by_decision": dict(sorted(counts.items(), key=lambda item: item[1], reverse=True)),
        "enter": int((decisions == "ENTER").sum()),
        "band_ok": int(df_rank["candidate_v2_band_ok"].astype(bool).sum()),
    }


CANDIDATE_COLUMNS: Final[tuple[str, ...]] = (
    "candidate_decision",
    "candidate_setup_class",
    "candidate_reason_codes",
    "candidate_why",
    "candidate_entry_zone",
    "candidate_stop_loss",
    "candidate_target_zone",
    "candidate_risk_reward",
    "candidate_severe_vetoes",
    "candidate_advisory_vetoes",
    "candidate_confidence_penalty",
)


def apply_candidate_decision(df_rank: pd.DataFrame, config: CandidateConfig | None = None) -> pd.DataFrame:
    """Add `candidate_*` columns.

    In `current` mode -- the default -- this touches no existing column, so the
    live engine's verdict stands exactly as it did. In `candidate` mode it also
    replaces `final_decision` and `decision_reason`, which is why that mode has
    to be earned with evidence before anyone sets it.
    """
    if df_rank.empty:
        return df_rank
    settings = config if config is not None else candidate_config()
    working = df_rank.copy()
    results = [evaluate_candidate_decision(row, settings) for _, row in working.iterrows()]

    working["candidate_decision"] = [item.decision for item in results]
    working["candidate_setup_class"] = [item.setup_class for item in results]
    working["candidate_reason_codes"] = [item.reason_codes for item in results]
    working["candidate_why"] = [item.why for item in results]
    working["candidate_entry_zone"] = [item.entry_zone for item in results]
    working["candidate_stop_loss"] = [item.stop_loss for item in results]
    working["candidate_target_zone"] = [item.target_zone for item in results]
    working["candidate_risk_reward"] = [item.risk_reward for item in results]
    working["candidate_severe_vetoes"] = [item.severe_vetoes for item in results]
    working["candidate_advisory_vetoes"] = [item.advisory_vetoes for item in results]
    working["candidate_confidence_penalty"] = [item.confidence_penalty for item in results]

    if settings.is_candidate:
        working["final_decision"] = [item.decision for item in results]
        working["decision_reason"] = [item.why for item in results]
    return working


def candidate_summary(df_rank: pd.DataFrame) -> dict[str, object]:
    if df_rank.empty or "candidate_decision" not in df_rank.columns:
        return {"rows": 0}
    candidate = df_rank["candidate_decision"].map(lambda value: safe_str(value, "").upper())
    counts: dict[str, int] = {}
    for value in candidate:
        counts[value] = counts.get(value, 0) + 1
    enters = df_rank[candidate == "ENTER"]
    return {
        "rows": int(len(df_rank)),
        "by_decision": dict(sorted(counts.items(), key=lambda item: item[1], reverse=True)),
        "enter": int((candidate == "ENTER").sum()),
        # An ENTER on an already-expanded move would be a chase. It should be
        # impossible by construction; counted so that is verifiable per scan.
        "enter_already_expanded": int(enters.get("pre_expansion_already_expanded", pd.Series(dtype=bool)).astype(bool).sum())
        if len(enters)
        else 0,
    }
