from __future__ import annotations

from pathlib import Path

import pandas as pd
import streamlit as st

from .loaders import infer_file_timestamp, infer_latest_scan_timestamp, prepare_scan_df
from .shared import (
    DEFAULT_TABLE_COLUMNS,
    RATING_STATUS_ORDER,
    build_count_table,
    display_table,
    filter_scan_df,
    open_symbol_detail,
    render_symbol_quick_actions,
    selected_symbol_index,
)


def render_status_panel(full_df: pd.DataFrame, snapshot_files: list[Path], performance_summary_path: Path, forward_returns_path: Path) -> None:
    st.subheader("Status")

    last_analysis_timestamp = infer_file_timestamp([performance_summary_path, forward_returns_path])
    status_columns = st.columns(4)
    status_columns[0].metric("Last scan", infer_latest_scan_timestamp(full_df, snapshot_files))
    status_columns[1].metric("Last analysis", last_analysis_timestamp or "Not ready")
    status_columns[2].metric("Snapshots in history", f"{len(snapshot_files):,}")
    status_columns[3].metric("Symbols in latest scan", f"{len(full_df):,}")

    if not snapshot_files:
        st.info("No historical snapshots yet. Scanner needs to run at least once.")
    if last_analysis_timestamp is None:
        st.info("No analysis data yet — run scanner and analysis jobs.")

    rating_counts = build_count_table(full_df, "rating")
    asset_type_counts = build_count_table(full_df, "asset_type")
    rating_status_counts = (
        rating_counts.set_index("rating")["count"].to_dict()
        if not rating_counts.empty and "rating" in rating_counts.columns
        else {}
    )

    st.caption("Count by rating")
    rating_columns = st.columns(len(RATING_STATUS_ORDER))
    for index, rating in enumerate(RATING_STATUS_ORDER):
        rating_columns[index].metric(rating, int(rating_status_counts.get(rating, 0)))

    st.caption("Count by asset_type")
    if asset_type_counts.empty:
        st.info("No asset type data available in the latest scan.")
    else:
        st.dataframe(asset_type_counts, use_container_width=True, height=min(260, 35 + (len(asset_type_counts) * 35)))


def render_overview_page(
    full_df: pd.DataFrame | None,
    top_df: pd.DataFrame | None,
    snapshot_files: list[Path],
    performance_summary_path: Path,
    forward_returns_path: Path,
) -> None:
    st.header("Overview / Latest Scan")

    if full_df is None:
        st.info("Latest scan data is not available yet. Run the scanner to generate the latest ranking files.")
        return

    full_df = prepare_scan_df(full_df)
    top_df = prepare_scan_df(top_df) if top_df is not None else pd.DataFrame()
    render_status_panel(full_df, snapshot_files, performance_summary_path, forward_returns_path)

    with st.sidebar:
        st.subheader("Overview Filters")
        symbol_query = st.text_input("Symbol search")
        asset_types = st.multiselect(
            "Asset type",
            sorted(full_df["asset_type"].dropna().astype(str).unique().tolist()) if "asset_type" in full_df.columns else [],
        )
        sectors = st.multiselect(
            "Sector",
            sorted(full_df["sector"].dropna().astype(str).unique().tolist()) if "sector" in full_df.columns else [],
        )
        ratings = st.multiselect(
            "Rating",
            sorted(full_df["rating"].dropna().astype(str).unique().tolist()) if "rating" in full_df.columns else [],
        )
        min_final_score = st.number_input("Minimum final_score", value=0.0, step=1.0)

    filtered_full = filter_scan_df(full_df, symbol_query, asset_types, sectors, ratings, min_final_score)
    filtered_top = filter_scan_df(top_df, symbol_query, asset_types, sectors, ratings, min_final_score) if not top_df.empty else pd.DataFrame()

    st.caption(f"Filtered rows: {len(filtered_full):,}")
    render_symbol_quick_actions(filtered_top["symbol"].dropna().astype(str).head(8).tolist() if not filtered_top.empty else [])

    if not filtered_full.empty:
        available_symbols = filtered_full["symbol"].dropna().astype(str).tolist()
        selected_symbol = st.selectbox(
            "Select a symbol to inspect",
            available_symbols,
            index=selected_symbol_index(available_symbols),
            key="overview_selected_symbol",
        )
        inspect_columns = st.columns([1, 3])
        if inspect_columns[0].button("Open detail view", use_container_width=True):
            open_symbol_detail(selected_symbol)
        inspect_columns[1].caption("The same selection opens in the dedicated Symbol Detail page.")

    st.subheader("Top Candidates")
    if top_df.empty:
        st.info("Top candidates data is not available yet. Run the scanner to generate `top_candidates.csv`.")
    else:
        display_table(filtered_top, DEFAULT_TABLE_COLUMNS, highlight_top=True)

    st.subheader("Full Ranking")
    display_table(filtered_full, DEFAULT_TABLE_COLUMNS, height=520, highlight_top=True)
