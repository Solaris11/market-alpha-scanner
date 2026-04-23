from __future__ import annotations

from collections.abc import Mapping

import pandas as pd
import streamlit as st

from .loaders import fetch_recent_news_items, filter_price_history, load_symbol_price_history, load_symbol_summary, prepare_scan_df
from .shared import (
    HISTORY_TIMELINE_COLUMNS,
    display_key_value_table,
    format_billions,
    format_number,
    format_percent,
    render_action_badge,
    render_info_card,
    render_rating_badge,
    render_score_badge,
    render_section_heading,
    render_symbol_header,
    risk_level,
    score_level,
    selected_symbol_index,
)


DIAGNOSTIC_COLUMNS = [
    "current_rsi",
    "current_macd_hist",
    "atr_pct",
    "annualized_volatility",
    "max_drawdown",
]

FUNDAMENTAL_FIELDS = [
    ("Market Cap", "market_cap", format_billions),
    ("Trailing PE", "trailing_pe", format_number),
    ("Forward PE", "forward_pe", format_number),
    ("Revenue Growth", "revenue_growth", format_percent),
    ("Earnings Growth", "earnings_growth", format_percent),
    ("Gross Margin", "gross_margin", format_percent),
    ("Operating Margin", "operating_margin", format_percent),
    ("Profit Margin", "profit_margin", format_percent),
    ("Debt To Equity", "debt_to_equity", format_number),
    ("Return On Equity", "return_on_equity", format_percent),
]


def _numeric_scalar(value: object) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(str(value))
    except (TypeError, ValueError):
        return None
    return numeric if not pd.isna(numeric) else None


def _reason_points(text: object) -> list[str]:
    raw = str(text or "").strip()
    if not raw:
        return []
    return [item.strip() for item in raw.split(";") if item.strip()]


def render_symbol_detail_header(current_row: pd.Series) -> None:
    symbol = str(current_row.get("symbol", "N/A"))
    subtitle_bits = [
        str(current_row.get("asset_type", "Unknown")),
        str(current_row.get("sector", "Unknown")),
        str(current_row.get("setup_type", "Mixed Setup")),
    ]
    render_symbol_header(
        symbol,
        " • ".join(bit for bit in subtitle_bits if bit and bit != "nan"),
        [
            render_rating_badge(current_row.get("rating", "N/A")),
            render_action_badge(current_row.get("composite_action", current_row.get("long_action", "N/A"))),
            render_score_badge(current_row.get("final_score")),
        ],
    )

    summary_columns = st.columns(4)
    with summary_columns[0]:
        st.markdown(
            render_info_card(
                "Price",
                format_number(current_row.get("price")),
                f"Entry zone {current_row.get('entry_zone', 'N/A')}",
                "accent",
            ),
            unsafe_allow_html=True,
        )
    with summary_columns[1]:
        st.markdown(
            render_info_card(
                "Final Score",
                format_number(current_row.get("final_score")),
                f"Rating {current_row.get('rating', 'N/A')}",
                "positive",
            ),
            unsafe_allow_html=True,
        )
    with summary_columns[2]:
        st.markdown(
            render_info_card(
                "Upside Driver",
                str(current_row.get("upside_driver", "N/A")),
                f"Confidence {current_row.get('confidence_level', 'N/A')}",
                "neutral",
            ),
            unsafe_allow_html=True,
        )
    with summary_columns[3]:
        st.markdown(
            render_info_card(
                "Key Risk",
                str(current_row.get("key_risk", "N/A")),
                f"Invalidation {current_row.get('invalidation_level', 'N/A')}",
                "negative",
            ),
            unsafe_allow_html=True,
        )

    selection_reason = str(current_row.get("selection_reason", "")).strip()
    if selection_reason:
        st.caption(selection_reason)


