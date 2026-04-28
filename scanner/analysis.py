from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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
CALIBRATION_COLUMNS = [
    "group_type",
    "group_value",
    "horizon",
    "count",
    "avg_return",
    "hit_rate",
    "avg_drawdown",
    "avg_gain",
    "edge_score",
    "low_sample",
]
SIGNAL_LIFECYCLE_COLUMNS = [
    "signal_id",
    "symbol",
    "company_name",
    "signal_date",
    "signal_price",
    "rating",
    "action",
    "setup_type",
    "entry_status",
    "final_score",
    "final_score_adjusted",
    "market_regime",
    "buy_zone",
    "stop_loss",
    "conservative_target",
    "status",
    "entry_date",
    "entry_price",
    "exit_date",
    "exit_price",
    "exit_reason",
    "days_to_entry",
    "days_to_exit",
    "return_pct",
    "max_drawdown",
    "max_gain",
]
SIGNAL_LIFECYCLE_SUMMARY_COLUMNS = [
    "group_type",
    "group_value",
    "count",
    "entry_reached_rate",
    "target_hit_rate",
    "stop_hit_rate",
    "expired_rate",
    "open_rate",
    "avg_return_pct",
    "avg_days_to_entry",
    "avg_days_to_exit",
    "avg_max_drawdown",
    "avg_max_gain",
]
SIGNAL_LIFECYCLE_GROUPS = ["rating", "action", "setup_type", "entry_status", "market_regime", "score_bucket"]
TRACKED_ENTRY_STATUSES = {"GOOD ENTRY", "NEAR ENTRY", "BUY ZONE"}
TRACKING_DAYS = 20


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


def _extract_numbers(value: object) -> list[float]:
    if value is None:
        return []
    normalized = str(value).replace(",", "").replace("–", "-").replace("—", "-")
    return [float(match) for match in re.findall(r"(?<!\d)-?\d+(?:\.\d+)?", normalized)]


def _range_from_fields(row: pd.Series, low_column: str, high_column: str, text_columns: tuple[str, ...]) -> tuple[float | None, float | None]:
    low = safe_float(row.get(low_column), np.nan)
    high = safe_float(row.get(high_column), np.nan)
    if not np.isnan(low) and not np.isnan(high):
        return (min(float(low), float(high)), max(float(low), float(high)))
    for column in text_columns:
        numbers = _extract_numbers(row.get(column))
        if len(numbers) >= 2:
            return (min(numbers[0], numbers[1]), max(numbers[0], numbers[1]))
        if len(numbers) == 1:
            return (numbers[0], numbers[0])
    if not np.isnan(low) or not np.isnan(high):
        value = float(low if not np.isnan(low) else high)
        return (value, value)
    return (None, None)


def _buy_zone(row: pd.Series) -> tuple[float | None, float | None]:
    return _range_from_fields(row, "buy_zone_low", "buy_zone_high", ("buy_zone", "entry_zone"))


def _stop_loss(row: pd.Series) -> float | None:
    stop = safe_float(row.get("stop_loss"), np.nan)
    if np.isnan(stop):
        stop = safe_float(row.get("invalidation_level"), np.nan)
    return None if np.isnan(stop) else float(stop)


def _conservative_target(row: pd.Series) -> float | None:
    for column in ("conservative_target", "take_profit_low", "take_profit_zone", "take_profit", "target", "upside_target"):
        direct = safe_float(row.get(column), np.nan)
        if not np.isnan(direct):
            return float(direct)
        numbers = _extract_numbers(row.get(column))
        if numbers:
            return min(numbers)
    low, high = _range_from_fields(row, "take_profit_low", "take_profit_high", ("take_profit_zone", "take_profit", "target", "upside_target"))
    if low is not None:
        return low
    return high


def _format_level(value: float | None) -> str:
    if value is None or np.isnan(value):
        return ""
    if abs(value - round(value)) < 0.005:
        return str(int(round(value)))
    return f"{value:.2f}"


