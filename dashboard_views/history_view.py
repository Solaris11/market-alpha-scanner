from __future__ import annotations

from pathlib import Path

import pandas as pd
import streamlit as st

from .loaders import compare_snapshots, parse_snapshot_timestamp, prepare_scan_df, safe_read_csv, snapshot_options
from .shared import DEFAULT_TABLE_COLUMNS, display_table, format_timestamp, render_info_card, render_section_heading


SCAN_COMMAND = "/opt/apps/market-alpha-scanner/venv/bin/python investment_scanner_mvp.py --save-history"


def render_scan_history_guidance() -> None:
    render_section_heading("Create Scan History", "Saved snapshots power history comparison and performance analysis.", eyebrow="History")
    st.info("No historical snapshots are available yet. Run the scanner with history saving enabled, then refresh the dashboard.")
    status_columns = st.columns(2)
    with status_columns[0]:
        st.markdown(render_info_card("Run Command", "Manual", "Use a shell so logs and long runtimes are visible.", "accent"), unsafe_allow_html=True)
    with status_columns[1]:
        st.markdown(render_info_card("Expected Output", "scanner_output/history", "Files should appear as scan_YYYYMMDD_HHMMSS.csv.", "neutral"), unsafe_allow_html=True)
    st.code(SCAN_COMMAND, language="bash")


def render_history_page(snapshot_files: list[Path]) -> None:
    st.header("Scan History")
    if not snapshot_files:
        render_scan_history_guidance()
        return

    snapshot_rows = []
    for path in snapshot_files:
        snapshot_rows.append({"file": path.name, "timestamp_utc": format_timestamp(parse_snapshot_timestamp(path))})
    st.subheader("Available Snapshots")
    st.dataframe(pd.DataFrame(snapshot_rows), use_container_width=True, height=min(320, 35 + (len(snapshot_rows) * 35)))

    options = snapshot_options(snapshot_files)
    selected_label = st.selectbox("Select snapshot", list(options.keys()))
    selected_path = options[selected_label]
    selected_df, error = safe_read_csv(selected_path)

    st.subheader(f"Snapshot: {selected_path.name}")
    if error or selected_df is None:
        st.info("Selected snapshot could not be loaded.")
        return

    selected_df = prepare_scan_df(selected_df)
    display_table(selected_df, DEFAULT_TABLE_COLUMNS, height=520)

    if st.checkbox("Compare two snapshots"):
        comparison_candidates = [label for label in options if label != selected_label]
        if not comparison_candidates:
            st.info("A second snapshot is required for comparison.")
            return

        comparison_label = st.selectbox("Compare against", comparison_candidates)
        comparison_df, comparison_error = safe_read_csv(options[comparison_label])
        if comparison_error or comparison_df is None:
            st.info("Comparison snapshot could not be loaded.")
            return

        comparison_view = compare_snapshots(comparison_df, selected_df)
        if comparison_view.empty:
            st.info("No comparable symbol data found between the two snapshots.")
            return

        st.subheader("Snapshot Comparison")
        st.dataframe(comparison_view, use_container_width=True, height=420)
