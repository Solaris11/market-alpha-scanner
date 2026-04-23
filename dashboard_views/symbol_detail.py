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


def _numeric_scalar(value: object) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(str(value))
    except (TypeError, ValueError):
        return None
    return numeric if not pd.isna(numeric) else None


def render_fundamentals_tab(current_row: pd.Series, summary_payload: Mapping[str, object] | None) -> None:
    fundamentals_raw = summary_payload.get("fundamentals", {}) if summary_payload else {}
    fundamentals = fundamentals_raw if isinstance(fundamentals_raw, Mapping) else {}
    rows = [
        {"field": "Market cap", "value": format_billions(fundamentals.get("market_cap", current_row.get("market_cap")))},
        {"field": "Trailing PE", "value": format_number(fundamentals.get("trailing_pe", current_row.get("trailing_pe")))},
        {"field": "Forward PE", "value": format_number(fundamentals.get("forward_pe", current_row.get("forward_pe")))},
        {"field": "Revenue growth", "value": format_percent(fundamentals.get("revenue_growth", current_row.get("revenue_growth")))},
        {"field": "Earnings growth", "value": format_percent(fundamentals.get("earnings_growth", current_row.get("earnings_growth")))},
        {"field": "Gross margin", "value": format_percent(fundamentals.get("gross_margin", current_row.get("gross_margin")))},
        {"field": "Operating margin", "value": format_percent(fundamentals.get("operating_margin", current_row.get("operating_margin")))},
        {"field": "Profit margin", "value": format_percent(fundamentals.get("profit_margin", current_row.get("profit_margin")))},
        {"field": "Debt to equity", "value": format_number(fundamentals.get("debt_to_equity", current_row.get("debt_to_equity")))},
        {"field": "Return on equity", "value": format_percent(fundamentals.get("return_on_equity", current_row.get("return_on_equity")))},
    ]
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    business_summary = str(fundamentals.get("long_business_summary", "")).strip()
    if business_summary:
        st.caption("Business summary")
        st.write(business_summary)


def render_news_tab(symbol: str) -> None:
    news_items = fetch_recent_news_items(symbol)
    if not news_items:
        st.info("No recent news available for this symbol.")
        return

    for item in news_items:
        title = item["title"]
        link = item["link"]
        if link:
            st.markdown(f"**[{title}]({link})**")
        else:
            st.markdown(f"**{title}**")
        meta_bits = [bit for bit in [item["source"], item["published"]] if bit and bit != "N/A"]
        if meta_bits:
            st.caption(" | ".join(meta_bits))
        if item["summary"]:
            st.write(item["summary"])
        st.divider()


def render_symbol_snapshot_timeline(symbol: str, snapshot_history_df: pd.DataFrame) -> None:
    if snapshot_history_df.empty:
        st.info("No historical data yet for this symbol")
        return

    symbol_history = snapshot_history_df[snapshot_history_df["symbol"] == symbol].copy()
    if symbol_history.empty:
        st.info("No historical data yet for this symbol")
        return

    symbol_history = symbol_history.sort_values("timestamp_utc")
    final_score_chart = symbol_history.set_index("timestamp_utc")[["final_score"]].dropna() if "final_score" in symbol_history.columns else pd.DataFrame()
    price_chart = symbol_history.set_index("timestamp_utc")[["price"]].dropna() if "price" in symbol_history.columns else pd.DataFrame()

    chart_columns = st.columns(2)
    with chart_columns[0]:
        if not final_score_chart.empty:
            st.caption("Scanner final_score over time")
            st.line_chart(final_score_chart)
    with chart_columns[1]:
        if not price_chart.empty:
            st.caption("Scanner price snapshots over time")
            st.line_chart(price_chart)

    timeline_columns = [column for column in HISTORY_TIMELINE_COLUMNS if column in symbol_history.columns]
    timeline_df = symbol_history[timeline_columns].copy()
    if "timestamp_utc" in timeline_df.columns:
        timeline_df["timestamp_utc"] = timeline_df["timestamp_utc"].dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    st.dataframe(timeline_df, use_container_width=True, height=260)


