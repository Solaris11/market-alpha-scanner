"""P1-1 observation fields: volume features on the last completed bar.

Intraday, the last daily bar is still forming, so relative volume and the
breakout score's volume bonus are computed against a partial session. These
tests pin the observation-only variants: they detect the partial bar, score
the completed history instead, and ride RankedAsset additively. No decision
reads them.
"""
from __future__ import annotations

import math
from dataclasses import asdict, fields
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from scanner.models import RankedAsset
from scanner.scoring import completed_bar_scores, last_bar_is_partial, score_relative_volume


def _frame(n: int = 120, last_volume_scale: float = 1.0, end: pd.Timestamp | None = None) -> pd.DataFrame:
    end = end if end is not None else pd.Timestamp("2026-09-14")
    idx = pd.bdate_range(end=end, periods=n)
    close = np.linspace(100.0, 130.0, n)
    vol = np.full(n, 1_000_000.0)
    vol[-1] = 1_000_000.0 * last_volume_scale
    return pd.DataFrame({"Open": close, "High": close + 1, "Low": close - 1, "Close": close, "Volume": vol}, index=idx)


def test_partial_bar_detected_only_for_today_before_the_close() -> None:
    df = _frame()  # last bar dated Monday 2026-09-14
    assert last_bar_is_partial(df, now=datetime(2026, 9, 14, 15, 0, tzinfo=timezone.utc))  # during the session
    assert not last_bar_is_partial(df, now=datetime(2026, 9, 14, 22, 0, tzinfo=timezone.utc))  # after the close
    assert not last_bar_is_partial(df, now=datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc))  # next morning
    assert not last_bar_is_partial(pd.DataFrame())


def test_completed_bar_scores_ignore_the_partial_session_volume() -> None:
    # A partial bar with 20% of a normal day's volume tanks the live score;
    # the completed-bar score looks at the previous full bars instead.
    df = _frame(last_volume_scale=0.2)
    during = completed_bar_scores(df, now=datetime(2026, 9, 14, 15, 0, tzinfo=timezone.utc))
    assert during["last_bar_partial"] is True
    live = score_relative_volume(df)
    assert live < 40.0
    assert during["relative_volume_score_completed"] > live
    assert during["relative_volume_score_completed"] == round(score_relative_volume(df.iloc[:-1]), 2)
    # After the close the same frame is final and both scores agree.
    after = completed_bar_scores(df, now=datetime(2026, 9, 14, 22, 0, tzinfo=timezone.utc))
    assert after["last_bar_partial"] is False
    assert after["relative_volume_score_completed"] == round(live, 2)


def test_ranked_asset_fields_are_additive_and_round_trip() -> None:
    names = {f.name for f in fields(RankedAsset)}
    for key in ("last_bar_partial", "relative_volume_score_completed", "breakout_score_completed"):
        assert key in names
    required = {f.name: (0.0 if f.type == "float" else "") for f in fields(RankedAsset) if f.default is f.default_factory}
    asset = RankedAsset(**required)
    assert asset.last_bar_partial is False
    assert math.isnan(asset.relative_volume_score_completed)
    asset = RankedAsset(**required, last_bar_partial=True, relative_volume_score_completed=61.5, breakout_score_completed=12.0)
    payload = asdict(asset)
    assert payload["last_bar_partial"] is True and payload["relative_volume_score_completed"] == 61.5
