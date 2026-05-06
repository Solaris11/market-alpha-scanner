from __future__ import annotations

import re
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
    display_columns = [
        "symbol",
        "asset_type",
        "sector",
        "price",
        "final_score",
        "final_decision",
        "setup_type",
        "confidence_score",
        "data_quality_score",
        "decision_reason",
    ]
    display = top[[column for column in display_columns if column in top.columns]].copy()
    display = display.rename(
        columns={
            "final_score": "score",
            "final_decision": "decision",
            "confidence_score": "confidence",
            "data_quality_score": "data_quality",
            "decision_reason": "reason",
        },
    )
    if "reason" in display.columns:
        display["reason"] = display["reason"].map(readable_operator_text)

    print("\nTOP CANDIDATES (final_decision source of truth)")
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


def readable_operator_text(value: object) -> str:
    text = str(value or "").strip()
    if not text or text.lower() in {"nan", "none", "null", "n/a"}:
        return ""
    return re.sub(r"\b[A-Z0-9]+(?:_[A-Z0-9]+)+\b", lambda match: humanize_code(match.group(0)), text)


def humanize_code(value: str) -> str:
    return " ".join(part.capitalize() for part in value.split("_") if part)
