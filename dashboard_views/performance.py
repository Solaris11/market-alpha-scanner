from __future__ import annotations

import pandas as pd
import streamlit as st

from .loaders import FORWARD_RETURNS_PATH, FULL_RANKING_PATH, HISTORY_DIR, PERFORMANCE_SUMMARY_PATH, list_snapshot_files
from .shared import format_percent, format_performance_display, render_info_card, render_section_heading


ANALYSIS_COMMAND = "/opt/apps/market-alpha-scanner/venv/bin/python investment_scanner_mvp.py --run-analysis"


def _status_text(path_exists: bool) -> str:
    return "Available" if path_exists else "Missing"


def render_performance_guidance() -> None:
    render_section_heading("Performance Data Status", "Performance metrics are generated from saved scan history.", eyebrow="Analysis")
    snapshot_count = len(list_snapshot_files(HISTORY_DIR))
    status_columns = st.columns(3)
    with status_columns[0]:
        st.markdown(
            render_info_card("Latest Scan", _status_text(FULL_RANKING_PATH.exists()), "scanner_output/full_ranking.csv", "positive" if FULL_RANKING_PATH.exists() else "warning"),
            unsafe_allow_html=True,
        )
    with status_columns[1]:
        st.markdown(
            render_info_card("Forward Returns", _status_text(FORWARD_RETURNS_PATH.exists()), "scanner_output/analysis/forward_returns.csv", "positive" if FORWARD_RETURNS_PATH.exists() else "warning"),
            unsafe_allow_html=True,
        )
    with status_columns[2]:
        st.markdown(
            render_info_card(
                "Performance Summary",
                _status_text(PERFORMANCE_SUMMARY_PATH.exists()),
                f"{snapshot_count:,} saved snapshot{'s' if snapshot_count != 1 else ''}",
                "positive" if PERFORMANCE_SUMMARY_PATH.exists() else "warning",
            ),
            unsafe_allow_html=True,
        )

    st.info("Performance analysis is not ready until forward-return observations can be computed from saved history.")
    st.caption("Generate or refresh analysis files with:")
    st.code(ANALYSIS_COMMAND, language="bash")


def _float_value(row: pd.Series, column: str) -> float:
    value = row.get(column)
    if value is None:
        return float("nan")
    try:
        numeric = float(str(value))
    except (TypeError, ValueError):
        return float("nan")
    return numeric if not pd.isna(numeric) else float("nan")


def get_highlight_row(summary_df: pd.DataFrame, group_type: str, horizon: str = "20d", best: bool = True) -> pd.Series | None:
    section = summary_df[(summary_df["group_type"] == group_type) & (summary_df["horizon"].astype(str) == horizon)].copy()
    if section.empty:
        return None
    section["avg_return"] = pd.to_numeric(section["avg_return"], errors="coerce")
    section = section.dropna(subset=["avg_return"])
    if section.empty:
        return None
    ordered = section.sort_values("avg_return", ascending=not best)
    return ordered.iloc[0]


def get_horizon_section(summary_df: pd.DataFrame, group_type: str, horizon: str = "20d") -> pd.DataFrame:
    section = summary_df[(summary_df["group_type"] == group_type) & (summary_df["horizon"].astype(str) == horizon)].copy()
    if section.empty:
        return section
    numeric_columns = ["avg_return", "median_return", "hit_rate", "avg_negative_return", "min_return", "count"]
    for column in numeric_columns:
        if column in section.columns:
            section[column] = pd.to_numeric(section[column], errors="coerce")
    return section


def sort_group_values(df: pd.DataFrame, group_type: str) -> pd.DataFrame:
    ordered = df.copy()
    if ordered.empty or "group_value" not in ordered.columns:
        return ordered
    if group_type == "score_bucket":
        bucket_order = {"<50": 0, "50-59": 1, "60-69": 2, "70-79": 3, "80+": 4}
        ordered["_sort_key"] = ordered["group_value"].map(bucket_order).fillna(999)
        ordered = ordered.sort_values(["_sort_key", "group_value"]).drop(columns="_sort_key")
    else:
        ordered = ordered.sort_values("avg_return", ascending=False, na_position="last")
    return ordered.reset_index(drop=True)


def format_edge_text(label: str, row: pd.Series | None) -> str:
    if row is None:
        return f"{label}: not enough 20d data yet"
    return (
        f"{label}: {row['group_value']} -> {format_percent(row['avg_return'])} avg return, "
        f"{format_percent(row['hit_rate'])} hit rate"
    )


