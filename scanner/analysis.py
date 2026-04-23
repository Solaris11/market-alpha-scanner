from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from .data_fetch import batch_download
from .utils import safe_float, safe_str


def load_snapshot_history(history_dir: str) -> pd.DataFrame:
    history_path = Path(history_dir)
    files = sorted(history_path.glob("scan_*.csv"))
    if not files:
        return pd.DataFrame()

    frames: list[pd.DataFrame] = []
    for path in files:
        try:
            df = pd.read_csv(path)
        except Exception:
            continue
        if df.empty:
            continue
        if "timestamp_utc" not in df.columns:
            inferred = path.stem.replace("scan_", "")
            try:
                ts = datetime.strptime(inferred, "%Y%m%d_%H%M%S").replace(tzinfo=timezone.utc)
                df.insert(0, "timestamp_utc", ts.isoformat())
            except Exception:
                continue
        df["source_file"] = path.name
        frames.append(df)

    if not frames:
        return pd.DataFrame()

    history_df = pd.concat(frames, ignore_index=True)
    history_df["timestamp_utc"] = pd.to_datetime(history_df["timestamp_utc"], utc=True, errors="coerce")
    history_df = history_df.dropna(subset=["timestamp_utc", "symbol", "price"]).copy()
    history_df["symbol"] = history_df["symbol"].astype(str).str.upper()
    history_df["price"] = pd.to_numeric(history_df["price"], errors="coerce")
    history_df = history_df.dropna(subset=["price"])
    return history_df.sort_values(["timestamp_utc", "symbol"]).reset_index(drop=True)


def score_bucket_label(score: float) -> str:
    if pd.isna(score):
        return "unknown"
    if score >= 80:
        return "80+"
    if score >= 70:
        return "70-79"
    if score >= 60:
        return "60-69"
    if score >= 50:
        return "50-59"
    return "<50"


def compute_forward_returns(history_dir: str) -> pd.DataFrame:
    history_df = load_snapshot_history(history_dir)
    analysis_dir = Path(history_dir).parent / "analysis"
    analysis_dir.mkdir(parents=True, exist_ok=True)
    forward_path = analysis_dir / "forward_returns.csv"

    output_columns = ["timestamp_utc", "symbol", "asset_type", "sector", "rating", "setup_type", "final_score", "score_bucket", "forward_5d", "forward_10d", "forward_20d", "forward_60d"]
    if history_df.empty:
        pd.DataFrame(columns=output_columns).to_csv(forward_path, index=False)
        return pd.DataFrame(columns=output_columns)

    history_df["score_bucket"] = history_df["final_score"].apply(score_bucket_label)
    symbols = sorted(history_df["symbol"].dropna().unique().tolist())
    min_date = history_df["timestamp_utc"].min().date() - timedelta(days=7)
    max_date = history_df["timestamp_utc"].max().date() + timedelta(days=120)

    print(f"[analysis 1/2] Downloading forward price history for {len(symbols)} symbols...")
    price_map = batch_download(symbols, start=min_date.isoformat(), end=max_date.isoformat())
    horizons = {"forward_5d": 5, "forward_10d": 10, "forward_20d": 20, "forward_60d": 60}

    rows: list[dict[str, object]] = []
    for row in history_df.itertuples(index=False):
        price_df = price_map.get(row.symbol)
        if price_df is None or price_df.empty:
            continue
        close = price_df["Close"].dropna()
        if close.empty:
            continue

        trade_dates = pd.to_datetime(close.index, utc=True).tz_localize(None).normalize()
        snapshot_date = pd.Timestamp(row.timestamp_utc).tz_convert("UTC").tz_localize(None).normalize()
        entry_pos = trade_dates.searchsorted(snapshot_date)
        if entry_pos >= len(close):
            continue

        entry_price = safe_float(row.price)
        if np.isnan(entry_price) or entry_price <= 0:
            continue

        result = {
            "timestamp_utc": pd.Timestamp(row.timestamp_utc).isoformat(),
            "symbol": row.symbol,
            "asset_type": getattr(row, "asset_type", ""),
            "sector": getattr(row, "sector", ""),
            "rating": getattr(row, "rating", ""),
            "setup_type": getattr(row, "setup_type", ""),
            "final_score": safe_float(getattr(row, "final_score", np.nan)),
            "score_bucket": getattr(row, "score_bucket", "unknown"),
        }

        for col_name, horizon in horizons.items():
            future_pos = entry_pos + horizon
            if future_pos >= len(close):
                result[col_name] = np.nan
                continue
            future_price = safe_float(close.iloc[future_pos])
            result[col_name] = round((future_price / entry_price) - 1.0, 6) if future_price > 0 else np.nan

        if any(pd.notna(result[col]) for col in horizons):
            rows.append(result)

    forward_df = pd.DataFrame(rows, columns=output_columns)
    forward_df.attrs["analysis_dir"] = str(analysis_dir)
    forward_df.to_csv(forward_path, index=False)
    return forward_df


