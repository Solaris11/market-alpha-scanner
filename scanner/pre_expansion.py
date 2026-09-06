"""Forward-looking setup detection: is this symbol *about to* expand?

Every expansion feature in `scoring.py` is backward-looking. `score_breakout_quality`
rewards a close at a three-month high, a close above the prior twenty-day high,
and a volume spike that has already printed. All of that describes a move that
has happened. Worse, it is self-cancelling: the same move pushes RSI past 74 and
sets `entry_status = OVEREXTENDED`, which routes to `BREAKOUT_REJECTED_EXTENDED`
and then AVOID. The scanner can only see expansion after the fact, and then
rejects it for being after the fact.

This module measures the opposite condition -- the quiet before a move --
from the same OHLCV history, using only bars up to and including the last one.

Six components, each 0-100:

    compression          Bollinger width now against its own trailing history
    range_contraction    short ATR against long ATR
    volatility_contraction  short realised vol against long realised vol
    volume_accumulation  up-day volume against down-day volume
    range_position       where price sits in its own base
    entry_proximity      how close price is to the pivot it would break

And one gate that overrides all of them: `already_expanded`. A base that has
already broken is not a pre-expansion setup, however textbook the compression
looked last week. When the gate trips the score is capped hard, because the
entire purpose of this module is to stop scoring moves after they happen.

Two deliberate refusals:

  * With too little history the score is `None` and `available` is False. It is
    never 0. A zero is indistinguishable from "measured, and bad", and this
    codebase has already shipped one bug of exactly that shape.
  * Relative strength needs a benchmark. If none is supplied the component is
    reported unavailable and the remaining weights are renormalised, rather
    than substituting a self-referential proxy and calling it relative
    strength.

Nothing here influences a decision. It writes `pre_expansion_*` columns.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Final

import numpy as np
import pandas as pd

#: Below this many bars nothing is reported at all.
MIN_BARS: Final[int] = 40
#: Below this many bars percentile ranks are not trustworthy; the score is
#: still produced but flagged as reduced confidence.
FULL_CONFIDENCE_BARS: Final[int] = 120

#: A close more than this far above the pivot means the move already went.
ALREADY_EXPANDED_EXTENSION: Final[float] = 0.03
#: Score ceiling once `already_expanded` trips.
EXPANDED_SCORE_CAP: Final[float] = 20.0

COMPONENT_WEIGHTS: Final[dict[str, float]] = {
    "compression": 0.26,
    "range_contraction": 0.18,
    "volatility_contraction": 0.16,
    "volume_accumulation": 0.16,
    "range_position": 0.12,
    "entry_proximity": 0.12,
    "relative_strength": 0.00,  # weight applied only when a benchmark is given
}
RELATIVE_STRENGTH_WEIGHT: Final[float] = 0.18


@dataclass(frozen=True)
class PreExpansionScore:
    available: bool
    score: float | None
    components: dict[str, float] = field(default_factory=dict)
    reason_codes: list[str] = field(default_factory=list)
    already_expanded: bool = False
    bars_used: int = 0
    reduced_confidence: bool = False
    detail: str = ""


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    if not np.isfinite(value):
        return low
    return float(min(high, max(low, value)))


def _true_range(bars: pd.DataFrame) -> pd.Series:
    previous_close = bars["close"].shift(1)
    spans = pd.concat(
        [
            bars["high"] - bars["low"],
            (bars["high"] - previous_close).abs(),
            (bars["low"] - previous_close).abs(),
        ],
        axis=1,
    )
    return spans.max(axis=1)


def _percentile_rank(series: pd.Series, value: float) -> float:
    """Midrank of `value` within the trailing window, in [0, 1].

    Ties are counted at half weight rather than in full. With `<=` a series of
    identical values ranks every member at 1.0, so a symbol whose volatility
    never changes reads as maximally *un*compressed -- the opposite of the
    truth. Midranking returns 0.5 there, which is the honest answer: a flat
    history carries no information about whether this bar is unusually quiet.
    """
    clean = series.dropna()
    if clean.empty or not np.isfinite(value):
        return float("nan")
    below = float((clean < value).sum())
    ties = float((clean == value).sum())
    return (below + 0.5 * ties) / float(len(clean))


def compute_pre_expansion(
    bars: pd.DataFrame,
    benchmark_closes: pd.Series | None = None,
) -> PreExpansionScore:
    """Score how much this looks like a base about to resolve, not one that has.

    `bars` needs open/high/low/close/volume in ascending date order. Only bars
    up to and including the last row are read, so the score is computable at
    the close of any historical bar without look-ahead.
    """
    required = {"high", "low", "close", "volume"}
    if bars is None or not required.issubset(set(bars.columns)):
        return PreExpansionScore(available=False, score=None, detail="missing OHLCV columns")

    frame = bars.dropna(subset=["high", "low", "close"]).copy()
    bar_count = len(frame)
    if bar_count < MIN_BARS:
        return PreExpansionScore(
            available=False,
            score=None,
            bars_used=bar_count,
            detail=f"only {bar_count} usable bars, need {MIN_BARS}",
        )

    reduced = bar_count < FULL_CONFIDENCE_BARS
    close = frame["close"].astype(float)
    high = frame["high"].astype(float)
    low = frame["low"].astype(float)
    volume = frame["volume"].astype(float) if "volume" in frame else pd.Series(np.nan, index=frame.index)

    components: dict[str, float] = {}
    reasons: list[str] = []

    # --- compression: Bollinger width against its own history -------------
    rolling_mean = close.rolling(20).mean()
    rolling_std = close.rolling(20).std()
    width = ((rolling_mean + 2 * rolling_std) - (rolling_mean - 2 * rolling_std)) / rolling_mean.replace(0, np.nan)
    current_width = float(width.iloc[-1]) if np.isfinite(width.iloc[-1]) else float("nan")
    width_rank = _percentile_rank(width.iloc[-min(bar_count, FULL_CONFIDENCE_BARS):], current_width)
    if np.isfinite(width_rank):
        components["compression"] = _clamp((1.0 - width_rank) * 100.0)
        if width_rank <= 0.20:
            reasons.append("BANDS_COMPRESSED")
    # --- range contraction: short ATR against long ATR --------------------
    true_range = _true_range(frame)
    atr_short = float(true_range.rolling(5).mean().iloc[-1])
    atr_long = float(true_range.rolling(20).mean().iloc[-1])
    if np.isfinite(atr_short) and np.isfinite(atr_long) and atr_long > 0:
        ratio = atr_short / atr_long
        # 1.0 means no contraction, 0.5 is a strong one.
        components["range_contraction"] = _clamp((1.0 - ratio) * 200.0)
        if ratio <= 0.75:
            reasons.append("RANGE_CONTRACTING")

    # --- volatility contraction: short realised vol against long ----------
    returns = close.pct_change()
    vol_short = float(returns.rolling(10).std().iloc[-1])
    vol_long = float(returns.rolling(60).std().iloc[-1]) if bar_count >= 60 else float(returns.std())
    if np.isfinite(vol_short) and np.isfinite(vol_long) and vol_long > 0:
        ratio = vol_short / vol_long
        components["volatility_contraction"] = _clamp((1.0 - ratio) * 200.0)
        if ratio <= 0.7:
            reasons.append("VOLATILITY_CONTRACTING")

    # --- volume accumulation: up-day volume against down-day volume -------
    window = min(20, bar_count - 1)
    recent_returns = returns.iloc[-window:]
    recent_volume = volume.iloc[-window:]
    up_volume = float(recent_volume[recent_returns > 0].sum())
    down_volume = float(recent_volume[recent_returns < 0].sum())
    if np.isfinite(up_volume) and np.isfinite(down_volume) and down_volume > 0:
        ratio = up_volume / down_volume
        # 1.0 is balanced; 2.0 is heavy accumulation.
        components["volume_accumulation"] = _clamp((ratio - 0.6) * 71.0)
        if ratio >= 1.3:
            reasons.append("VOLUME_ACCUMULATION")

    # --- range position: holding the top of the base while it tightens ----
    base_window = min(20, bar_count)
    base_high = float(high.iloc[-base_window:].max())
    base_low = float(low.iloc[-base_window:].min())
    last_close = float(close.iloc[-1])
    if np.isfinite(base_high) and np.isfinite(base_low) and base_high > base_low:
        position = (last_close - base_low) / (base_high - base_low)
        components["range_position"] = _clamp(position * 100.0)
        if position >= 0.7:
            reasons.append("HOLDING_UPPER_RANGE")

    # --- entry proximity and the already-expanded gate --------------------
    # The pivot is the base's ceiling, measured excluding the most recent bars
    # so that a breakout bar cannot raise its own pivot.
    pivot_window = frame.iloc[-min(60, bar_count):-5] if bar_count > 25 else frame.iloc[:-1]
    pivot = float(pivot_window["high"].max()) if len(pivot_window) else float("nan")
    already_expanded = False
    extension = float("nan")
    if np.isfinite(pivot) and pivot > 0:
        extension = (last_close - pivot) / pivot
        if extension > ALREADY_EXPANDED_EXTENSION:
            already_expanded = True
            reasons.append("ALREADY_EXPANDED")
        # Best when price sits just under the pivot; falls away on both sides.
        distance = abs(extension)
        components["entry_proximity"] = _clamp(100.0 - (distance / 0.06) * 100.0)

    # --- relative strength, only with a benchmark -------------------------
    if benchmark_closes is not None and len(benchmark_closes.dropna()) >= 20:
        benchmark = benchmark_closes.astype(float).dropna()
        span = min(20, len(benchmark) - 1, bar_count - 1)
        if span > 0:
            symbol_change = last_close / float(close.iloc[-span - 1]) - 1.0
            benchmark_change = float(benchmark.iloc[-1]) / float(benchmark.iloc[-span - 1]) - 1.0
            edge = symbol_change - benchmark_change
            components["relative_strength"] = _clamp(50.0 + edge * 500.0)
            if edge > 0.02:
                reasons.append("OUTPERFORMING_BENCHMARK")

    if not components:
        return PreExpansionScore(
            available=False,
            score=None,
            bars_used=bar_count,
            detail="no component could be computed from this history",
        )

    weights = dict(COMPONENT_WEIGHTS)
    if "relative_strength" in components:
        weights["relative_strength"] = RELATIVE_STRENGTH_WEIGHT
    active = {name: weights.get(name, 0.0) for name in components if weights.get(name, 0.0) > 0}
    total_weight = sum(active.values())
    if total_weight <= 0:
        return PreExpansionScore(
            available=False,
            score=None,
            bars_used=bar_count,
            detail="no weighted component available",
        )
    score = sum(components[name] * weight for name, weight in active.items()) / total_weight

    if already_expanded:
        # The whole point of this module. A base that has already broken is not
        # a pre-expansion setup, however good the compression looked before it.
        score = min(score, EXPANDED_SCORE_CAP)

    detail = "already expanded; scored as a chase, not a setup" if already_expanded else "pre-expansion setup measured"
    if reduced:
        reasons.append("REDUCED_HISTORY")
        detail += f" (only {bar_count} bars, percentiles are provisional)"

    return PreExpansionScore(
        available=True,
        score=round(float(score), 2),
        components={name: round(value, 2) for name, value in components.items()},
        reason_codes=sorted(set(reasons)),
        already_expanded=already_expanded,
        bars_used=bar_count,
        reduced_confidence=reduced,
        detail=detail,
    )


PRE_EXPANSION_COLUMNS: Final[tuple[str, ...]] = (
    "pre_expansion_score",
    "pre_expansion_available",
    "pre_expansion_components",
    "pre_expansion_reason_codes",
    "pre_expansion_already_expanded",
    "pre_expansion_bars",
    "pre_expansion_reduced_confidence",
    "pre_expansion_detail",
)


def apply_pre_expansion(
    df_rank: pd.DataFrame,
    price_map: dict[str, pd.DataFrame] | None,
    benchmark_closes: pd.Series | None = None,
) -> pd.DataFrame:
    """Add the `pre_expansion_*` columns. Touches no existing column."""
    if df_rank.empty:
        return df_rank
    frames = price_map or {}
    working = df_rank.copy()
    results: list[PreExpansionScore] = []
    for _, row in working.iterrows():
        symbol = str(row.get("symbol", "")).upper()
        bars = frames.get(symbol)
        if bars is None or len(bars) == 0:
            results.append(
                PreExpansionScore(available=False, score=None, detail="no price history for this symbol")
            )
            continue
        renamed = bars.rename(columns={name: name.lower() for name in bars.columns})
        results.append(compute_pre_expansion(renamed, benchmark_closes))

    working["pre_expansion_score"] = [item.score for item in results]
    working["pre_expansion_available"] = [item.available for item in results]
    working["pre_expansion_components"] = [item.components for item in results]
    working["pre_expansion_reason_codes"] = [item.reason_codes for item in results]
    working["pre_expansion_already_expanded"] = [item.already_expanded for item in results]
    working["pre_expansion_bars"] = [item.bars_used for item in results]
    working["pre_expansion_reduced_confidence"] = [item.reduced_confidence for item in results]
    working["pre_expansion_detail"] = [item.detail for item in results]
    return working
