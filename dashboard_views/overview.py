from __future__ import annotations

from pathlib import Path

import pandas as pd
import streamlit as st

from .loaders import infer_file_timestamp, infer_latest_scan_timestamp, prepare_scan_df
from .shared import (
    build_count_table,
    display_table,
    filter_scan_df,
    format_number,
    load_watchlist,
    open_symbol_detail,
    render_action_badge,
    render_info_card,
    render_rating_badge,
    render_score_badge,
    render_section_heading,
    render_symbol_quick_actions,
    render_watchlist_panel,
    selected_symbol_index,
    sort_scan_df,
)

OVERVIEW_TABLE_COLUMNS = [
    "symbol",
    "asset_type",
    "sector",
    "price",
    "final_score",
    "rating",
    "composite_action",
    "short_action",
    "mid_action",
    "long_action",
    "setup_type",
]


def _summary_card(label: str, value: object, meta: str = "", tone: str = "neutral") -> None:
    st.markdown(render_info_card(label, value, meta, tone), unsafe_allow_html=True)


def render_status_panel(
    full_df: pd.DataFrame,
    snapshot_files: list[Path],
    performance_summary_path: Path,
    forward_returns_path: Path,
) -> None:
    render_section_heading("Market Pulse", "Latest scan freshness, breadth, and desk-level signal distribution.", eyebrow="Overview")

    last_analysis_timestamp = infer_file_timestamp([performance_summary_path, forward_returns_path])
    status_columns = st.columns(4)
    with status_columns[0]:
        _summary_card("Last Scan", infer_latest_scan_timestamp(full_df, snapshot_files), "Most recent ranking snapshot", "accent")
    with status_columns[1]:
        _summary_card("Last Analysis", last_analysis_timestamp or "Not ready", "Forward-return analytics", "neutral")
    with status_columns[2]:
        _summary_card("Snapshots", f"{len(snapshot_files):,}", "Saved scan history", "neutral")
    with status_columns[3]:
        _summary_card("Symbols", f"{len(full_df):,}", "Names in latest scan", "positive")

    rating_counts = build_count_table(full_df, "rating")
    asset_type_counts = build_count_table(full_df, "asset_type")
    rating_lookup = (
        rating_counts.set_index("rating")["count"].to_dict()
        if not rating_counts.empty and "rating" in rating_counts.columns
        else {}
    )

    rating_columns = st.columns(4)
    for column, rating in zip(rating_columns, ["TOP", "ACTIONABLE", "WATCH", "PASS"]):
        with column:
            count = int(rating_lookup.get(rating, 0))
            tone = "positive" if rating == "TOP" else "accent" if rating == "ACTIONABLE" else "warning" if rating == "WATCH" else "negative"
            _summary_card(rating, f"{count:,}", "Current scan count", tone)

    with st.container(border=True):
        left, right = st.columns([1.2, 1.8], gap="large")
        with left:
            st.caption("Desk Notes")
            if not snapshot_files:
                st.info("No historical snapshots yet. Scanner needs to run at least once.")
            elif last_analysis_timestamp is None:
                st.info("No analysis data yet. Run the scanner with analysis to populate forward-return views.")
            else:
                st.success("Scan output and performance layers are available.")
        with right:
            st.caption("Asset Mix")
            if asset_type_counts.empty:
                st.info("No asset type data available in the latest scan.")
            else:
                st.dataframe(asset_type_counts, use_container_width=True, hide_index=True, height=min(260, 35 + (len(asset_type_counts) * 35)))