def render_edge_summary(summary_df: pd.DataFrame) -> None:
    st.subheader("Edge Summary")
    highlights = [
        format_edge_text("Best rating (20d)", get_highlight_row(summary_df, "rating", best=True)),
        format_edge_text("Worst rating (20d)", get_highlight_row(summary_df, "rating", best=False)),
        format_edge_text("Best setup_type (20d)", get_highlight_row(summary_df, "setup_type", best=True)),
        format_edge_text("Best score_bucket (20d)", get_highlight_row(summary_df, "score_bucket", best=True)),
        format_edge_text("Best asset_type (20d)", get_highlight_row(summary_df, "asset_type", best=True)),
    ]
    for item in highlights:
        st.markdown(f"- {item}")


def render_metric_table(
    summary_df: pd.DataFrame,
    group_type: str,
    title: str,
    value_column: str,
    chart_label: str,
    sort_ascending: bool = False,
) -> None:
    section = get_horizon_section(summary_df, group_type)
    st.subheader(title)
    if section.empty:
        st.info("Not enough 20d performance data yet.")
        return

    if group_type == "score_bucket":
        section = sort_group_values(section, group_type)
    else:
        section = section.sort_values(value_column, ascending=sort_ascending, na_position="last").reset_index(drop=True)

    chart_df = section[["group_value", value_column]].dropna().set_index("group_value")
    if not chart_df.empty:
        chart_df = chart_df.rename(columns={value_column: chart_label})
        st.bar_chart(chart_df)

    display_columns = ["group_value", "avg_return", "hit_rate", "avg_negative_return", "min_return", "count"]
    display_df = format_performance_display(section[[column for column in display_columns if column in section.columns]])
    st.dataframe(display_df, use_container_width=True, height=min(340, 35 + (len(display_df) * 35)))


def generate_rule_based_insights(summary_df: pd.DataFrame) -> list[str]:
    insights: list[str] = []
    rating_20d = get_horizon_section(summary_df, "rating")
    setup_20d = get_horizon_section(summary_df, "setup_type")
    score_20d = get_horizon_section(summary_df, "score_bucket")

    if not rating_20d.empty:
        best_rating = rating_20d.sort_values("avg_return", ascending=False).iloc[0]
        worst_rating = rating_20d.sort_values("avg_return", ascending=True).iloc[0]
        avg_spread = _float_value(best_rating, "avg_return") - _float_value(worst_rating, "avg_return")
        insights.append(
            f"{best_rating['group_value']} signals outperform {worst_rating['group_value']} by {format_percent(avg_spread)} on 20d average return."
        )

        rating_lookup = rating_20d.set_index("group_value")
        if {"TOP", "ACTIONABLE"}.issubset(rating_lookup.index):
            top_avg = pd.to_numeric(rating_lookup.loc["TOP", "avg_return"], errors="coerce")
            actionable_avg = pd.to_numeric(rating_lookup.loc["ACTIONABLE", "avg_return"], errors="coerce")
            diff = float(top_avg) - float(actionable_avg)
            direction = "outperform" if diff >= 0 else "trail"
            insights.append(f"TOP signals {direction} ACTIONABLE by {format_percent(abs(diff))} on 20d average return.")

        best_hit = rating_20d.sort_values("hit_rate", ascending=False).iloc[0]
        insights.append(
            f"{best_hit['group_value']} is the most reliable rating on 20d hit rate at {format_percent(best_hit['hit_rate'])}."
        )

        worst_negative = rating_20d.sort_values("avg_negative_return", ascending=True, na_position="last").iloc[0]
        insights.append(
            f"{worst_negative['group_value']} has the harshest average losing trade at {format_percent(worst_negative['avg_negative_return'])}."
        )

    if not setup_20d.empty:
        best_setup = setup_20d.sort_values("avg_return", ascending=False).iloc[0]
        worst_setup = setup_20d.sort_values("avg_return", ascending=True).iloc[0]
        setup_spread = _float_value(best_setup, "avg_return") - _float_value(worst_setup, "avg_return")
        insights.append(
            f"{best_setup['group_value']} is the strongest setup, beating {worst_setup['group_value']} by "
            f"{format_percent(setup_spread)} on 20d average return."
        )

    if not score_20d.empty:
        score_lookup = score_20d.set_index("group_value")
        baseline_bucket = None
        for candidate in ["70-79", "60-69", "50-59"]:
            if candidate in score_lookup.index:
                baseline_bucket = candidate
                break
        if "80+" in score_lookup.index and baseline_bucket is not None:
            high_bucket = pd.to_numeric(score_lookup.loc["80+", "avg_return"], errors="coerce")
            baseline_avg = pd.to_numeric(score_lookup.loc[baseline_bucket, "avg_return"], errors="coerce")
            diff = float(high_bucket) - float(baseline_avg)
            if abs(diff) < 0.003:
                insights.append(
                    f"High score (80+) does not improve returns materially versus {baseline_bucket} on 20d performance."
                )
            elif diff > 0:
                insights.append(
                    f"High score (80+) outperforms {baseline_bucket} by {format_percent(diff)} on 20d average return."
                )
            else:
                insights.append(
                    f"High score (80+) underperforms {baseline_bucket} by {format_percent(abs(diff))} on 20d average return."
                )

    deduped: list[str] = []
    for insight in insights:
        if insight not in deduped:
            deduped.append(insight)
    return deduped[:5]