def _format_range(low: float | None, high: float | None, collapse_equal: bool = False) -> str:
    if low is None and high is None:
        return ""
    values = sorted(value for value in (low, high) if value is not None)
    if len(values) == 1 or (collapse_equal and len(values) == 2 and abs(values[0] - values[1]) < 0.005):
        return _format_level(values[0])
    return f"{_format_level(values[0])}-{_format_level(values[-1])}"


def _price_in_buy_zone(price: float | None, low: float | None, high: float | None) -> bool:
    if price is None or low is None or high is None:
        return False
    return low <= price <= high


def _price_near_buy_zone(price: float | None, low: float | None, high: float | None) -> bool:
    if price is None or low is None or high is None:
        return False
    return high < price <= high * 1.02


def _lifecycle_entry_status(row: pd.Series) -> str:
    price = safe_float(row.get("price"), np.nan)
    price_value = None if np.isnan(price) else float(price)
    low, high = _buy_zone(row)
    if _price_in_buy_zone(price_value, low, high):
        return "BUY ZONE"
    if _price_near_buy_zone(price_value, low, high):
        return "NEAR ENTRY"
    return _entry_status(row)


def _company_name(row: pd.Series) -> str:
    symbol = safe_str(row.get("symbol"), "").upper()
    for column in ("company_name", "long_name", "short_name", "display_name", "security_name", "name"):
        value = safe_str(row.get(column), "")
        if value and value.upper() != symbol:
            return value
    return ""


def _action_for_row(row: pd.Series) -> str:
    for column in ("action", "recommended_action", "composite_action", "mid_action", "short_action", "long_action"):
        value = safe_str(row.get(column), "")
        if value:
            return value
    return "N/A"


def _empty_forward_df(analysis_dir: Path, analysis_raw: bool = False, history_dir: str | None = None) -> pd.DataFrame:
    forward_df = pd.DataFrame(columns=FORWARD_RETURN_COLUMNS)
    forward_df.attrs["analysis_dir"] = str(analysis_dir)
    forward_df.attrs["history_dir"] = history_dir
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


def _select_lifecycle_canonical(rows: pd.DataFrame) -> pd.Series:
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
        forward_df = _empty_forward_df(analysis_dir, analysis_raw=analysis_raw, history_dir=history_dir)
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
    forward_df.attrs["history_dir"] = history_dir
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


