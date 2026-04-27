from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from .safety import atomic_write_dataframe_csv
from .utils import safe_float, safe_str


HORIZONS = {"1D": 1, "2D": 2, "5D": 5, "10D": 10, "20D": 20, "60D": 60}
SNAPSHOT_REQUIRED_COLUMNS = ("symbol", "price", "final_score", "rating")
SNAPSHOT_ACTION_COLUMNS = ("action", "long_action", "mid_action", "short_action", "composite_action", "recommended_action")
SNAPSHOT_ACTION_FALLBACK_COLUMNS = ("long_action", "mid_action", "short_action", "composite_action", "recommended_action")
ENTRY_STATUS_PRIORITY = {
    "GOOD ENTRY": 0,
    "NEAR ENTRY": 1,
    "BUY ZONE": 2,
    "REVIEW": 3,
    "OVEREXTENDED": 4,
    "STOP RISK": 5,
    "STOP HIT": 6,
}
FORWARD_RETURN_COLUMNS = [
    "timestamp_utc",
    "symbol",
    "asset_type",
    "sector",
    "rating",
    "action",
    "setup_type",
    "final_score",
    "score_bucket",
    "entry_status",
    "trade_quality",
    "price_at_signal",
    "future_timestamp",
    "horizon",
    "forward_return",
    "max_drawdown_after_signal",
    "max_gain_after_signal",
    "hit",
]
SUMMARY_COLUMNS = [
    "group_type",
    "group_value",
    "horizon",
    "count",
    "avg_return",
    "median_return",
    "hit_rate",
    "avg_max_drawdown",
    "avg_max_gain",
    "worst_return",
    "best_return",
    "low_sample",
]
SUMMARY_GROUPS = ["rating", "action", "setup_type", "score_bucket", "sector", "asset_type", "entry_status", "trade_quality"]


def _first_non_empty_column_value(row: pd.Series, columns: tuple[str, ...]) -> str:
    for column in columns:
        value = safe_str(row.get(column), "")
        if value:
            return value
    return ""


def _prepare_snapshot_frame(df: pd.DataFrame, stats: dict[str, int]) -> pd.DataFrame | None:
    missing_required = [column for column in SNAPSHOT_REQUIRED_COLUMNS if column not in df.columns]
    if missing_required:
        stats["critical_missing"] += 1
        return None

    has_action_column = "action" in df.columns
    has_action_columns = any(column in df.columns for column in SNAPSHOT_ACTION_COLUMNS)
    if not has_action_columns:
        stats["critical_missing"] += 1
        return None

    working = df.copy()
    if not has_action_column:
        working["action"] = working.apply(lambda row: _first_non_empty_column_value(row, SNAPSHOT_ACTION_FALLBACK_COLUMNS), axis=1)
        stats["legacy_missing_action"] += 1
    return working


def load_snapshot_history(history_dir: str) -> pd.DataFrame:
    history_path = Path(history_dir)
    files = sorted(history_path.glob("scan_*.csv"))
    if not files:
        return pd.DataFrame()

    frames: list[pd.DataFrame] = []
    schema_stats = {"legacy_missing_action": 0, "critical_missing": 0}
    for path in files:
        try:
            df = pd.read_csv(path)
        except Exception:
            continue
        if df.empty:
            continue
        df = _prepare_snapshot_frame(df, schema_stats)
        if df is None:
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

    if schema_stats["legacy_missing_action"]:
        print(f"[data] schema compatibility: {schema_stats['legacy_missing_action']} legacy snapshots missing action, using fallback")
    if schema_stats["critical_missing"]:
        print(f"[data] schema compatibility: {schema_stats['critical_missing']} snapshots skipped due to missing required columns")

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


def _entry_status(row: pd.Series) -> str:
    text = " ".join(
        [
            safe_str(row.get("trade_quality"), ""),
            safe_str(row.get("trade_quality_note"), ""),
            safe_str(row.get("target_warning"), ""),
        ]
    ).upper()
    if "LOW EDGE" in text or "EXTENDED" in text:
        return "OVEREXTENDED"
    if "GOOD" in text:
        return "GOOD ENTRY"
    if "ACCEPTABLE" in text:
        return "WAIT PULLBACK"
    return "REVIEW"


