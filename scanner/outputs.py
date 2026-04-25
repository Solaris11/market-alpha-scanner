from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pandas as pd

from .safety import atomic_write_dataframe_csv


def print_top_table(df_rank: pd.DataFrame, top_n: int) -> None:
    if df_rank.empty:
        print("No ranked symbols found.")
        return

    top = df_rank.head(top_n).copy()
    display = top[
        [
            "symbol",
            "asset_type",
            "sector",
            "price",
            "technical_score",
            "fundamental_score",
            "news_score",
            "macro_score",
            "risk_penalty",
            "final_score",
            "short_action",
            "mid_action",
            "long_action",
            "setup_type",
            "rating",
        ]
    ].copy()

    print("\nTOP CANDIDATES")
    print(display.to_string(index=False))


def save_snapshot(df_rank: pd.DataFrame, outdir: Path, snapshot_time: Optional[datetime] = None) -> Path:
    history_dir = outdir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)

    snapshot_time = snapshot_time or datetime.now(timezone.utc)
    timestamp_str = snapshot_time.strftime("%Y%m%d_%H%M%S")
    snapshot_path = history_dir / f"scan_{timestamp_str}.csv"

    snapshot_df = df_rank.copy()
    snapshot_df.insert(0, "timestamp_utc", snapshot_time.isoformat())
    atomic_write_dataframe_csv(snapshot_df, snapshot_path, index=False)
    return snapshot_path