def render_symbol_detail_content(selected_symbol: str, full_df: pd.DataFrame, snapshot_history_df: pd.DataFrame) -> None:
    # The detail view prefers scanner artifacts first and only falls back to live yfinance calls when those files are missing.
    symbol_rows = full_df[full_df["symbol"] == selected_symbol].copy()
    if symbol_rows.empty:
        st.info("Selected symbol is not available in the latest scan.")
        return

    current_row = symbol_rows.iloc[0]
    summary_payload = load_symbol_summary(selected_symbol)

    summary_columns = st.columns(4)
    summary_columns[0].metric("Symbol", str(current_row.get("symbol", "N/A")))
    summary_columns[1].metric("Asset type", str(current_row.get("asset_type", "N/A")))
    summary_columns[2].metric("Price", format_number(current_row.get("price")))
    summary_columns[3].metric("Composite action", str(current_row.get("composite_action", "N/A")))

    action_columns = st.columns(3)
    for index, horizon in enumerate(["short", "mid", "long"]):
        action_columns[index].metric(
            f"{horizon.title()}-term",
            str(current_row.get(f"{horizon}_action", "N/A")),
            f"score {format_number(current_row.get(f'{horizon}_score'))}",
            delta_color="off",
        )

    selection_reason = str(current_row.get("selection_reason", "")).strip()
    if selection_reason:
        st.caption(selection_reason)

    tabs = st.tabs(["Summary", "Price History", "Fundamentals", "News", "Why Selected", "Scan History"])

    with tabs[0]:
        display_key_value_table(
            {
                "symbol": current_row.get("symbol"),
                "rating": current_row.get("rating"),
                "setup_type": current_row.get("setup_type"),
                "sector": current_row.get("sector"),
                "asset_type": current_row.get("asset_type"),
                "upside_driver": current_row.get("upside_driver"),
                "key_risk": current_row.get("key_risk"),
            },
            "Summary",
        )

        grouped_scores = [
            ("Technical", "technical_score", score_level),
            ("Fundamental", "fundamental_score", score_level),
            ("Macro", "macro_score", score_level),
            ("News", "news_score", score_level),
            ("Risk", "risk_penalty", risk_level),
        ]
        score_metrics = st.columns(len(grouped_scores))
        for index, (label, column, level_fn) in enumerate(grouped_scores):
            value = _numeric_scalar(current_row.get(column))
            score_metrics[index].metric(label, format_number(value), level_fn(value), delta_color="off")

        score_chart = pd.DataFrame(
            {
                "score_component": [label for label, _, _ in grouped_scores],
                "value": [_numeric_scalar(current_row.get(column)) for _, column, _ in grouped_scores],
            }
        ).dropna(subset=["value"]).set_index("score_component")
        if not score_chart.empty:
            st.bar_chart(score_chart)

        diagnostic_data = {column: current_row.get(column) for column in DIAGNOSTIC_COLUMNS if column in current_row.index}
        if diagnostic_data:
            display_key_value_table(diagnostic_data, "Diagnostics")

    with tabs[1]:
        history_df, history_source = load_symbol_price_history(selected_symbol)
        if history_df.empty:
            st.info("Historical price data not available for this symbol yet.")
        else:
            range_label = st.selectbox("Range", ["1M", "3M", "6M", "1Y", "2Y"], index=3, key=f"price_range_{selected_symbol}")
            filtered_history = filter_price_history(history_df, range_label)
            st.caption(f"Source: {history_source}")
            if not filtered_history.empty and "close" in filtered_history.columns:
                st.line_chart(filtered_history.set_index("date")[["close"]])
            st.dataframe(filtered_history, use_container_width=True, height=320)

    with tabs[2]:
        render_fundamentals_tab(current_row, summary_payload)

    with tabs[3]:
        render_news_tab(selected_symbol)

    with tabs[4]:
        reason_rows = []
        for horizon in ["short", "mid", "long"]:
            reason_rows.append(
                {
                    "horizon": horizon.title(),
                    "action": current_row.get(f"{horizon}_action"),
                    "score": format_number(current_row.get(f"{horizon}_score")),
                    "reason": current_row.get(f"{horizon}_reason"),
                }
            )
        st.dataframe(pd.DataFrame(reason_rows), use_container_width=True, hide_index=True)

    with tabs[5]:
        render_symbol_snapshot_timeline(selected_symbol, snapshot_history_df)

    with st.expander("Full latest row"):
        st.dataframe(symbol_rows, use_container_width=True, height=260)


def render_symbol_detail_page(full_df: pd.DataFrame | None, history_df: pd.DataFrame) -> None:
    st.header("Symbol Detail")
    if full_df is None or full_df.empty:
        st.info("Latest scan data is not available yet. Run the scanner to view symbol details.")
        return

    full_df = prepare_scan_df(full_df)
    symbols = sorted(full_df["symbol"].dropna().astype(str).unique().tolist()) if "symbol" in full_df.columns else []
    if not symbols:
        st.info("No symbols found in the latest ranking.")
        return

    selected_symbol = st.selectbox("Select symbol", symbols, index=selected_symbol_index(symbols), key="selected_symbol")
    if not isinstance(selected_symbol, str):
        st.info("Selected symbol is invalid.")
        return
    render_symbol_detail_content(selected_symbol, full_df, history_df)
