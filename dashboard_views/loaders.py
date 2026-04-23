from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, cast

import pandas as pd
import streamlit as st
import yfinance as yf

from .shared import format_timestamp


BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "scanner_output"
FULL_RANKING_PATH = OUTPUT_DIR / "full_ranking.csv"
TOP_CANDIDATES_PATH = OUTPUT_DIR / "top_candidates.csv"
HISTORY_DIR = OUTPUT_DIR / "history"
ANALYSIS_DIR = OUTPUT_DIR / "analysis"
PERFORMANCE_SUMMARY_PATH = ANALYSIS_DIR / "performance_summary.csv"
FORWARD_RETURNS_PATH = ANALYSIS_DIR / "forward_returns.csv"
SYMBOLS_DIR = OUTPUT_DIR / "symbols"

STRING_COLUMNS = [
    "symbol", "asset_type", "sector", "rating", "setup_type", "industry",
    "valuation_flag", "profitability_status", "macro_sensitivity", "upside_driver",
    "key_risk", "short_action", "mid_action", "long_action", "composite_action",
    "short_reason", "mid_reason", "long_reason", "selection_reason", "headline_bias",
]
NUMERIC_SCAN_COLUMNS = [
    "price", "market_cap", "avg_dollar_volume", "technical_score", "fundamental_score",
    "news_score", "macro_score", "risk_penalty", "final_score", "short_score", "mid_score",
    "long_score", "trend_score", "supertrend_score", "momentum_score", "breakout_score",
    "relative_volume_score", "avwap_score", "quality_score", "growth_score", "valuation_score",
    "dividend_yield", "current_rsi", "current_macd_hist", "atr_pct", "annualized_volatility",
    "max_drawdown", "trailing_pe", "forward_pe", "revenue_growth", "earnings_growth",
    "gross_margin", "operating_margin", "profit_margin", "debt_to_equity", "return_on_equity",
]


def safe_read_csv(path: Path) -> tuple[pd.DataFrame | None, str | None]:
    if not path.exists():
        return None, f"Missing file: `{path.relative_to(BASE_DIR)}`"
    try:
        df = pd.read_csv(path)
        df.columns = [str(column).strip() for column in df.columns]
        return df, None
    except Exception as exc:
        return None, f"Failed to read `{path.relative_to(BASE_DIR)}`: {exc}"


def safe_read_json(path: Path) -> tuple[dict[str, object] | None, str | None]:
    if not path.exists():
        return None, f"Missing file: `{path.relative_to(BASE_DIR)}`"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            return {str(key): cast(object, value) for key, value in payload.items()}, None
        return None, f"Expected JSON object in `{path.relative_to(BASE_DIR)}`"
    except Exception as exc:
        return None, f"Failed to read `{path.relative_to(BASE_DIR)}`: {exc}"