def render_rule_based_insights(summary_df: pd.DataFrame) -> None:
    st.subheader("Edge Insights")
    insights = generate_rule_based_insights(summary_df)
    if not insights:
        st.info("Not enough performance summary data yet to generate rule-based insights.")
        return
    for insight in insights:
        st.markdown(f"- {insight}")


def render_performance_group(summary_df: pd.DataFrame, group_type: str, title: str) -> None:
    section = summary_df[summary_df["group_type"] == group_type].copy()
    st.subheader(title)
    if section.empty:
        st.info(f"No data available for `{group_type}` yet.")
        return

    available_horizons = sorted(section["horizon"].dropna().astype(str).unique().tolist())
    horizon = st.selectbox(f"{title} horizon", available_horizons, key=f"horizon_{group_type}")
    horizon_df = section[section["horizon"] == horizon].copy().sort_values("avg_return", ascending=False)

    chart_df = horizon_df[["group_value", "avg_return"]].dropna().set_index("group_value")
    if not chart_df.empty:
        st.bar_chart(chart_df)

    display_columns = [
        "group_value",
        "avg_return",
        "median_return",
        "hit_rate",
        "avg_negative_return",
        "min_return",
        "count",
    ]
    display_df = format_performance_display(horizon_df[[column for column in display_columns if column in horizon_df.columns]])
    st.dataframe(display_df, use_container_width=True, height=min(360, 35 + (len(display_df) * 35)))


def render_performance_page(summary_df: pd.DataFrame | None, forward_df: pd.DataFrame | None) -> None:
    st.header("Performance Analysis")
    if summary_df is None or summary_df.empty:
        render_performance_guidance()
        return

    summary_df = summary_df.copy()
    if forward_df is None or forward_df.empty:
        render_performance_guidance()

    render_edge_summary(summary_df)
    render_rule_based_insights(summary_df)

    st.markdown("**Signal Strength Analysis**")
    render_metric_table(
        summary_df,
        "score_bucket",
        "Average Return vs Final Score Bucket (20d)",
        "avg_return",
        "avg_return",
        sort_ascending=False,
    )

    st.markdown("**Consistency Analysis**")
    consistency_columns = st.columns(2)
    with consistency_columns[0]:
        render_metric_table(summary_df, "rating", "Hit Rate vs Rating (20d)", "hit_rate", "hit_rate", sort_ascending=False)
    with consistency_columns[1]:
        render_metric_table(summary_df, "setup_type", "Hit Rate vs Setup Type (20d)", "hit_rate", "hit_rate", sort_ascending=False)

    st.markdown("**Risk Profile**")
    risk_columns = st.columns(2)
    with risk_columns[0]:
        render_metric_table(
            summary_df,
            "rating",
            "Average Negative Return by Rating (20d)",
            "avg_negative_return",
            "avg_negative_return",
            sort_ascending=True,
        )
    with risk_columns[1]:
        render_metric_table(summary_df, "rating", "Worst Drawdowns by Rating (20d)", "min_return", "min_return", sort_ascending=True)

    st.markdown("**Detailed Group Performance**")
    render_performance_group(summary_df, "rating", "Performance by Rating")
    render_performance_group(summary_df, "setup_type", "Performance by Setup Type")
    render_performance_group(summary_df, "asset_type", "Performance by Asset Type")
    render_performance_group(summary_df, "score_bucket", "Performance by Score Bucket")

    st.subheader("Forward Return Rows")
    if forward_df is None or forward_df.empty:
        st.info("Forward return data not available yet. This will populate after enough historical scans.")
        return
    st.dataframe(forward_df, use_container_width=True, height=320)