def _action_for_row(row: pd.Series) -> str:
    for column in ("action", "recommended_action", "composite_action", "mid_action", "short_action", "long_action"):
        value = safe_str(row.get(column), "")
        if value:
            return value
    return "N/A"


def _empty_forward_df(analysis_dir: Path, analysis_raw: bool = False) -> pd.DataFrame:
    forward_df = pd.DataFrame(columns=FORWARD_RETURN_COLUMNS)
    forward_df.attrs["analysis_dir"] = str(analysis_dir)
    forward_df.attrs["snapshots_loaded"] = 0
    forward_df.attrs["observations_created"] = 0
    forward_df.attrs["raw_rows"] = 0
    forward_df.attrs["canonical_rows"] = 0
    forward_df.attrs["analysis_raw"] = analysis_raw
    forward_df.attrs["horizons_completed"] = []
    return forward_df


def _canonical_entry_rank(value: object) -> int:
    status = safe_str(value, "REVIEW").upper().strip()
    return ENTRY_STATUS_PRIORITY.get(status, ENTRY_STATUS_PRIORITY["REVIEW"])


def selectCanonicalRow(rows: pd.DataFrame) -> pd.Series:
    """Select one representative signal for a symbol/date/horizon group."""
    ranked = rows.copy()
    ranked["_canonical_score"] = pd.to_numeric(ranked["final_score"], errors="coerce").fillna(-np.inf)
    ranked["_canonical_entry_rank"] = ranked["entry_status"].apply(_canonical_entry_rank)
    ranked["_canonical_timestamp"] = pd.to_datetime(ranked["timestamp_utc"], utc=True, errors="coerce")
    ranked = ranked.sort_values(
        ["_canonical_score", "_canonical_entry_rank", "_canonical_timestamp"],
        ascending=[False, True, True],
        kind="mergesort",
    )
    return ranked.iloc[0].drop(labels=["_canonical_score", "_canonical_entry_rank", "_canonical_timestamp"], errors="ignore")


def _apply_canonical_sampling(forward_df: pd.DataFrame) -> pd.DataFrame:
    if forward_df.empty:
        return forward_df

    working = forward_df.copy()
    working["_trading_date"] = working["timestamp_utc"].astype(str).str[:10]
    working = working[working["_trading_date"].str.match(r"^\d{4}-\d{2}-\d{2}$", na=False)].copy()
    canonical_rows = [
        selectCanonicalRow(group)
        for _, group in working.groupby(["symbol", "_trading_date", "horizon"], sort=False, dropna=False)
    ]
    if not canonical_rows:
        return pd.DataFrame(columns=FORWARD_RETURN_COLUMNS)
    canonical_df = pd.DataFrame(canonical_rows).reindex(columns=FORWARD_RETURN_COLUMNS).reset_index(drop=True)
    return canonical_df.sort_values(["symbol", "timestamp_utc", "horizon"], kind="mergesort").reset_index(drop=True)