def summarize_group_performance(df: pd.DataFrame, group_col: str, horizons: list[str]) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    if df.empty or group_col not in df.columns:
        return pd.DataFrame()
    for group_value, group_df in df.groupby(group_col, dropna=False):
        label = safe_str(group_value, "unknown") or "unknown"
        for horizon in horizons:
            valid = group_df[horizon].dropna()
            if valid.empty:
                continue
            negatives = valid[valid < 0]
            rows.append(
                {
                    "group_type": group_col,
                    "group_value": label,
                    "horizon": horizon.replace("forward_", ""),
                    "count": int(valid.count()),
                    "avg_return": round(valid.mean(), 6),
                    "median_return": round(valid.median(), 6),
                    "hit_rate": round((valid > 0).mean(), 6),
                    "avg_negative_return": round(negatives.mean(), 6) if not negatives.empty else np.nan,
                    "min_return": round(valid.min(), 6),
                }
            )
    return pd.DataFrame(rows)


def print_performance_section(summary_df: pd.DataFrame, group_type: str, title: str):
    section = summary_df[summary_df["group_type"] == group_type].copy()
    if section.empty:
        print(f"\n=== {title} ===")
        print("No completed forward-return observations yet.")
        return

    rows: list[dict[str, object]] = []
    for group_value, group_df in section.groupby("group_value"):
        item = {"label": group_value}
        for horizon in ["5d", "10d", "20d", "60d"]:
            horizon_df = group_df[group_df["horizon"] == horizon]
            if horizon_df.empty:
                item[f"avg_{horizon}"] = np.nan
                item[f"hit_{horizon}"] = np.nan
                item[f"n_{horizon}"] = 0
                continue
            row = horizon_df.iloc[0]
            item[f"avg_{horizon}"] = row["avg_return"]
            item[f"hit_{horizon}"] = row["hit_rate"]
            item[f"n_{horizon}"] = int(row["count"])
        rows.append(item)

    display = pd.DataFrame(rows).sort_values("label").reset_index(drop=True)
    percent_cols = [col for col in display.columns if col.startswith("avg_") or col.startswith("hit_")]
    for col in percent_cols:
        display[col] = display[col].apply(lambda x: f"{x * 100:.2f}%" if pd.notna(x) else "-")

    print(f"\n=== {title} ===")
    print(display.to_string(index=False))


def analyze_performance(forward_returns_df: pd.DataFrame) -> pd.DataFrame:
    analysis_dir = Path(forward_returns_df.attrs.get("analysis_dir", "scanner_output/analysis"))
    analysis_dir.mkdir(parents=True, exist_ok=True)
    horizons = ["forward_5d", "forward_10d", "forward_20d", "forward_60d"]
    summary_frames = [
        summarize_group_performance(forward_returns_df, "rating", horizons),
        summarize_group_performance(forward_returns_df, "setup_type", horizons),
        summarize_group_performance(forward_returns_df, "asset_type", horizons),
        summarize_group_performance(forward_returns_df, "score_bucket", horizons),
    ]
    summary_df = pd.concat([df for df in summary_frames if not df.empty], ignore_index=True) if any(not df.empty for df in summary_frames) else pd.DataFrame(
        columns=["group_type", "group_value", "horizon", "count", "avg_return", "median_return", "hit_rate", "avg_negative_return", "min_return"]
    )
    summary_path = analysis_dir / "performance_summary.csv"
    summary_df.to_csv(summary_path, index=False)

    print_performance_section(summary_df, "rating", "PERFORMANCE BY RATING")
    print_performance_section(summary_df, "setup_type", "PERFORMANCE BY SETUP")
    print_performance_section(summary_df, "asset_type", "PERFORMANCE BY ASSET TYPE")
    print_performance_section(summary_df, "score_bucket", "PERFORMANCE BY SCORE BUCKET")
    print(f"\nSaved performance summary to: {summary_path}")
    return summary_df