def render_score_stack(current_row: pd.Series) -> None:
    render_section_heading("Signal Stack", "Core inputs behind the current ranking and trade posture.", eyebrow="Decision Screen")
    grouped_scores = [
        ("Technical", "technical_score", score_level),
        ("Fundamental", "fundamental_score", score_level),
        ("Macro", "macro_score", score_level),
        ("News", "news_score", score_level),
        ("Risk", "risk_penalty", risk_level),
    ]
    columns = st.columns(len(grouped_scores))
    for index, (label, column, level_fn) in enumerate(grouped_scores):
        value = _numeric_scalar(current_row.get(column))
        score_value = max(0, min(100, int(value))) if value is not None else 0
        with columns[index]:
            st.markdown(
                render_info_card(label, format_number(value), level_fn(value), "positive" if label != "Risk" else "warning"),
                unsafe_allow_html=True,
            )
            st.progress(score_value, text=f"{label} {format_number(value)}")


def render_action_cards(current_row: pd.Series) -> None:
    render_section_heading("Action Ladder", "Short, medium, and long horizon recommendations in one view.", eyebrow="Execution")
    action_columns = st.columns(4)
    horizons = [
        ("Short-Term", "short_action", "short_score"),
        ("Mid-Term", "mid_action", "mid_score"),
        ("Long-Term", "long_action", "long_score"),
        ("Composite", "composite_action", "final_score"),
    ]
    for column, (label, action_col, score_col) in zip(action_columns, horizons):
        with column:
            st.markdown(
                render_info_card(label, str(current_row.get(action_col, "N/A")), f"Score {format_number(current_row.get(score_col))}", "accent"),
                unsafe_allow_html=True,
            )
            st.markdown(render_action_badge(current_row.get(action_col, "N/A")), unsafe_allow_html=True)


def render_summary_tab(current_row: pd.Series) -> None:
    left, right = st.columns([1.15, 1], gap="large")

    with left:
        with st.container(border=True):
            render_section_heading("Decision Snapshot", "Headline context, positioning, and execution anchors.", eyebrow="Summary")
            display_key_value_table(
                {
                    "Rating": current_row.get("rating"),
                    "Setup Type": current_row.get("setup_type"),
                    "Asset Type": current_row.get("asset_type"),
                    "Sector": current_row.get("sector"),
                    "Entry Zone": current_row.get("entry_zone"),
                    "Invalidation Level": current_row.get("invalidation_level"),
                    "Upside Driver": current_row.get("upside_driver"),
                    "Key Risk": current_row.get("key_risk"),
                },
                "Signal Readout",
            )

        diagnostic_data = {column.replace("_", " ").title(): current_row.get(column) for column in DIAGNOSTIC_COLUMNS if column in current_row.index}
        if diagnostic_data:
            with st.container(border=True):
                render_section_heading("Diagnostics", "Short-form technical diagnostics for fast tape reading.", eyebrow="Monitoring")
                display_key_value_table(diagnostic_data, "Diagnostics")

    with right:
        with st.container(border=True):
            render_section_heading("Reason Stack", "Why the scanner surfaced this symbol across horizons.", eyebrow="Context")
            for horizon in ["short", "mid", "long"]:
                points = _reason_points(current_row.get(f"{horizon}_reason"))
                st.markdown(
                    (
                        '<div class="scanner-panel">'
                        f'<div class="scanner-info-label">{horizon.title()} Horizon</div>'
                        f'<div class="scanner-badge-row">{render_action_badge(current_row.get(f"{horizon}_action", "N/A"))}{render_score_badge(current_row.get(f"{horizon}_score"), label="")}</div>'
                        "</div>"
                    ),
                    unsafe_allow_html=True,
                )
                if points:
                    st.markdown(
                        "<ul class='scanner-reason-list'>"
                        + "".join(f"<li>{point}</li>" for point in points)
                        + "</ul>",
                        unsafe_allow_html=True,
                    )
                else:
                    st.caption("No detailed reason provided.")