def compute_forward_returns(history_dir: str, analysis_raw: bool = False) -> pd.DataFrame:
    history_df = load_snapshot_history(history_dir)
    analysis_dir = Path(history_dir).parent / "analysis"
    analysis_dir.mkdir(parents=True, exist_ok=True)
    forward_path = analysis_dir / "forward_returns.csv"

    if history_df.empty:
        forward_df = _empty_forward_df(analysis_dir, analysis_raw=analysis_raw)
        atomic_write_dataframe_csv(forward_df, forward_path, index=False)
        print("[analysis] Analysis complete, but no completed forward-return windows yet.")
        return forward_df

    snapshot_count = int(history_df["source_file"].nunique()) if "source_file" in history_df.columns else 0
    history_df = history_df.copy()
    history_df["final_score"] = pd.to_numeric(history_df["final_score"], errors="coerce")
    history_df["score_bucket"] = history_df["final_score"].apply(score_bucket_label)
    history_df["action"] = history_df.apply(_action_for_row, axis=1)
    history_df["entry_status"] = history_df.apply(_entry_status, axis=1)
    if "trade_quality" in history_df.columns:
        history_df["trade_quality"] = history_df["trade_quality"].fillna("unknown").astype(str)
    else:
        history_df["trade_quality"] = "unknown"

    rows: list[dict[str, object]] = []
    for symbol, symbol_df in history_df.groupby("symbol"):
        symbol_df = symbol_df.sort_values("timestamp_utc").reset_index(drop=True)
        for index, signal in symbol_df.iterrows():
            signal_time = signal["timestamp_utc"]
            entry_price = safe_float(signal.get("price"), np.nan)
            if pd.isna(signal_time) or np.isnan(entry_price) or entry_price <= 0:
                continue
            future_rows = symbol_df[symbol_df["timestamp_utc"] > signal_time].copy()
            if future_rows.empty:
                continue

            for horizon, days in HORIZONS.items():
                target_time = signal_time + pd.Timedelta(days=days)
                candidates = future_rows[future_rows["timestamp_utc"] >= target_time]
                if candidates.empty:
                    continue
                future = candidates.iloc[0]
                future_time = future["timestamp_utc"]
                future_price = safe_float(future.get("price"), np.nan)
                if pd.isna(future_time) or np.isnan(future_price) or future_price <= 0:
                    continue
                path_df = future_rows[future_rows["timestamp_utc"] <= future_time].copy()
                path_returns = pd.to_numeric(path_df["price"], errors="coerce").dropna().apply(lambda value: (safe_float(value, np.nan) / entry_price) - 1.0)
                path_returns = path_returns.replace([np.inf, -np.inf], np.nan).dropna()
                max_drawdown = min(0.0, float(path_returns.min())) if not path_returns.empty else np.nan
                max_gain = max(0.0, float(path_returns.max())) if not path_returns.empty else np.nan
                forward_return = (future_price / entry_price) - 1.0
                rows.append(
                    {
                        "timestamp_utc": pd.Timestamp(signal_time).isoformat(),
                        "symbol": symbol,
                        "asset_type": safe_str(signal.get("asset_type"), ""),
                        "sector": safe_str(signal.get("sector"), ""),
                        "rating": safe_str(signal.get("rating"), ""),
                        "action": safe_str(signal.get("action"), ""),
                        "setup_type": safe_str(signal.get("setup_type"), ""),
                        "final_score": safe_float(signal.get("final_score"), np.nan),
                        "score_bucket": safe_str(signal.get("score_bucket"), "unknown"),
                        "entry_status": safe_str(signal.get("entry_status"), "REVIEW"),
                        "trade_quality": safe_str(signal.get("trade_quality"), "unknown"),
                        "price_at_signal": round(entry_price, 6),
                        "future_timestamp": pd.Timestamp(future_time).isoformat(),
                        "horizon": horizon,
                        "forward_return": round(forward_return, 6),
                        "max_drawdown_after_signal": round(max_drawdown, 6) if not np.isnan(max_drawdown) else np.nan,
                        "max_gain_after_signal": round(max_gain, 6) if not np.isnan(max_gain) else np.nan,
                        "hit": bool(forward_return > 0),
                    }
                )

    raw_forward_df = pd.DataFrame(rows, columns=FORWARD_RETURN_COLUMNS)
    raw_row_count = len(raw_forward_df)
    if analysis_raw:
        forward_df = raw_forward_df
        print("[analysis] raw analysis mode enabled")
        print(f"[analysis] raw observations: {raw_row_count}")
    else:
        print("[analysis] canonical sampling enabled")
        forward_df = _apply_canonical_sampling(raw_forward_df)
        print(f"[analysis] raw observations: {raw_row_count}")
        print(f"[analysis] canonical observations: {len(forward_df)}")

    forward_df.attrs["analysis_dir"] = str(analysis_dir)
    forward_df.attrs["snapshots_loaded"] = snapshot_count
    forward_df.attrs["observations_created"] = len(forward_df)
    forward_df.attrs["raw_rows"] = raw_row_count
    forward_df.attrs["canonical_rows"] = len(forward_df)
    forward_df.attrs["analysis_raw"] = analysis_raw
    forward_df.attrs["horizons_completed"] = sorted(forward_df["horizon"].dropna().unique().tolist()) if not forward_df.empty else []
    atomic_write_dataframe_csv(forward_df, forward_path, index=False)
    if forward_df.empty:
        print("[analysis] Analysis complete, but no completed forward-return windows yet.")
    return forward_df


