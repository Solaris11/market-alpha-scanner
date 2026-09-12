"""P2.1 item 4 (and item 3) — decision-evidence levels are persisted.

The scanner computes AVWAP anchors and the SuperTrend line and, historically,
used them only to derive the setup/entry/invalidation and then dropped them.
These tests pin that the levels are (a) produced by technical_scorecard and
(b) carried on RankedAsset through asdict -> the scanner_signals.payload JSONB,
which is what the frontend spreads onto the ranking row. No network, no DB.
"""
from __future__ import annotations

import math
from dataclasses import asdict, fields

import numpy as np
import pandas as pd

from scanner.models import RankedAsset
from scanner.scoring import technical_scorecard


def _uptrend_df(n: int = 320) -> pd.DataFrame:
    idx = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=n)
    base = np.linspace(100.0, 180.0, n)
    close = base + np.sin(np.linspace(0, 12, n)) * 1.5
    high = close + 1.0
    low = close - 1.0
    openp = close - 0.2
    vol = np.linspace(1_000_000, 1_500_000, n)
    return pd.DataFrame(
        {"Open": openp, "High": high, "Low": low, "Close": close, "Volume": vol},
        index=idx,
    )


def test_technical_scorecard_exposes_evidence_levels() -> None:
    td = technical_scorecard(_uptrend_df())
    for key in ("avwap_ytd", "avwap_swing", "supertrend_line"):
        assert key in td, f"technical_scorecard dropped {key}"
        assert isinstance(td[key], float)
        # A clean multi-year uptrend has finite anchors and a trailing stop.
        assert not math.isnan(td[key]), f"{key} should be finite on an uptrend"


def test_ranked_asset_field_defaults_are_additive() -> None:
    names = {f.name for f in fields(RankedAsset)}
    for key in ("avwap_ytd", "avwap_swing", "supertrend_line"):
        assert key in names, f"RankedAsset missing {key}"
    # Append-only + defaulted: constructing without them must still work.
    a = RankedAsset(**{f.name: (0.0 if f.type == "float" else "") for f in fields(RankedAsset)
                       if f.default is f.default_factory})  # only required fields
    assert math.isnan(a.avwap_ytd) and math.isnan(a.supertrend_line)


def test_evidence_levels_round_trip_through_payload() -> None:
    td = technical_scorecard(_uptrend_df())
    required = {}
    for f in fields(RankedAsset):
        if f.name in ("avwap_ytd", "avwap_swing", "supertrend_line"):
            continue
        # crude but sufficient: floats -> 0.0, strings -> "" for required fields
        required[f.name] = 0.0 if f.type == "float" else ""
    asset = RankedAsset(
        avwap_ytd=td["avwap_ytd"],
        avwap_swing=td["avwap_swing"],
        supertrend_line=td["supertrend_line"],
        **required,
    )
    payload = asdict(asset)  # this dict is what repositories.py stores as JSONB
    assert payload["avwap_ytd"] == td["avwap_ytd"]
    assert payload["avwap_swing"] == td["avwap_swing"]
    assert payload["supertrend_line"] == td["supertrend_line"]


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print("ok -", fn.__name__)
    print(f"{len(fns)} passed")