def _empty_lifecycle_outputs(analysis_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    lifecycle_df = pd.DataFrame(columns=SIGNAL_LIFECYCLE_COLUMNS)
    summary_df = pd.DataFrame(columns=SIGNAL_LIFECYCLE_SUMMARY_COLUMNS)
    atomic_write_dataframe_csv(lifecycle_df, analysis_dir / "signal_lifecycle.csv", index=False)
    atomic_write_dataframe_csv(summary_df, analysis_dir / "signal_lifecycle_summary.csv", index=False)
    return lifecycle_df, summary_df


def _prepare_lifecycle_history(history_df: pd.DataFrame) -> pd.DataFrame:
    working = history_df.copy()
    working["final_score"] = pd.to_numeric(working["final_score"], errors="coerce")
    if "final_score_adjusted" in working.columns:
        working["final_score_adjusted"] = pd.to_numeric(working["final_score_adjusted"], errors="coerce")
    else:
        working["final_score_adjusted"] = np.nan
    working["score_bucket"] = working["final_score"].apply(score_bucket_label)
    working["action"] = working.apply(_action_for_row, axis=1)
    working["entry_status"] = working.apply(_lifecycle_entry_status, axis=1)
    working["signal_date"] = working["timestamp_utc"].dt.strftime("%Y-%m-%d")
    if "market_regime" not in working.columns:
        working["market_regime"] = "UNKNOWN"
    return working


def _tracked_signal_rows(history_df: pd.DataFrame) -> pd.DataFrame:
    if history_df.empty:
        return pd.DataFrame(columns=history_df.columns)
    rating = history_df["rating"].fillna("").astype(str).str.upper()
    action = history_df["action"].fillna("").astype(str).str.upper().str.replace(r"\s+", " ", regex=True)
    entry_status = history_df["entry_status"].fillna("").astype(str).str.upper()
    mask = rating.isin({"TOP", "ACTIONABLE"}) | action.isin({"BUY", "STRONG BUY"}) | entry_status.isin(TRACKED_ENTRY_STATUSES)
    candidates = history_df.loc[mask].copy()
    if candidates.empty:
        return candidates
    canonical_rows = [
        _select_lifecycle_canonical(group)
        for _, group in candidates.groupby(["symbol", "signal_date"], sort=False, dropna=False)
    ]
    if not canonical_rows:
        return pd.DataFrame(columns=history_df.columns)
    return pd.DataFrame(canonical_rows).sort_values(["timestamp_utc", "symbol"], kind="mergesort").reset_index(drop=True)


def _trading_day_distance(start_date: str, event_date: str | None, symbol_dates: list[str]) -> int | float:
    if not event_date:
        return np.nan
    try:
        return symbol_dates.index(event_date) - symbol_dates.index(start_date)
    except ValueError:
        try:
            return (pd.Timestamp(event_date) - pd.Timestamp(start_date)).days
        except Exception:
            return np.nan


def _lifecycle_for_signal(signal: pd.Series, symbol_df: pd.DataFrame) -> dict[str, object]:
    symbol = safe_str(signal.get("symbol"), "").upper()
    signal_time = signal.get("timestamp_utc")
    signal_date = safe_str(signal.get("signal_date"), "")
    signal_price = safe_float(signal.get("price"), np.nan)
    signal_price_value = None if np.isnan(signal_price) else float(signal_price)
    buy_low, buy_high = _buy_zone(signal)
    stop = _stop_loss(signal)
    target = _conservative_target(signal)
    entry_reached = _price_in_buy_zone(signal_price_value, buy_low, buy_high)
    entry_date = signal_date if entry_reached else ""
    entry_price: float = signal_price_value if entry_reached and signal_price_value is not None else np.nan
    status = "ENTRY_REACHED" if entry_reached else "CREATED"
    exit_date = ""
    exit_price: float = np.nan
    exit_reason = ""
    base_price = signal_price_value
    max_drawdown: float = np.nan
    max_gain: float = np.nan

    future_rows = symbol_df[symbol_df["timestamp_utc"] > signal_time].sort_values("timestamp_utc").copy()
    symbol_dates = sorted(symbol_df["signal_date"].dropna().astype(str).unique().tolist())
    event_date: str | None = None
    observed_dates = 0

    for _, future in future_rows.iterrows():
        future_date = safe_str(future.get("signal_date"), "")
        if future_date:
            observed_dates = max(observed_dates, _trading_day_distance(signal_date, future_date, symbol_dates))
        if observed_dates > TRACKING_DAYS:
            break

        future_price = safe_float(future.get("price"), np.nan)
        if np.isnan(future_price):
            continue
        price_value = float(future_price)
        if signal_price_value and signal_price_value > 0:
            path_return = price_value / signal_price_value - 1.0
            max_drawdown = path_return if np.isnan(max_drawdown) else min(max_drawdown, path_return)
            max_gain = path_return if np.isnan(max_gain) else max(max_gain, path_return)

        if not entry_reached and _price_in_buy_zone(price_value, buy_low, buy_high):
            entry_reached = True
            entry_date = future_date
            entry_price = price_value
            status = "ENTRY_REACHED"
            base_price = price_value

        if target is not None and price_value >= target:
            status = "TARGET_HIT"
            exit_date = future_date
            exit_price = price_value
            exit_reason = "conservative_target"
            event_date = future_date
            break

        if stop is not None and price_value <= stop:
            status = "STOP_HIT"
            exit_date = future_date
            exit_price = price_value
            exit_reason = "stop_loss"
            event_date = future_date
            break

    if status not in {"TARGET_HIT", "STOP_HIT"}:
        if observed_dates >= TRACKING_DAYS:
            status = "EXPIRED"
            exit_reason = "expired"
            event_date = symbol_dates[min(symbol_dates.index(signal_date) + TRACKING_DAYS, len(symbol_dates) - 1)] if signal_date in symbol_dates else None
        elif future_rows.empty and status == "CREATED":
            status = "CREATED"
        elif status == "ENTRY_REACHED":
            event_date = entry_date
        else:
            status = "OPEN"

    days_to_entry = _trading_day_distance(signal_date, entry_date, symbol_dates) if entry_date else np.nan
    days_to_exit = _trading_day_distance(signal_date, event_date or exit_date, symbol_dates) if event_date or exit_date else np.nan
    return_pct = np.nan
    if not np.isnan(exit_price) and base_price and base_price > 0:
        return_pct = exit_price / base_price - 1.0

    signal_id = f"{symbol}:{signal_date}"
    return {
        "signal_id": signal_id,
        "symbol": symbol,
        "company_name": _company_name(signal),
        "signal_date": signal_date,
        "signal_price": round(signal_price, 6) if not np.isnan(signal_price) else np.nan,
        "rating": safe_str(signal.get("rating"), ""),
        "action": safe_str(signal.get("action"), ""),
        "setup_type": safe_str(signal.get("setup_type"), ""),
        "entry_status": safe_str(signal.get("entry_status"), "REVIEW"),
        "final_score": safe_float(signal.get("final_score"), np.nan),
        "final_score_adjusted": safe_float(signal.get("final_score_adjusted"), np.nan),
        "market_regime": safe_str(signal.get("market_regime"), "UNKNOWN"),
        "buy_zone": _format_range(buy_low, buy_high),
        "stop_loss": _format_level(stop) if stop is not None else "",
        "conservative_target": _format_level(target) if target is not None else "",
        "status": status,
        "entry_date": entry_date,
        "entry_price": round(entry_price, 6) if not np.isnan(entry_price) else np.nan,
        "exit_date": exit_date,
        "exit_price": round(exit_price, 6) if not np.isnan(exit_price) else np.nan,
        "exit_reason": exit_reason,
        "days_to_entry": days_to_entry,
        "days_to_exit": days_to_exit,
        "return_pct": round(return_pct, 6) if not np.isnan(return_pct) else np.nan,
        "max_drawdown": round(min(0.0, max_drawdown), 6) if not np.isnan(max_drawdown) else np.nan,
        "max_gain": round(max(0.0, max_gain), 6) if not np.isnan(max_gain) else np.nan,
        "score_bucket": safe_str(signal.get("score_bucket"), "unknown"),
    }


def summarize_signal_lifecycle(lifecycle_df: pd.DataFrame) -> pd.DataFrame:
    if lifecycle_df.empty:
        return pd.DataFrame(columns=SIGNAL_LIFECYCLE_SUMMARY_COLUMNS)
    rows: list[dict[str, object]] = []
    for group_col in SIGNAL_LIFECYCLE_GROUPS:
        if group_col not in lifecycle_df.columns:
            continue
        for group_value, group_df in lifecycle_df.groupby(group_col, dropna=False):
            count = int(len(group_df))
            if count == 0:
                continue
            status = group_df["status"].fillna("").astype(str)
            entry_reached = status.isin(["ENTRY_REACHED", "TARGET_HIT", "STOP_HIT", "EXPIRED"])
            returns = pd.to_numeric(group_df["return_pct"], errors="coerce").dropna()
            days_to_entry = pd.to_numeric(group_df["days_to_entry"], errors="coerce").dropna()
            days_to_exit = pd.to_numeric(group_df["days_to_exit"], errors="coerce").dropna()
            drawdown = pd.to_numeric(group_df["max_drawdown"], errors="coerce").dropna()
            gain = pd.to_numeric(group_df["max_gain"], errors="coerce").dropna()
            rows.append(
                {
                    "group_type": group_col,
                    "group_value": safe_str(group_value, "unknown") or "unknown",
                    "count": count,
                    "entry_reached_rate": round(float(entry_reached.mean()), 6),
                    "target_hit_rate": round(float((status == "TARGET_HIT").mean()), 6),
                    "stop_hit_rate": round(float((status == "STOP_HIT").mean()), 6),
                    "expired_rate": round(float((status == "EXPIRED").mean()), 6),
                    "open_rate": round(float(status.isin(["OPEN", "CREATED", "ENTRY_REACHED"]).mean()), 6),
                    "avg_return_pct": round(float(returns.mean()), 6) if not returns.empty else np.nan,
                    "avg_days_to_entry": round(float(days_to_entry.mean()), 2) if not days_to_entry.empty else np.nan,
                    "avg_days_to_exit": round(float(days_to_exit.mean()), 2) if not days_to_exit.empty else np.nan,
                    "avg_max_drawdown": round(float(drawdown.mean()), 6) if not drawdown.empty else np.nan,
                    "avg_max_gain": round(float(gain.mean()), 6) if not gain.empty else np.nan,
                }
            )
    return pd.DataFrame(rows, columns=SIGNAL_LIFECYCLE_SUMMARY_COLUMNS)


def compute_signal_lifecycle(history_dir: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    history_df = load_snapshot_history(history_dir)
    analysis_dir = Path(history_dir).parent / "analysis"
    analysis_dir.mkdir(parents=True, exist_ok=True)
    lifecycle_path = analysis_dir / "signal_lifecycle.csv"
    summary_path = analysis_dir / "signal_lifecycle_summary.csv"

    if history_df.empty:
        lifecycle_df, summary_df = _empty_lifecycle_outputs(analysis_dir)
        print("[analysis] signal lifecycle rows: 0")
        print("[analysis] signal lifecycle summary rows: 0")
        return lifecycle_df, summary_df

    history_df = _prepare_lifecycle_history(history_df)
    signal_rows = _tracked_signal_rows(history_df)
    if signal_rows.empty:
        lifecycle_df, summary_df = _empty_lifecycle_outputs(analysis_dir)
        print("[analysis] signal lifecycle rows: 0")
        print("[analysis] signal lifecycle summary rows: 0")
        return lifecycle_df, summary_df

    records: list[dict[str, object]] = []
    symbol_groups = {symbol: group.sort_values("timestamp_utc").reset_index(drop=True) for symbol, group in history_df.groupby("symbol")}
    for _, signal in signal_rows.iterrows():
        symbol = safe_str(signal.get("symbol"), "").upper()
        symbol_df = symbol_groups.get(symbol)
        if symbol_df is None or symbol_df.empty:
            continue
        records.append(_lifecycle_for_signal(signal, symbol_df))

    lifecycle_df = pd.DataFrame(records)
    if lifecycle_df.empty:
        lifecycle_df = pd.DataFrame(columns=SIGNAL_LIFECYCLE_COLUMNS)
    else:
        lifecycle_df = lifecycle_df.reindex(columns=[*SIGNAL_LIFECYCLE_COLUMNS, "score_bucket"])
        lifecycle_df = lifecycle_df.sort_values(["signal_date", "symbol"], ascending=[False, True], kind="mergesort").reset_index(drop=True)
    summary_df = summarize_signal_lifecycle(lifecycle_df)

    atomic_write_dataframe_csv(lifecycle_df.reindex(columns=SIGNAL_LIFECYCLE_COLUMNS), lifecycle_path, index=False)
    atomic_write_dataframe_csv(summary_df, summary_path, index=False)
    print(f"[analysis] signal lifecycle rows: {len(lifecycle_df)}")
    print(f"[analysis] signal lifecycle summary rows: {len(summary_df)}")
    return lifecycle_df.reindex(columns=SIGNAL_LIFECYCLE_COLUMNS), summary_df


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


def _json_safe_value(value: object) -> object:
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, int):
        return int(value)
    if isinstance(value, np.integer):
        return int(value.item())
    if isinstance(value, float):
        return None if np.isnan(value) or not np.isfinite(value) else float(value)
    if isinstance(value, np.floating):
        numeric_value = float(value.item())
        return None if np.isnan(numeric_value) or not np.isfinite(numeric_value) else numeric_value
    if value is None or _is_missing(value):
        return None
    return value


def _is_missing(value: Any) -> bool:
    try:
        return bool(pd.isna(value))
    except TypeError:
        return False


def _dataframe_records(df: pd.DataFrame) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for raw in df.to_dict(orient="records"):
        records.append({str(key): _json_safe_value(value) for key, value in raw.items()})
    return records


def _format_percent(value: object) -> str:
    parsed = safe_float(value, np.nan)
    if np.isnan(parsed):
        return "N/A"
    sign = "+" if parsed > 0 else ""
    return f"{sign}{parsed * 100:.2f}%"


def _format_ratio(value: object) -> str:
    parsed = safe_float(value, np.nan)
    if np.isnan(parsed):
        return "N/A"
    return f"{parsed * 100:.1f}%"


def _row_label(row: pd.Series) -> str:
    return f"{safe_str(row.get('group_type'), 'group')}={safe_str(row.get('group_value'), 'unknown')} on {safe_str(row.get('horizon'), 'unknown')}"


def _insight_record(row: pd.Series) -> dict[str, object]:
    return {
        "group_type": safe_str(row.get("group_type"), ""),
        "group_value": safe_str(row.get("group_value"), ""),
        "horizon": safe_str(row.get("horizon"), ""),
        "count": int(safe_float(row.get("count"), 0)),
        "avg_return": _json_safe_value(row.get("avg_return")),
        "hit_rate": _json_safe_value(row.get("hit_rate")),
        "avg_drawdown": _json_safe_value(row.get("avg_drawdown")),
        "avg_gain": _json_safe_value(row.get("avg_gain")),
        "edge_score": _json_safe_value(row.get("edge_score")),
        "low_sample": bool(row.get("low_sample")),
        "label": _row_label(row),
    }


def _best_row(df: pd.DataFrame, group_type: str, horizon: str | None = None) -> pd.Series | None:
    subset = df[df["group_type"] == group_type].copy()
    if horizon:
        subset = subset[subset["horizon"] == horizon].copy()
    subset = subset[~subset["low_sample"]].copy()
    if subset.empty:
        return None
    return subset.sort_values(["edge_score", "avg_return"], ascending=[False, False]).iloc[0]


def _calibration_note_for_score_buckets(df: pd.DataFrame) -> str:
    score_rows = df[(df["group_type"] == "score_bucket") & ~df["low_sample"]].copy()
    if score_rows.empty:
        return "Score bucket samples are still too small; do not recalibrate score thresholds yet."

    notes: list[str] = []
    for horizon in HORIZONS:
        horizon_rows = score_rows[score_rows["horizon"] == horizon]
        high = horizon_rows[horizon_rows["group_value"] == "80+"]
        mid = horizon_rows[horizon_rows["group_value"] == "70-79"]
        if high.empty or mid.empty:
            continue
        high_row = high.iloc[0]
        mid_row = mid.iloc[0]
        if safe_float(high_row.get("edge_score"), -np.inf) <= safe_float(mid_row.get("edge_score"), -np.inf):
            notes.append(f"80+ score bucket does not outperform 70-79 on {horizon}; investigate overextension.")
    if notes:
        return " ".join(notes)

    best = _best_row(score_rows, "score_bucket")
    if best is None:
        return "Score bucket samples are still too small; do not recalibrate score thresholds yet."
    return f"Best score bucket so far: {safe_str(best.get('group_value'), 'unknown')} on {safe_str(best.get('horizon'), 'unknown')} with {_format_percent(best.get('avg_return'))} average return and {_format_ratio(best.get('hit_rate'))} hit rate."


def _calibration_note_for_rating_action(df: pd.DataFrame) -> str:
    notes: list[str] = []
    rating_rows = df[(df["group_type"] == "rating") & ~df["low_sample"]].copy()
    action_rows = df[(df["group_type"] == "action") & ~df["low_sample"]].copy()

    for horizon in HORIZONS:
        horizon_rows = rating_rows[rating_rows["horizon"] == horizon]
        top = horizon_rows[horizon_rows["group_value"] == "TOP"]
        actionable = horizon_rows[horizon_rows["group_value"] == "ACTIONABLE"]
        watch = horizon_rows[horizon_rows["group_value"] == "WATCH"]
        if not top.empty and not actionable.empty and safe_float(top.iloc[0].get("edge_score"), -np.inf) < safe_float(actionable.iloc[0].get("edge_score"), -np.inf):
            notes.append(f"TOP underperforms ACTIONABLE on {horizon}; rating thresholds may need review.")
        if not watch.empty and not actionable.empty:
            watch_edge = safe_float(watch.iloc[0].get("edge_score"), np.nan)
            actionable_edge = safe_float(actionable.iloc[0].get("edge_score"), np.nan)
            if not np.isnan(watch_edge) and not np.isnan(actionable_edge) and abs(watch_edge - actionable_edge) <= 1.0:
                notes.append(f"WATCH performs close to ACTIONABLE on {horizon}; rating separation may be weak.")

    for horizon in HORIZONS:
        horizon_rows = action_rows[action_rows["horizon"] == horizon]
        strong_buy = horizon_rows[horizon_rows["group_value"] == "STRONG BUY"]
        buy = horizon_rows[horizon_rows["group_value"] == "BUY"]
        if not strong_buy.empty and not buy.empty and safe_float(strong_buy.iloc[0].get("edge_score"), -np.inf) < safe_float(buy.iloc[0].get("edge_score"), -np.inf):
            notes.append(f"STRONG BUY underperforms BUY on {horizon}; action calibration may need review.")

    if notes:
        return " ".join(notes[:4])
    best_rating = _best_row(df, "rating")
    best_action = _best_row(df, "action")
    parts = []
    if best_rating is not None:
        parts.append(f"Best rating: {safe_str(best_rating.get('group_value'), 'unknown')} on {safe_str(best_rating.get('horizon'), 'unknown')}.")
    if best_action is not None:
        parts.append(f"Best action: {safe_str(best_action.get('group_value'), 'unknown')} on {safe_str(best_action.get('horizon'), 'unknown')}.")
    return " ".join(parts) if parts else "Rating/action samples are still too small; do not recalibrate yet."


def _calibration_note_for_setups(df: pd.DataFrame) -> str:
    setup_rows = df[(df["group_type"] == "setup_type") & ~df["low_sample"]].copy()
    if setup_rows.empty:
        return "Setup samples are still too small; do not recalibrate setup weights yet."
    best = setup_rows.sort_values(["edge_score", "avg_return"], ascending=[False, False]).iloc[0]
    worst = setup_rows.sort_values(["edge_score", "avg_return"], ascending=[True, True]).iloc[0]
    return (
        f"{safe_str(best.get('group_value'), 'unknown')} is the strongest setup on {safe_str(best.get('horizon'), 'unknown')} "
        f"({_format_percent(best.get('avg_return'))} avg return, {_format_ratio(best.get('hit_rate'))} hit rate). "
        f"{safe_str(worst.get('group_value'), 'unknown')} is the weakest sampled setup on {safe_str(worst.get('horizon'), 'unknown')}."
    )


def generate_calibration_insights(summary_df: pd.DataFrame, forward_returns_df: pd.DataFrame, analysis_dir: Path) -> dict[str, object]:
    analysis_dir.mkdir(parents=True, exist_ok=True)
    calibration_path = analysis_dir / "calibration_insights.csv"
    json_path = analysis_dir / "calibration_insights.json"

    if summary_df.empty:
        calibration_df = pd.DataFrame(columns=CALIBRATION_COLUMNS)
        atomic_write_dataframe_csv(calibration_df, calibration_path, index=False)
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "status": "not_ready",
            "message": "Analysis complete, but no completed forward-return observations exist yet.",
            "best_performers": [],
            "worst_performers": [],
            "low_sample_warnings": [],
            "score_bucket_note": "No completed score-bucket observations yet.",
            "setup_note": "No completed setup observations yet.",
            "rating_action_note": "No completed rating/action observations yet.",
            "warnings": ["No completed forward-return observations yet."],
            "rows": [],
        }
        _atomic_write_json(payload, json_path)
        print(f"[analysis] calibration insights written: 0 rows")
        return payload

    calibration_df = summary_df.copy()
    calibration_df["avg_drawdown"] = pd.to_numeric(calibration_df["avg_max_drawdown"], errors="coerce")
    calibration_df["avg_gain"] = pd.to_numeric(calibration_df["avg_max_gain"], errors="coerce")
    calibration_df["edge_score"] = (
        pd.to_numeric(calibration_df["avg_return"], errors="coerce").fillna(0.0) * 100
        + pd.to_numeric(calibration_df["hit_rate"], errors="coerce").fillna(0.0) * 10
        + calibration_df["avg_gain"].fillna(0.0) * 20
        + calibration_df["avg_drawdown"].fillna(0.0) * 20
    )
    calibration_df = calibration_df.reindex(columns=CALIBRATION_COLUMNS)
    calibration_df["edge_score"] = calibration_df["edge_score"].round(6)
    atomic_write_dataframe_csv(calibration_df, calibration_path, index=False)

    ranked = calibration_df.dropna(subset=["edge_score"]).copy()
    sufficient = ranked[~ranked["low_sample"]].copy()
    ranking_source = sufficient if not sufficient.empty else ranked
    best_performers = _dataframe_records(ranking_source.sort_values(["edge_score", "avg_return"], ascending=[False, False]).head(10))
    worst_performers = _dataframe_records(ranking_source.sort_values(["edge_score", "avg_return"], ascending=[True, True]).head(10))

    low_sample_rows = calibration_df[calibration_df["low_sample"]].copy()
    low_sample_warnings = [
        f"{safe_str(row.get('group_value'), 'unknown')} ({safe_str(row.get('group_type'), 'group')}, {safe_str(row.get('horizon'), 'unknown')}) has low sample size ({int(safe_float(row.get('count'), 0))}); do not recalibrate yet."
        for _, row in low_sample_rows.sort_values(["group_type", "group_value", "horizon"]).head(20).iterrows()
    ]
    warnings: list[str] = []
    if ranked.empty:
        warnings.append("No calibration rows available.")
    elif sufficient.empty:
        warnings.append("All calibration groups have low sample size; use insights directionally only.")
    if low_sample_warnings:
        warnings.append(f"{len(low_sample_rows)} group/horizon combinations have low sample size.")

    best_group = _insight_record(ranking_source.sort_values(["edge_score", "avg_return"], ascending=[False, False]).iloc[0]) if not ranking_source.empty else None
    worst_group = _insight_record(ranking_source.sort_values(["edge_score", "avg_return"], ascending=[True, True]).iloc[0]) if not ranking_source.empty else None

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "ready",
        "forward_observations": int(len(forward_returns_df)),
        "calibration_rows": int(len(calibration_df)),
        "best_group": best_group,
        "worst_group": worst_group,
        "best_performers": best_performers,
        "worst_performers": worst_performers,
        "low_sample_warnings": low_sample_warnings,
        "score_bucket_note": _calibration_note_for_score_buckets(calibration_df),
        "setup_note": _calibration_note_for_setups(calibration_df),
        "rating_action_note": _calibration_note_for_rating_action(calibration_df),
        "warnings": warnings,
        "rows": _dataframe_records(calibration_df),
    }
    _atomic_write_json(payload, json_path)
    print(f"[analysis] calibration insights written: {len(calibration_df)} rows")
    print(f"Saved calibration insights to: {json_path}")
    return payload


def _atomic_write_json(payload: dict[str, object], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f"{path.name}.{os.getpid()}.{datetime.now(timezone.utc).timestamp():.6f}.tmp")
    try:
        tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        tmp_path.replace(path)
    finally:
        tmp_path.unlink(missing_ok=True)


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
    generate_calibration_insights(summary_df, forward_returns_df, analysis_dir)
    history_dir = forward_returns_df.attrs.get("history_dir")
    if history_dir:
        compute_signal_lifecycle(str(history_dir))

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