def render_top_candidate_cards(top_df: pd.DataFrame) -> None:
    render_section_heading("Top Candidates", "Highest-conviction names from the latest scan. Built for quick triage.", eyebrow="High Conviction")
    if top_df.empty:
        st.info("Top candidates data is not available yet. Run the scanner to generate `top_candidates.csv`.")
        return

    ranked_top = sort_scan_df(top_df).head(6).reset_index(drop=True)
    columns = st.columns(3, gap="large")

    for index, (_, row) in enumerate(ranked_top.iterrows()):
        symbol = str(row.get("symbol", "N/A"))
        asset_type = str(row.get("asset_type", "Unknown"))
        sector = str(row.get("sector", "Unknown"))
        setup_type = str(row.get("setup_type", "Mixed"))
        upside_driver = str(row.get("upside_driver", "No driver listed")).strip() or "No driver listed"
        key_risk = str(row.get("key_risk", "No key risk listed")).strip() or "No key risk listed"
        composite_action = row.get("composite_action", row.get("long_action", "N/A"))
        subtitle = f"{asset_type} • {sector} • {setup_type}"

        with columns[index % 3]:
            with st.container(border=True):
                st.markdown(
                    (
                        f'<div class="scanner-symbol">{symbol}</div>'
                        f'<div class="scanner-symbol-subtitle">{subtitle}</div>'
                        '<div class="scanner-badge-row">'
                        f"{render_rating_badge(row.get('rating', 'N/A'))}"
                        f"{render_action_badge(composite_action)}"
                        f"{render_score_badge(row.get('final_score'))}"
                        "</div>"
                    ),
                    unsafe_allow_html=True,
                )
                signal_strength = row.get("final_score")
                strength_value = max(0, min(100, int(float(signal_strength)))) if pd.notna(signal_strength) else 0
                st.progress(strength_value, text=f"Signal Strength {format_number(signal_strength)}")
                stat_columns = st.columns(2)
                stat_columns[0].metric("Price", format_number(row.get("price")), delta_color="off")
                stat_columns[1].metric("Long", str(row.get("long_action", "N/A")), f"score {format_number(row.get('long_score'))}", delta_color="off")
                st.caption(f"Driver: {upside_driver}")
                st.caption(f"Risk: {key_risk}")
                if st.button("Open Detail", key=f"open_top_{symbol}", use_container_width=True):
                    open_symbol_detail(symbol)

    with st.container(border=True):
        st.caption("Top candidate table")
        display_table(top_df, OVERVIEW_TABLE_COLUMNS, height=340, highlight_top=True)


def render_watchlist_overview() -> None:
    watchlist = load_watchlist()
    with st.container(border=True):
        render_watchlist_panel(
            watchlist,
            panel_key="overview_watchlist",
            title="Watchlist",
            subtitle="Saved symbols ready for one-click return to the decision screen.",
            eyebrow="Saved Symbols",
            empty_message="No saved symbols yet. Add them from Symbol Detail.",
        )


def render_ranking_overview(filtered_full: pd.DataFrame) -> None:
    render_section_heading("Full Ranking", "Score-driven ranking with faster scanability on the most important columns.", eyebrow="Ranking")
    if filtered_full.empty:
        st.info("No rows match the current filters.")
        return

    ordered = sort_scan_df(filtered_full)
    leader = ordered.iloc[0]
    top_signal_count = int((ordered["rating"].astype(str) == "TOP").sum()) if "rating" in ordered.columns else 0
    actionable_count = int(ordered["rating"].astype(str).isin(["TOP", "ACTIONABLE"]).sum()) if "rating" in ordered.columns else 0
    average_score = ordered["final_score"].mean() if "final_score" in ordered.columns else float("nan")

    summary_columns = st.columns(3)
    with summary_columns[0]:
        _summary_card("Desk Leader", str(leader.get("symbol", "N/A")), f"{leader.get('sector', 'Unknown')} • {format_number(leader.get('final_score'))}", "positive")
    with summary_columns[1]:
        _summary_card("Actionable Names", f"{actionable_count:,}", f"{top_signal_count:,} rated TOP", "accent")
    with summary_columns[2]:
        _summary_card("Average Score", format_number(average_score), "Across the filtered universe", "neutral")

    visible_symbols = ordered["symbol"].dropna().astype(str).str.strip().tolist() if "symbol" in ordered.columns else []
    render_symbol_quick_actions(visible_symbols[:8], key_prefix="overview")

    if visible_symbols:
        selected_symbol = st.selectbox(
            "Inspect visible symbol",
            visible_symbols,
            index=selected_symbol_index(visible_symbols),
            key="overview_selected_symbol",
        )
        action_columns = st.columns([1, 4])
        if action_columns[0].button("Open Symbol Detail", use_container_width=True):
            open_symbol_detail(selected_symbol)
        action_columns[1].caption("Selection follows the currently filtered ranking table.")

    with st.container(border=True):
        display_table(filtered_full, OVERVIEW_TABLE_COLUMNS, height=620, highlight_top=True)


def render_overview_page(
    full_df: pd.DataFrame | None,
    top_df: pd.DataFrame | None,
    snapshot_files: list[Path],
    performance_summary_path: Path,
    forward_returns_path: Path,
) -> None:
    if full_df is None:
        st.info("Latest scan data is not available yet. Run the scanner to generate the latest ranking files.")
        return

    full_df = prepare_scan_df(full_df)
    top_df = prepare_scan_df(top_df) if top_df is not None else pd.DataFrame()

    with st.sidebar:
        render_section_heading("Overview Filters", "Trim the ranking to the exact market slice you want to inspect.", eyebrow="Filters")
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

    render_status_panel(full_df, snapshot_files, performance_summary_path, forward_returns_path)
    st.caption(f"Filtered rows in view: {len(filtered_full):,}")
    render_top_candidate_cards(filtered_top if not filtered_top.empty else top_df)
    render_watchlist_overview()
    render_ranking_overview(filtered_full)
