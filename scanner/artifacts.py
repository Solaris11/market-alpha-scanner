from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from typing import Any

from .models import RankedAsset
from .scoring import extract_detail_fundamentals


def symbol_slug(symbol: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_", "."} else "_" for char in symbol)


def to_jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: to_jsonable(val) for key, val in value.items()}
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [to_jsonable(item) for item in value]
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return None if pd.isna(value) else float(value)
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    return value


def save_symbol_detail_outputs(
    ranked_assets: list[RankedAsset],
    price_map: dict[str, pd.DataFrame],
    info_cache: dict[str, dict],
    outdir: Path,
) -> None:
    # This stays small on purpose because the dashboard only needs a narrow view of the artifact.
    symbols_dir = outdir / "symbols"
    symbols_dir.mkdir(parents=True, exist_ok=True)
    updated_at = datetime.now(timezone.utc).isoformat()

    for asset in ranked_assets:
        symbol_dir = symbols_dir / symbol_slug(asset.symbol)
        symbol_dir.mkdir(parents=True, exist_ok=True)

        price_df = price_map.get(asset.symbol)
        if price_df is not None and not price_df.empty:
            history_df = price_df.reset_index().rename(columns={"Date": "date"})
            history_df.to_csv(symbol_dir / "history.csv", index=False)

        payload = {
            "symbol": asset.symbol,
            "updated_at_utc": updated_at,
            "summary": asdict(asset),
            "fundamentals": extract_detail_fundamentals(info_cache.get(asset.symbol, {})),
        }
        (symbol_dir / "summary.json").write_text(json.dumps(to_jsonable(payload), indent=2), encoding="utf-8")
