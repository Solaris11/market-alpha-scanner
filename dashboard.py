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
from dashboard_views.shared import inject_dashboard_theme, load_watchlist, normalize_symbol, render_watchlist_panel


PAGE_SELECTOR_WIDGET_KEY = "_page_selector_widget"


def _query_param_value(name: str) -> str:
    value = st.query_params.get(name)
    if isinstance(value, list):
        value = value[-1] if value else ""
    return str(value).strip() if value is not None else ""


def _apply_symbol_detail_request(requested_symbol: str, *, sync_sidebar_widget: bool) -> None:
    st.session_state["current_page"] = "Symbol Detail"
    st.session_state["page_selector"] = "Symbol Detail"
    if sync_sidebar_widget:
        st.session_state[PAGE_SELECTOR_WIDGET_KEY] = "Symbol Detail"
    if requested_symbol:
        st.session_state["selected_symbol"] = requested_symbol
        st.session_state["symbol_detail_selector"] = requested_symbol


def main() -> None:
    st.set_page_config(
        page_title="Market Alpha Scanner",
        page_icon="📈",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    inject_dashboard_theme()

    pages = [
        "Overview / Latest Scan",
        "Symbol Detail",
        "Performance Analysis",
        "Scan History",
    ]
    if "current_page" not in st.session_state:
        st.session_state["current_page"] = "Overview / Latest Scan"
    if st.session_state["current_page"] not in pages:
        st.session_state["current_page"] = "Overview / Latest Scan"

    query_page = _query_param_value("page")
    query_symbol = normalize_symbol(_query_param_value("symbol"))
    query_requests_symbol_detail = query_page == "symbol-detail"
    if query_requests_symbol_detail:
        _apply_symbol_detail_request(query_symbol, sync_sidebar_widget=True)

    if st.session_state.get("page_selector") not in pages:
        st.session_state["page_selector"] = st.session_state["current_page"]
    if st.session_state.get(PAGE_SELECTOR_WIDGET_KEY) not in pages:
        st.session_state[PAGE_SELECTOR_WIDGET_KEY] = st.session_state["current_page"]

    def handle_page_selector_change() -> None:
        selected = st.session_state.get(PAGE_SELECTOR_WIDGET_KEY)
        if selected not in pages:
            selected = "Overview / Latest Scan"
        st.session_state["current_page"] = selected
        st.session_state["page_selector"] = selected
        if selected != "Symbol Detail":
            st.query_params.clear()

    full_df, _ = safe_read_csv(FULL_RANKING_PATH)
    top_df, _ = safe_read_csv(TOP_CANDIDATES_PATH)
    summary_df, _ = safe_read_csv(PERFORMANCE_SUMMARY_PATH)
    forward_df, _ = safe_read_csv(FORWARD_RETURNS_PATH)
    snapshot_files = list_snapshot_files(HISTORY_DIR)
    history_df = load_history_df(snapshot_files)
    watchlist = load_watchlist()

    st.markdown(
        (
            '<div class="scanner-shell">'
            '<div class="scanner-hero">'
            '<div class="scanner-eyebrow">Market Alpha Scanner</div>'
            "<h1>Trading Desk Dashboard</h1>"
            "<p>Scan leaders, inspect signal quality, and move from shortlist to decision view without leaving the dashboard.</p>"
            "</div>"
            "</div>"
        ),
        unsafe_allow_html=True,
    )

    with st.sidebar:
        st.markdown(
            (
                '<div class="scanner-panel">'
                '<div class="scanner-eyebrow">Workspace</div>'
                '<div class="scanner-info-value">Navigator</div>'
                '<div class="scanner-info-meta">Scanner output, signal detail, performance, and snapshot history.</div>'
                "</div>"
            ),
            unsafe_allow_html=True,
        )
        selected_page = st.radio(
            "Section",
            pages,
            index=pages.index(st.session_state[PAGE_SELECTOR_WIDGET_KEY]),
            key=PAGE_SELECTOR_WIDGET_KEY,
            on_change=handle_page_selector_change,
        )
        st.session_state["current_page"] = selected_page
        st.session_state["page_selector"] = selected_page
        if query_requests_symbol_detail:
            _apply_symbol_detail_request(query_symbol, sync_sidebar_widget=False)
        render_watchlist_panel(
            watchlist,
            panel_key="sidebar_watchlist",
            title="Desk Watchlist",
            subtitle="Saved names you want to reopen quickly.",
            eyebrow="Saved Symbols",
            empty_message="Watchlist is empty. Add symbols from the detail screen.",
        )
        st.caption(f"Base path: `{BASE_DIR}`")
        st.caption(f"Output path: `{OUTPUT_DIR}`")

    if st.session_state["current_page"] == "Overview / Latest Scan":
        render_overview_page(full_df, top_df, snapshot_files, PERFORMANCE_SUMMARY_PATH, forward_returns_path=FORWARD_RETURNS_PATH)
    elif st.session_state["current_page"] == "Symbol Detail":
        render_symbol_detail_page(full_df, history_df)
    elif st.session_state["current_page"] == "Performance Analysis":
        render_performance_page(summary_df, forward_df)
    else:
        render_history_page(snapshot_files)


if __name__ == "__main__":
    main()
