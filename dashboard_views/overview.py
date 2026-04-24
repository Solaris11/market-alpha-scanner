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
        symbol = str(row.get("symbol", "N/A")).strip().upper()
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
                if st.button("Open Detail", key=f"overview_top_open_{index}_{symbol}", use_container_width=True):
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


def render_clickable_ranking_list(ordered: pd.DataFrame) -> None:
    if "overview_rank_page_selector" not in st.session_state:
        st.session_state["overview_rank_page_selector"] = 1
    if "overview_rank_page_size" not in st.session_state:
        st.session_state["overview_rank_page_size"] = 50
    if ordered.empty or "symbol" not in ordered.columns:
        return

    action_column = "composite_action" if "composite_action" in ordered.columns else "long_action"
    ranking_rows = ordered.reset_index(drop=True)
    total_rows = len(ranking_rows)

    with st.container(border=True):
        st.caption("Use the clickable symbol list below to open details. The raw dataframe is available in the collapsed CSV-style view.")

        control_columns = st.columns([1.1, 1.0, 3.2], gap="small")
        page_size_option = control_columns[0].selectbox(
            "Rows per page",
            ["25", "50", "100", "All"],
            index=1,
            key="overview_rank_page_size",
        )

        if page_size_option == "All":
            page_size = total_rows
            page_count = 1
            current_page = 1
            st.session_state["overview_rank_page_selector"] = 1
            control_columns[1].caption("Page 1 of 1")
        else:
            page_size = int(page_size_option)
            page_count = max(1, (total_rows + page_size - 1) // page_size)
            page_options = list(range(1, page_count + 1))
            saved_page = st.session_state.get("overview_rank_page_selector", 1)
            if saved_page not in page_options:
                st.session_state["overview_rank_page_selector"] = min(max(int(saved_page) if isinstance(saved_page, int) else 1, 1), page_count)
            current_page = control_columns[1].selectbox(
                "Page",
                page_options,
                index=page_options.index(st.session_state["overview_rank_page_selector"]),
                key="overview_rank_page_selector",
            )

        start_index = (current_page - 1) * page_size
        end_index = min(start_index + page_size, total_rows)
        visible_rows = ranking_rows.iloc[start_index:end_index]
        control_columns[2].caption(f"Showing {start_index + 1}-{end_index} of {total_rows}")

        header_columns = st.columns([0.9, 1.0, 1.35, 0.8, 0.9, 0.9, 1.2], gap="small")
        header_columns[0].markdown("**Symbol**")
        header_columns[1].markdown("**Asset Type**")
        header_columns[2].markdown("**Sector**")
        header_columns[3].markdown("**Price**")
        header_columns[4].markdown("**Final Score**")
        header_columns[5].markdown("**Rating**")
        header_columns[6].markdown("**Action**")

        for offset, (_, row) in enumerate(visible_rows.iterrows()):
            index = start_index + offset
            symbol = str(row.get("symbol", "")).strip().upper()
            if not symbol:
                continue
            row_columns = st.columns([0.9, 1.0, 1.35, 0.8, 0.9, 0.9, 1.2], gap="small")
            if row_columns[0].button(symbol, key=f"overview_rank_row_open_{index}_{symbol}", use_container_width=True):
                open_symbol_detail(symbol)
            row_columns[1].write(str(row.get("asset_type", "N/A")))
            row_columns[2].write(str(row.get("sector", "N/A")))
            row_columns[3].write(format_number(row.get("price")))
            row_columns[4].write(format_number(row.get("final_score")))
            row_columns[5].markdown(render_rating_badge(row.get("rating", "N/A")), unsafe_allow_html=True)
            row_columns[6].markdown(render_action_badge(row.get(action_column, "N/A")), unsafe_allow_html=True)


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

    render_clickable_ranking_list(ordered)

    with st.expander("Raw dataframe / CSV-style view", expanded=False):
        st.caption("Read-only scanner output for inspection.")
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
