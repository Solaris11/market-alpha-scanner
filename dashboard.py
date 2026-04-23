from __future__ import annotations

import streamlit as st

from dashboard_views import (
    render_history_page,
    render_overview_page,
    render_performance_page,
    render_symbol_detail_page,
)
from dashboard_views.loaders import (
    BASE_DIR,
    FORWARD_RETURNS_PATH,
    FULL_RANKING_PATH,
    HISTORY_DIR,
    OUTPUT_DIR,
    PERFORMANCE_SUMMARY_PATH,
    TOP_CANDIDATES_PATH,
    list_snapshot_files,
    load_history_df,
    safe_read_csv,
)


def main() -> None:
    st.set_page_config(page_title="Market Scanner Dashboard", layout="wide")
    st.title("Market Scanner Dashboard")
    st.caption("Internal Streamlit dashboard for scanner outputs stored on disk.")

    full_df, _ = safe_read_csv(FULL_RANKING_PATH)
    top_df, _ = safe_read_csv(TOP_CANDIDATES_PATH)
    summary_df, _ = safe_read_csv(PERFORMANCE_SUMMARY_PATH)
    forward_df, _ = safe_read_csv(FORWARD_RETURNS_PATH)
    snapshot_files = list_snapshot_files(HISTORY_DIR)
    history_df = load_history_df(snapshot_files)

    with st.sidebar:
        st.title("Navigation")
        page = st.radio(
            "Section",
            [
                "Overview / Latest Scan",
                "Symbol Detail",
                "Performance Analysis",
                "Scan History",
            ],
            key="page",
        )
        st.caption(f"Base path: `{BASE_DIR}`")
        st.caption(f"Output path: `{OUTPUT_DIR}`")

    if page == "Overview / Latest Scan":
        render_overview_page(full_df, top_df, snapshot_files, PERFORMANCE_SUMMARY_PATH, FORWARD_RETURNS_PATH)
    elif page == "Symbol Detail":
        render_symbol_detail_page(full_df, history_df)
    elif page == "Performance Analysis":
        render_performance_page(summary_df, forward_df)
    else:
        render_history_page(snapshot_files)


if __name__ == "__main__":
    main()