def render_price_history_tab(selected_symbol: str) -> None:
    history_df, history_source = load_symbol_price_history(selected_symbol)
    if history_df.empty:
        st.info("Historical price data not available for this symbol yet.")
        return

    render_section_heading("Price Structure", "Recent market behavior for the selected symbol.", eyebrow="Market Data")
    range_label = st.selectbox("Range", ["1M", "3M", "6M", "1Y", "2Y"], index=3, key=f"price_range_{selected_symbol}")
    filtered_history = filter_price_history(history_df, range_label)

    top_columns = st.columns([1, 3])
    with top_columns[0]:
        st.markdown(render_info_card("Source", history_source.title(), f"Rows {len(filtered_history):,}", "neutral"), unsafe_allow_html=True)
    with top_columns[1]:
        st.caption("Auto-loaded from scanner artifacts first, then live market data when necessary.")

    if not filtered_history.empty and "close" in filtered_history.columns:
        with st.container(border=True):
            st.line_chart(filtered_history.set_index("date")[["close"]], use_container_width=True)
    st.dataframe(filtered_history, use_container_width=True, height=320, hide_index=True)


def render_fundamentals_tab(current_row: pd.Series, summary_payload: Mapping[str, object] | None) -> None:
    fundamentals_raw = summary_payload.get("fundamentals", {}) if summary_payload else {}
    fundamentals = fundamentals_raw if isinstance(fundamentals_raw, Mapping) else {}

    render_section_heading("Fundamentals", "Quality, growth, valuation, and balance-sheet snapshot.", eyebrow="Reference")
    rows = []
    for label, field, formatter in FUNDAMENTAL_FIELDS:
        value = fundamentals.get(field, current_row.get(field))
        rows.append({"field": label, "value": formatter(value)})

    left, right = st.columns([1, 1], gap="large")
    with left:
        st.dataframe(pd.DataFrame(rows[:5]), use_container_width=True, hide_index=True)
    with right:
        st.dataframe(pd.DataFrame(rows[5:]), use_container_width=True, hide_index=True)

    business_summary = str(fundamentals.get("long_business_summary", "")).strip()
    if business_summary:
        with st.container(border=True):
            render_section_heading("Business Summary", "Narrative context from the latest underlying company profile.", eyebrow="Narrative")
            st.write(business_summary)


def render_news_tab(symbol: str) -> None:
    news_items = fetch_recent_news_items(symbol)
    render_section_heading("Recent News", "Short-form event context around the selected name.", eyebrow="Catalysts")
    if not news_items:
        st.info("No recent news available for this symbol.")
        return

    for item in news_items:
        title = item["title"]
        link = item["link"]
        meta_bits = [bit for bit in [item["source"], item["published"]] if bit and bit != "N/A"]
        with st.container(border=True):
            if link:
                st.markdown(f"**[{title}]({link})**")
            else:
                st.markdown(f"**{title}**")
            if meta_bits:
                st.caption(" | ".join(meta_bits))
            if item["summary"]:
                st.write(item["summary"])


def render_symbol_snapshot_timeline(symbol: str, snapshot_history_df: pd.DataFrame) -> None:
    if snapshot_history_df.empty:
        st.info("No historical data yet for this symbol.")
        return

    symbol_history = snapshot_history_df[snapshot_history_df["symbol"] == symbol].copy()
    if symbol_history.empty:
        st.info("No historical data yet for this symbol.")
        return

    symbol_history = symbol_history.sort_values("timestamp_utc")
    final_score_chart = symbol_history.set_index("timestamp_utc")[["final_score"]].dropna() if "final_score" in symbol_history.columns else pd.DataFrame()
    price_chart = symbol_history.set_index("timestamp_utc")[["price"]].dropna() if "price" in symbol_history.columns else pd.DataFrame()

    render_section_heading("Scan History", "How price and scanner conviction evolved across saved snapshots.", eyebrow="History")
    chart_columns = st.columns(2, gap="large")
    with chart_columns[0]:
        with st.container(border=True):
            st.caption("Final score over time")
            if not final_score_chart.empty:
                st.line_chart(final_score_chart, use_container_width=True)
            else:
                st.info("No score history available.")
    with chart_columns[1]:
        with st.container(border=True):
            st.caption("Scanner snapshot price")
            if not price_chart.empty:
                st.line_chart(price_chart, use_container_width=True)
            else:
                st.info("No price history available.")

    timeline_columns = [column for column in HISTORY_TIMELINE_COLUMNS if column in symbol_history.columns]
    timeline_df = symbol_history[timeline_columns].copy()
    if "timestamp_utc" in timeline_df.columns:
        timeline_df["timestamp_utc"] = timeline_df["timestamp_utc"].dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    st.dataframe(timeline_df, use_container_width=True, height=260, hide_index=True)