def summarize_group_performance(df: pd.DataFrame, group_col: str) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    if df.empty or group_col not in df.columns:
        return pd.DataFrame(columns=SUMMARY_COLUMNS)
    for (horizon, group_value), group_df in df.groupby(["horizon", group_col], dropna=False):
        valid = pd.to_numeric(group_df["forward_return"], errors="coerce").dropna()
        if valid.empty:
            continue
        label = safe_str(group_value, "unknown") or "unknown"
        drawdowns = pd.to_numeric(group_df["max_drawdown_after_signal"], errors="coerce").dropna()
        gains = pd.to_numeric(group_df["max_gain_after_signal"], errors="coerce").dropna()
        count = int(valid.count())
        rows.append(
            {
                "group_type": group_col,
                "group_value": label,
                "horizon": horizon,
                "count": count,
                "avg_return": round(valid.mean(), 6),
                "median_return": round(valid.median(), 6),
                "hit_rate": round((valid > 0).mean(), 6),
                "avg_max_drawdown": round(drawdowns.mean(), 6) if not drawdowns.empty else np.nan,
                "avg_max_gain": round(gains.mean(), 6) if not gains.empty else np.nan,
                "worst_return": round(valid.min(), 6),
                "best_return": round(valid.max(), 6),
                "low_sample": bool(count < 5),
            }
        )
    return pd.DataFrame(rows, columns=SUMMARY_COLUMNS)


def print_performance_section(summary_df: pd.DataFrame, group_type: str, title: str) -> None:
    section = summary_df[summary_df["group_type"] == group_type].copy()
    if section.empty:
        print(f"\n=== {title} ===")
        print("No completed forward-return observations yet.")
        return

    rows: list[dict[str, object]] = []
    for group_value, group_df in section.groupby("group_value"):
        item = {"label": group_value}
        for horizon in ["1D", "2D", "5D", "10D", "20D", "60D"]:
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
        rows.append(dict(item))

    display = pd.DataFrame(rows).sort_values("label").reset_index(drop=True)
    percent_cols = [col for col in display.columns if col.startswith("avg_") or col.startswith("hit_")]
    for col in percent_cols:
        display[col] = display[col].apply(lambda x: f"{x * 100:.2f}%" if pd.notna(x) else "-")

    print(f"\n=== {title} ===")
    print(display.to_string(index=False))


def analyze_performance(forward_returns_df: pd.DataFrame) -> pd.DataFrame:
    analysis_dir = Path(forward_returns_df.attrs.get("analysis_dir", "scanner_output/analysis"))
    analysis_dir.mkdir(parents=True, exist_ok=True)
    summary_frames = [summarize_group_performance(forward_returns_df, group_col) for group_col in SUMMARY_GROUPS]
    summary_df = pd.concat([df for df in summary_frames if not df.empty], ignore_index=True) if any(not df.empty for df in summary_frames) else pd.DataFrame(columns=SUMMARY_COLUMNS)
    summary_path = analysis_dir / "performance_summary.csv"
    atomic_write_dataframe_csv(summary_df, summary_path, index=False)

    print_performance_section(summary_df, "rating", "PERFORMANCE BY RATING")
    print_performance_section(summary_df, "setup_type", "PERFORMANCE BY SETUP")
    print_performance_section(summary_df, "asset_type", "PERFORMANCE BY ASSET TYPE")
    print_performance_section(summary_df, "score_bucket", "PERFORMANCE BY SCORE BUCKET")
    print(f"\n[analysis] snapshots loaded: {forward_returns_df.attrs.get('snapshots_loaded', 0)}")
    print(f"[analysis] observations created: {len(forward_returns_df)}")
    print(f"[analysis] horizons completed: {', '.join(forward_returns_df.attrs.get('horizons_completed', [])) or 'none'}")
    print(f"[analysis] summary rows written: {len(summary_df)}")
    print(f"\nSaved performance summary to: {summary_path}")
    return summary_df