def symbol_slug(symbol: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_", "."} else "_" for char in symbol)


def symbol_dir(symbol: str) -> Path:
    return SYMBOLS_DIR / symbol_slug(symbol)


def coerce_numeric(df: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    for column in columns:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")
    return df


def prepare_scan_df(df: pd.DataFrame) -> pd.DataFrame:
    prepared = df.copy()
    prepared.columns = [str(column).strip() for column in prepared.columns]
    for column in STRING_COLUMNS:
        if column in prepared.columns:
            prepared[column] = prepared[column].astype("string").str.strip()
            prepared[column] = prepared[column].replace("", pd.NA)
    if "symbol" in prepared.columns:
        prepared["symbol"] = prepared["symbol"].str.upper()
    return coerce_numeric(prepared, NUMERIC_SCAN_COLUMNS)


def list_snapshot_files(history_dir: Path) -> list[Path]:
    if not history_dir.exists():
        return []
    return sorted(history_dir.glob("scan_*.csv"), reverse=True)


def parse_snapshot_timestamp(snapshot_path: Path) -> pd.Timestamp | None:
    stem = snapshot_path.stem.replace("scan_", "")
    try:
        return pd.Timestamp(datetime.strptime(stem, "%Y%m%d_%H%M%S"), tz="UTC")
    except ValueError:
        return None


def infer_file_timestamp(paths: Iterable[Path]) -> str | None:
    existing_paths = [path for path in paths if path.exists()]
    if not existing_paths:
        return None
    latest_path = max(existing_paths, key=lambda path: path.stat().st_mtime)
    latest_dt = datetime.fromtimestamp(latest_path.stat().st_mtime, tz=timezone.utc)
    return latest_dt.strftime("%Y-%m-%d %H:%M:%S UTC")


def infer_latest_scan_timestamp(full_df: pd.DataFrame | None, snapshot_files: list[Path]) -> str:
    if full_df is not None and "timestamp_utc" in full_df.columns:
        ts_series = pd.to_datetime(full_df["timestamp_utc"], utc=True, errors="coerce").dropna()
        if not ts_series.empty:
            return format_timestamp(ts_series.max())
    if snapshot_files:
        parsed = parse_snapshot_timestamp(snapshot_files[0])
        if parsed is not None:
            return format_timestamp(parsed)
    if FULL_RANKING_PATH.exists():
        modified_at = datetime.fromtimestamp(FULL_RANKING_PATH.stat().st_mtime, tz=timezone.utc)
        return modified_at.strftime("%Y-%m-%d %H:%M:%S UTC")
    return "N/A"


def load_history_df(snapshot_files: list[Path]) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for snapshot_path in sorted(snapshot_files):
        df, error = safe_read_csv(snapshot_path)
        if error or df is None or df.empty:
            continue
        if "timestamp_utc" not in df.columns:
            parsed = parse_snapshot_timestamp(snapshot_path)
            if parsed is not None:
                df.insert(0, "timestamp_utc", parsed.isoformat())
            else:
                continue
        df["source_file"] = snapshot_path.name
        frames.append(df)

    if not frames:
        return pd.DataFrame()
    history_df = pd.concat(frames, ignore_index=True)
    history_df = prepare_scan_df(history_df)
    history_df["timestamp_utc"] = pd.to_datetime(history_df["timestamp_utc"], utc=True, errors="coerce")
    history_df = history_df.dropna(subset=["timestamp_utc"])
    return history_df.sort_values(["timestamp_utc", "symbol"]).reset_index(drop=True)


def load_symbol_summary(symbol: str) -> dict[str, object] | None:
    payload, _ = safe_read_json(symbol_dir(symbol) / "summary.json")
    return payload


def load_symbol_history_file(symbol: str) -> pd.DataFrame:
    history_df, _ = safe_read_csv(symbol_dir(symbol) / "history.csv")
    if history_df is None or history_df.empty:
        return pd.DataFrame()
    history_df.columns = [str(column).strip().lower() for column in history_df.columns]
    if "date" not in history_df.columns and "datetime" in history_df.columns:
        history_df = history_df.rename(columns={"datetime": "date"})
    if "date" in history_df.columns:
        history_df["date"] = pd.to_datetime(history_df["date"], errors="coerce")
        history_df = history_df.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
    return history_df


@st.cache_data(ttl=900, show_spinner=False)
def fetch_live_symbol_history(symbol: str, period: str = "2y") -> pd.DataFrame:
    try:
        raw = yf.download(symbol, period=period, interval="1d", auto_adjust=True, progress=False)
    except Exception:
        return pd.DataFrame()
    df = pd.DataFrame(raw)
    if df.empty:
        return pd.DataFrame()
    history_df = df.reset_index().rename(columns={"Date": "date"})
    history_df.columns = [str(column).strip().lower() for column in history_df.columns]
    history_df["date"] = pd.to_datetime(history_df["date"], errors="coerce")
    return history_df.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)


@st.cache_data(ttl=900, show_spinner=False)
def fetch_recent_news_items(symbol: str, max_items: int = 8) -> list[dict[str, str]]:
    try:
        items = yf.Ticker(symbol).news or []
    except Exception:
        return []

    news_rows: list[dict[str, str]] = []
    for item in items[:max_items]:
        if not isinstance(item, Mapping):
            continue
        content = item.get("content", {})
        canonical = item.get("canonicalUrl", {})
        if not isinstance(content, Mapping):
            content = {}
        if not isinstance(canonical, Mapping):
            canonical = {}
        provider = content.get("provider", {})
        if not isinstance(provider, Mapping):
            provider = {}
        news_rows.append(
            {
                "title": str(content.get("title", "")).strip(),
                "source": str(provider.get("displayName", "")).strip(),
                "published": format_timestamp(content.get("pubDate")),
                "summary": str(content.get("summary", "")).strip(),
                "link": str(canonical.get("url", "")).strip(),
            }
        )
    return [row for row in news_rows if row["title"]]


def load_symbol_price_history(symbol: str) -> tuple[pd.DataFrame, str]:
    file_df = load_symbol_history_file(symbol)
    if not file_df.empty:
        return file_df, "scanner output"
    live_df = fetch_live_symbol_history(symbol)
    if not live_df.empty:
        return live_df, "live yfinance"
    return pd.DataFrame(), "unavailable"


def filter_price_history(history_df: pd.DataFrame, range_label: str) -> pd.DataFrame:
    if history_df.empty or "date" not in history_df.columns:
        return pd.DataFrame()
    range_days = {"1M": 31, "3M": 92, "6M": 183, "1Y": 366, "2Y": 731}
    max_date = history_df["date"].max()
    cutoff = max_date - pd.Timedelta(days=range_days.get(range_label, 366))
    return history_df[history_df["date"] >= cutoff].copy()


def snapshot_options(snapshot_files: list[Path]) -> dict[str, Path]:
    options: dict[str, Path] = {}
    for path in snapshot_files:
        label = f"{path.name} | {format_timestamp(parse_snapshot_timestamp(path))}"
        options[label] = path
    return options


def compare_snapshots(left_df: pd.DataFrame, right_df: pd.DataFrame) -> pd.DataFrame:
    if "symbol" not in left_df.columns or "symbol" not in right_df.columns:
        return pd.DataFrame()
    left = prepare_scan_df(left_df).copy()
    right = prepare_scan_df(right_df).copy()
    merged = left.merge(right, on="symbol", how="outer", suffixes=("_left", "_right"), indicator=True)
    if "final_score_left" in merged.columns and "final_score_right" in merged.columns:
        merged["final_score_delta"] = merged["final_score_right"] - merged["final_score_left"]
    preferred_columns = ["symbol", "_merge", "rating_left", "rating_right", "final_score_left", "final_score_right", "final_score_delta", "price_left", "price_right"]
    available_columns = [column for column in preferred_columns if column in merged.columns]
    return merged[available_columns].sort_values(["_merge", "symbol"]).reset_index(drop=True)