def render_reason_tab(current_row: pd.Series) -> None:
    render_section_heading("Reason Breakdown", "Readable horizon-based rationale instead of a flat text block.", eyebrow="Why It Ranked")
    for horizon in ["short", "mid", "long"]:
        points = _reason_points(current_row.get(f"{horizon}_reason"))
        with st.container(border=True):
            st.markdown(
                (
                    f"<div class='scanner-info-label'>{horizon.title()} Horizon</div>"
                    f"<div class='scanner-badge-row'>{render_action_badge(current_row.get(f'{horizon}_action', 'N/A'))}{render_score_badge(current_row.get(f'{horizon}_score'), label='')}</div>"
                ),
                unsafe_allow_html=True,
            )
            if points:
                st.markdown(
                    "<ul class='scanner-reason-list'>"
                    + "".join(f"<li>{point}</li>" for point in points)
                    + "</ul>",
                    unsafe_allow_html=True,
                )
            else:
                st.caption("No detailed reason provided.")


def render_symbol_detail_content(selected_symbol: str, full_df: pd.DataFrame, snapshot_history_df: pd.DataFrame) -> None:
    symbol_rows = full_df[full_df["symbol"] == selected_symbol].copy()
    if symbol_rows.empty:
        st.info("Selected symbol is not available in the latest scan.")
        return

    current_row = symbol_rows.iloc[0]
    summary_payload = load_symbol_summary(selected_symbol)

    render_symbol_detail_header(current_row)
    render_score_stack(current_row)
    render_action_cards(current_row)

    tabs = st.tabs(["Decision Screen", "Price History", "Fundamentals", "News", "Why Selected", "Scan History", "Full Row"])

    with tabs[0]:
        render_summary_tab(current_row)
    with tabs[1]:
        render_price_history_tab(selected_symbol)
    with tabs[2]:
        render_fundamentals_tab(current_row, summary_payload)
    with tabs[3]:
        render_news_tab(selected_symbol)
    with tabs[4]:
        render_reason_tab(current_row)
    with tabs[5]:
        render_symbol_snapshot_timeline(selected_symbol, snapshot_history_df)
    with tabs[6]:
        st.dataframe(symbol_rows, use_container_width=True, height=280, hide_index=True)


def render_symbol_detail_page(full_df: pd.DataFrame | None, history_df: pd.DataFrame) -> None:
    if full_df is None or full_df.empty:
        st.info("Latest scan data is not available yet. Run the scanner to view symbol details.")
        return

    full_df = prepare_scan_df(full_df)
    symbols = sorted(full_df["symbol"].dropna().astype(str).unique().tolist()) if "symbol" in full_df.columns else []
    if not symbols:
        st.info("No symbols found in the latest ranking.")
        return

    render_section_heading("Symbol Detail", "Decision screen for a single scanner name.", eyebrow="Detail")
    selected_symbol = st.selectbox("Select symbol", symbols, index=selected_symbol_index(symbols), key="selected_symbol")
    if not isinstance(selected_symbol, str):
        st.info("Selected symbol is invalid.")
        return
    render_symbol_detail_content(selected_symbol, full_df, history_df)
