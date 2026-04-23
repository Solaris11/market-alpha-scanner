from __future__ import annotations

from pathlib import Path

import pandas as pd
import streamlit as st


DEFAULT_TABLE_COLUMNS = [
    "symbol",
    "asset_type",
    "sector",
    "price",
    "short_action",
    "mid_action",
    "long_action",
    "final_score",
    "short_score",
    "mid_score",
    "long_score",
    "rating",
    "setup_type",
]
RATING_STATUS_ORDER = ["TOP", "ACTIONABLE", "WATCH", "PASS"]
HISTORY_TIMELINE_COLUMNS = ["timestamp_utc", "price", "final_score", "rating"]
PERFORMANCE_METRIC_COLUMNS = ["avg_return", "median_return", "hit_rate", "avg_negative_return", "min_return"]
PERCENT_COLUMNS = {"avg_return", "median_return", "hit_rate", "avg_negative_return", "min_return"}


def format_timestamp(value: object) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "N/A"
    ts = pd.to_datetime(value, utc=True, errors="coerce")
    if pd.isna(ts):
        return "N/A"
    return ts.strftime("%Y-%m-%d %H:%M:%S UTC")


def format_percent(value: object) -> str:
    numeric = pd.to_numeric(value, errors="coerce")
    if pd.isna(numeric):
        return "N/A"
    return f"{numeric * 100:.2f}%"


def format_number(value: object, decimals: int = 2) -> str:
    numeric = pd.to_numeric(value, errors="coerce")
    if pd.isna(numeric):
        return "N/A"
    return f"{float(numeric):.{decimals}f}"


def format_billions(value: object) -> str:
    numeric = pd.to_numeric(value, errors="coerce")
    if pd.isna(numeric):
        return "N/A"
    number = float(numeric)
    if number >= 1_000_000_000_000:
        return f"{number / 1_000_000_000_000:.2f}T"
    if number >= 1_000_000_000:
        return f"{number / 1_000_000_000:.2f}B"
    if number >= 1_000_000:
        return f"{number / 1_000_000:.2f}M"
    return f"{number:,.0f}"


def sort_scan_df(df: pd.DataFrame) -> pd.DataFrame:
    sorted_df = df.copy()
    if "final_score" in sorted_df.columns:
        sorted_df = sorted_df.sort_values("final_score", ascending=False, na_position="last")
    return sorted_df.reset_index(drop=True)


def filter_scan_df(
    df: pd.DataFrame,
    symbol_query: str,
    asset_types: list[str],
    sectors: list[str],
    ratings: list[str],
    min_final_score: float,
) -> pd.DataFrame:
    filtered = df.copy()
    if symbol_query and "symbol" in filtered.columns:
        filtered = filtered[filtered["symbol"].str.contains(symbol_query.upper().strip(), na=False)]
    if asset_types and "asset_type" in filtered.columns:
        filtered = filtered[filtered["asset_type"].isin(asset_types)]
    if sectors and "sector" in filtered.columns:
        filtered = filtered[filtered["sector"].isin(sectors)]
    if ratings and "rating" in filtered.columns:
        filtered = filtered[filtered["rating"].isin(ratings)]
    if "final_score" in filtered.columns:
        filtered = filtered[filtered["final_score"].fillna(float("-inf")) >= min_final_score]
    return filtered.reset_index(drop=True)


def highlight_top_rows(row: pd.Series) -> list[str]:
    if str(row.get("rating", "")).upper() == "TOP":
        return ["background-color: #fff3cd; font-weight: 700;" for _ in row.index]
    return ["" for _ in row.index]


def display_table(df: pd.DataFrame, preferred_columns: list[str], height: int = 420, highlight_top: bool = False) -> None:
    if df.empty:
        st.info("No rows match the current selection.")
        return
    sorted_df = sort_scan_df(df)
    visible_columns = [column for column in preferred_columns if column in sorted_df.columns]
    display_df = sorted_df[visible_columns].copy() if visible_columns else sorted_df.copy()
    format_map = {column: "{:.2f}" for column in display_df.columns if pd.api.types.is_numeric_dtype(display_df[column])}
    try:
        styler = display_df.style.format(format_map)
        if highlight_top and "rating" in display_df.columns:
            styler = styler.apply(highlight_top_rows, axis=1)
        st.dataframe(styler, use_container_width=True, height=height)
    except AttributeError:
        # Some lean server environments ship pandas without the optional Styler deps.
        st.dataframe(display_df, use_container_width=True, height=height)


def display_key_value_table(data: dict[str, object], title: str) -> None:
    rows = [{"field": key, "value": value} for key, value in data.items()]
    st.subheader(title)
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)


def build_count_table(df: pd.DataFrame, column: str) -> pd.DataFrame:
    if column not in df.columns:
        return pd.DataFrame(columns=[column, "count"])
    return (
        df[column]
        .fillna("Unknown")
        .astype(str)
        .value_counts(dropna=False)
        .rename_axis(column)
        .reset_index(name="count")
    )


def score_level(value: object) -> str:
    numeric = pd.to_numeric(value, errors="coerce")
    if pd.isna(numeric):
        return "N/A"
    if numeric >= 75:
        return "High"
    if numeric >= 55:
        return "Medium"
    return "Low"


def risk_level(value: object) -> str:
    numeric = pd.to_numeric(value, errors="coerce")
    if pd.isna(numeric):
        return "N/A"
    if numeric <= 10:
        return "Low"
    if numeric <= 25:
        return "Medium"
    return "High"


def selected_symbol_index(symbols: list[str]) -> int:
    selected_symbol = st.session_state.get("selected_symbol")
    if selected_symbol in symbols:
        return symbols.index(selected_symbol)
    return 0


def open_symbol_detail(symbol: str) -> None:
    st.session_state["selected_symbol"] = symbol
    st.session_state["current_page"] = "Symbol Detail"
    st.rerun()


def render_symbol_quick_actions(symbols: list[str]) -> None:
    if not symbols:
        return
    st.subheader("Inspect Symbol")
    for start in range(0, min(len(symbols), 12), 4):
        row_symbols = symbols[start:start + 4]
        columns = st.columns(len(row_symbols))
        for column, symbol in zip(columns, row_symbols):
            if column.button(symbol, key=f"inspect_{symbol}", use_container_width=True):
                open_symbol_detail(symbol)


def format_performance_display(df: pd.DataFrame) -> pd.DataFrame:
    display_df = df.copy()
    for column in PERFORMANCE_METRIC_COLUMNS:
        if column in display_df.columns:
            display_df[column] = pd.to_numeric(display_df[column], errors="coerce")
    for column in PERCENT_COLUMNS:
        if column in display_df.columns:
            display_df[column] = display_df[column].apply(lambda value: f"{value * 100:.2f}%" if pd.notna(value) else "N/A")
    if "count" in display_df.columns:
        display_df["count"] = pd.to_numeric(display_df["count"], errors="coerce").fillna(0).astype(int)
    return display_df
