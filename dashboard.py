from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import pandas as pd
import streamlit as st


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "scanner_output"
FULL_RANKING_PATH = OUTPUT_DIR / "full_ranking.csv"
TOP_CANDIDATES_PATH = OUTPUT_DIR / "top_candidates.csv"
HISTORY_DIR = OUTPUT_DIR / "history"
ANALYSIS_DIR = OUTPUT_DIR / "analysis"
PERFORMANCE_SUMMARY_PATH = ANALYSIS_DIR / "performance_summary.csv"
FORWARD_RETURNS_PATH = ANALYSIS_DIR / "forward_returns.csv"

DEFAULT_TABLE_COLUMNS = [
    "symbol",
    "asset_type",
    "sector",
    "price",
    "technical_score",
    "fundamental_score",
    "news_score",
    "macro_score",
    "risk_penalty",
    "final_score",
    "rating",
    "setup_type",
]
STRING_COLUMNS = [
    "symbol",
    "asset_type",
    "sector",
    "rating",
    "setup_type",
    "industry",
    "valuation_flag",
    "profitability_status",
    "macro_sensitivity",
    "upside_driver",
    "key_risk",
]
NUMERIC_SCAN_COLUMNS = [
    "price",
    "market_cap",
    "avg_dollar_volume",
    "technical_score",
    "fundamental_score",
    "news_score",
    "macro_score",
    "risk_penalty",
    "final_score",
    "trend_score",
    "supertrend_score",
    "momentum_score",
    "breakout_score",
    "relative_volume_score",
    "avwap_score",
    "quality_score",
    "growth_score",
    "valuation_score",
    "dividend_yield",
    "current_rsi",
    "current_macd_hist",
    "atr_pct",
    "annualized_volatility",
    "max_drawdown",
]
SUMMARY_COUNT_COLUMNS = ["rating", "asset_type"]
SCORE_COLUMNS = [
    "technical_score",
    "fundamental_score",
    "news_score",
    "macro_score",
    "risk_penalty",
    "final_score",
]
TAG_COLUMNS = [
    "setup_type",
    "rating",
    "sector",
    "asset_type",
    "valuation_flag",
    "profitability_status",
    "macro_sensitivity",
    "upside_driver",
    "key_risk",
]
DIAGNOSTIC_COLUMNS = [
    "current_rsi",
    "current_macd_hist",
    "atr_pct",
    "annualized_volatility",
    "max_drawdown",
]
PERFORMANCE_METRIC_COLUMNS = [
    "avg_return",
    "median_return",
    "hit_rate",
    "avg_negative_return",
    "min_return",
]
PERCENT_COLUMNS = {"avg_return", "median_return", "hit_rate", "avg_negative_return", "min_return"}
HISTORY_TIMELINE_COLUMNS = ["timestamp_utc", "price", "final_score", "rating"]
RATING_STATUS_ORDER = ["TOP", "ACTIONABLE", "WATCH", "PASS"]


def safe_read_csv(path: Path) -> tuple[pd.DataFrame | None, str | None]:
    if not path.exists():
        return None, f"Missing file: `{path.relative_to(BASE_DIR)}`"

    try:
        df = pd.read_csv(path)
        df.columns = [str(column).strip() for column in df.columns]
        return df, None
    except Exception as exc:
        return None, f"Failed to read `{path.relative_to(BASE_DIR)}`: {exc}"


def coerce_numeric(df: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    for column in columns:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")
    return df


def prepare_scan_df(df: pd.DataFrame) -> pd.DataFrame:
    prepared = df.copy()
    prepared.columns = [str(column).strip() for column in prepared.columns]

    for column in STRING_COLUMNS:
        if column in prepared.columns:
            prepared[column] = prepared[column].where(prepared[column].notna(), pd.NA)
            prepared[column] = prepared[column].astype("string").str.strip()
            prepared[column] = prepared[column].replace("", pd.NA)

    if "symbol" in prepared.columns:
        prepared["symbol"] = prepared["symbol"].str.upper()

    prepared = coerce_numeric(prepared, NUMERIC_SCAN_COLUMNS)
    return prepared


def list_snapshot_files(history_dir: Path) -> list[Path]:
    if not history_dir.exists():
        return []
    return sorted(history_dir.glob("scan_*.csv"), reverse=True)


def parse_snapshot_timestamp(snapshot_path: Path) -> pd.Timestamp | None:
    stem = snapshot_path.stem.replace("scan_", "")
    try:
        return pd.Timestamp(datetime.strptime(stem, "%Y%m%d_%H%M%S"), tz="UTC")
    except ValueError:
        return None


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


def infer_file_timestamp(paths: Iterable[Path]) -> str | None:
    existing_paths = [path for path in paths if path.exists()]
    if not existing_paths:
        return None

    latest_path = max(existing_paths, key=lambda path: path.stat().st_mtime)
    latest_dt = datetime.fromtimestamp(latest_path.stat().st_mtime, tz=timezone.utc)
    return latest_dt.strftime("%Y-%m-%d %H:%M:%S UTC")


def infer_latest_scan_timestamp(full_df: pd.DataFrame | None, snapshot_files: list[Path]) -> str:
    if full_df is not None and "timestamp_utc" in full_df.columns:
        ts_series = pd.to_datetime(full_df["timestamp_utc"], utc=True, errors="coerce").dropna()
        if not ts_series.empty:
            return format_timestamp(ts_series.max())

    if snapshot_files:
        parsed = parse_snapshot_timestamp(snapshot_files[0])
        if parsed is not None:
            return format_timestamp(parsed)

    if FULL_RANKING_PATH.exists():
        modified_at = datetime.fromtimestamp(FULL_RANKING_PATH.stat().st_mtime, tz=timezone.utc)
        return modified_at.strftime("%Y-%m-%d %H:%M:%S UTC")

    return "N/A"


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


def sort_scan_df(df: pd.DataFrame) -> pd.DataFrame:
    sorted_df = df.copy()
    if "final_score" in sorted_df.columns:
        sorted_df = sorted_df.sort_values("final_score", ascending=False, na_position="last")
    return sorted_df.reset_index(drop=True)


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

    format_map = {
        column: "{:.2f}"
        for column in display_df.columns
        if pd.api.types.is_numeric_dtype(display_df[column])
    }
    styler = display_df.style.format(format_map)
    if highlight_top and "rating" in display_df.columns:
        styler = styler.apply(highlight_top_rows, axis=1)

    st.dataframe(styler, use_container_width=True, height=height)


def display_count_table(df: pd.DataFrame, column: str, title: str) -> None:
    if column not in df.columns:
        return

    counts = (
        df[column]
        .fillna("Unknown")
        .astype(str)
        .value_counts(dropna=False)
        .rename_axis(column)
        .reset_index(name="count")
    )
    st.caption(title)
    st.dataframe(counts, use_container_width=True, height=min(260, 35 + (len(counts) * 35)))


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


def render_status_panel(full_df: pd.DataFrame, snapshot_files: list[Path]) -> None:
    st.subheader("Status")

    last_analysis_timestamp = infer_file_timestamp([PERFORMANCE_SUMMARY_PATH, FORWARD_RETURNS_PATH])
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
    rating_metric_columns = st.columns(len(RATING_STATUS_ORDER))
    for index, rating in enumerate(RATING_STATUS_ORDER):
        rating_metric_columns[index].metric(rating, int(rating_status_counts.get(rating, 0)))

    st.caption("Count by asset_type")
    if asset_type_counts.empty:
        st.info("No asset type data available in the latest scan.")
    else:
        st.dataframe(asset_type_counts, use_container_width=True, height=min(260, 35 + (len(asset_type_counts) * 35)))


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


def render_performance_highlights(summary_df: pd.DataFrame) -> None:
    st.subheader("Performance Highlights")
    highlights = [
        ("Best rating (20d)", get_highlight_row(summary_df, "rating", best=True)),
        ("Worst rating (20d)", get_highlight_row(summary_df, "rating", best=False)),
        ("Best setup_type (20d)", get_highlight_row(summary_df, "setup_type", best=True)),
        ("Best score_bucket (20d)", get_highlight_row(summary_df, "score_bucket", best=True)),
    ]

    highlight_columns = st.columns(len(highlights))
    for index, (label, row) in enumerate(highlights):
        if row is None:
            highlight_columns[index].metric(label, "Not ready", "No 20d data")
            continue
        highlight_columns[index].metric(
            label,
            str(row["group_value"]),
            f"avg {format_percent(row['avg_return'])}",
            delta_color="off",
        )


def load_history_df(snapshot_files: list[Path]) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for snapshot_path in sorted(snapshot_files):
        df, error = safe_read_csv(snapshot_path)
        if error or df is None or df.empty:
            continue

        if "timestamp_utc" not in df.columns:
            parsed = parse_snapshot_timestamp(snapshot_path)
            if parsed is not None:
                df.insert(0, "timestamp_utc", parsed.isoformat())
            else:
                continue

        df["source_file"] = snapshot_path.name
        frames.append(df)

    if not frames:
        return pd.DataFrame()

    history_df = pd.concat(frames, ignore_index=True)
    history_df = prepare_scan_df(history_df)
    history_df["timestamp_utc"] = pd.to_datetime(history_df["timestamp_utc"], utc=True, errors="coerce")
    history_df = history_df.dropna(subset=["timestamp_utc"])
    return history_df.sort_values(["timestamp_utc", "symbol"]).reset_index(drop=True)


def render_overview_page(full_df: pd.DataFrame | None, top_df: pd.DataFrame | None, snapshot_files: list[Path]) -> None:
    st.header("Overview / Latest Scan")

    if full_df is None:
        st.info("Latest scan data is not available yet. Run the scanner to generate the latest ranking files.")
        return

    full_df = prepare_scan_df(full_df)
    top_df = prepare_scan_df(top_df) if top_df is not None else pd.DataFrame()
    render_status_panel(full_df, snapshot_files)

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

    st.subheader("Top Candidates")
    if top_df.empty:
        st.info("Top candidates data is not available yet. Run the scanner to generate `top_candidates.csv`.")
    else:
        display_table(filtered_top, DEFAULT_TABLE_COLUMNS, highlight_top=True)

    st.subheader("Full Ranking")
    display_table(filtered_full, DEFAULT_TABLE_COLUMNS, height=520, highlight_top=True)


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

    selected_symbol = st.selectbox("Select symbol", symbols)
    symbol_rows = full_df[full_df["symbol"] == selected_symbol].copy()
    current_row = symbol_rows.iloc[0]

    overview_fields = {
        "symbol": current_row.get("symbol"),
        "price": current_row.get("price"),
        "rating": current_row.get("rating"),
        "setup_type": current_row.get("setup_type"),
        "sector": current_row.get("sector"),
        "asset_type": current_row.get("asset_type"),
    }
    display_key_value_table(overview_fields, "Latest Row")

    st.subheader("Score Breakdown")
    grouped_scores = [
        ("Technical", "technical_score", score_level),
        ("Fundamental", "fundamental_score", score_level),
        ("Macro", "macro_score", score_level),
        ("News", "news_score", score_level),
        ("Risk", "risk_penalty", risk_level),
    ]
    score_metrics = st.columns(len(grouped_scores))
    for index, (label, column, level_fn) in enumerate(grouped_scores):
        value = pd.to_numeric(current_row.get(column), errors="coerce")
        score_metrics[index].metric(
            label,
            f"{value:.2f}" if pd.notna(value) else "N/A",
            level_fn(value),
            delta_color="off",
        )

    score_data = pd.DataFrame(
        {
            "score_component": [label for label, _, _ in grouped_scores],
            "value": [pd.to_numeric(current_row.get(column), errors="coerce") for _, column, _ in grouped_scores],
        }
    )

    score_chart = score_data.dropna(subset=["value"]).set_index("score_component")
    if not score_chart.empty:
        st.bar_chart(score_chart)

    tag_data = {column: current_row.get(column) for column in TAG_COLUMNS if column in current_row.index}
    if tag_data:
        display_key_value_table(tag_data, "Tags / Fields")

    diagnostic_data = {column: current_row.get(column) for column in DIAGNOSTIC_COLUMNS if column in current_row.index}
    if diagnostic_data:
        display_key_value_table(diagnostic_data, "Diagnostics")

    st.subheader("Full Latest Row")
    st.dataframe(symbol_rows, use_container_width=True, height=240)

    st.subheader("Historical Snapshots")
    if history_df.empty:
        st.info("No historical data yet for this symbol.")
        return

    symbol_history = history_df[history_df["symbol"] == selected_symbol].copy()
    if symbol_history.empty:
        st.info("No historical data yet for this symbol.")
        return

    symbol_history = symbol_history.sort_values("timestamp_utc")
    timeline_columns = [column for column in HISTORY_TIMELINE_COLUMNS if column in symbol_history.columns]
    timeline_df = symbol_history[timeline_columns].copy()
    timeline_df["timestamp_utc"] = timeline_df["timestamp_utc"].dt.strftime("%Y-%m-%d %H:%M:%S UTC")

    final_score_chart = symbol_history.set_index("timestamp_utc")[["final_score"]].dropna() if "final_score" in symbol_history.columns else pd.DataFrame()
    price_chart = symbol_history.set_index("timestamp_utc")[["price"]].dropna() if "price" in symbol_history.columns else pd.DataFrame()

    chart_columns = st.columns(2)
    with chart_columns[0]:
        if not final_score_chart.empty:
            st.caption("Final score over time")
            st.line_chart(final_score_chart)
        else:
            st.info("No `final_score` history available.")
    with chart_columns[1]:
        if not price_chart.empty:
            st.caption("Price over time")
            st.line_chart(price_chart)
        else:
            st.info("No `price` history available.")

    st.caption("History table")
    st.dataframe(timeline_df, use_container_width=True, height=320)


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


def render_performance_group(summary_df: pd.DataFrame, group_type: str, title: str) -> None:
    section = summary_df[summary_df["group_type"] == group_type].copy()
    st.subheader(title)

    if section.empty:
        st.info(f"No data available for `{group_type}` yet.")
        return

    available_horizons = sorted(section["horizon"].dropna().astype(str).unique().tolist())
    horizon = st.selectbox(
        f"{title} horizon",
        available_horizons,
        key=f"horizon_{group_type}",
    )
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

    if summary_df is None:
        st.info("Performance analysis not ready yet.")
        return

    summary_df = summary_df.copy()
    render_performance_highlights(summary_df)
    render_performance_group(summary_df, "rating", "Performance by Rating")
    render_performance_group(summary_df, "setup_type", "Performance by Setup Type")
    render_performance_group(summary_df, "asset_type", "Performance by Asset Type")
    render_performance_group(summary_df, "score_bucket", "Performance by Score Bucket")

    st.subheader("Forward Return Rows")
    if forward_df is None or forward_df.empty:
        st.info("Forward return data not available yet. This will populate after enough historical scans.")
        return

    st.dataframe(forward_df, use_container_width=True, height=320)


def snapshot_options(snapshot_files: list[Path]) -> dict[str, Path]:
    options: dict[str, Path] = {}
    for path in snapshot_files:
        label = f"{path.name} | {format_timestamp(parse_snapshot_timestamp(path))}"
        options[label] = path
    return options


def compare_snapshots(left_df: pd.DataFrame, right_df: pd.DataFrame) -> pd.DataFrame:
    if "symbol" not in left_df.columns or "symbol" not in right_df.columns:
        return pd.DataFrame()

    left = prepare_scan_df(left_df).copy()
    right = prepare_scan_df(right_df).copy()

    merged = left.merge(
        right,
        on="symbol",
        how="outer",
        suffixes=("_left", "_right"),
        indicator=True,
    )

    if "final_score_left" in merged.columns and "final_score_right" in merged.columns:
        merged["final_score_delta"] = merged["final_score_right"] - merged["final_score_left"]

    preferred_columns = [
        "symbol",
        "_merge",
        "rating_left",
        "rating_right",
        "final_score_left",
        "final_score_right",
        "final_score_delta",
        "price_left",
        "price_right",
    ]
    available_columns = [column for column in preferred_columns if column in merged.columns]
    return merged[available_columns].sort_values(["_merge", "symbol"]).reset_index(drop=True)


def render_history_page(snapshot_files: list[Path]) -> None:
    st.header("Scan History")

    if not snapshot_files:
        st.info("No historical snapshots yet. Scanner needs to run at least once.")
        return

    snapshot_rows = []
    for path in snapshot_files:
        snapshot_rows.append(
            {
                "file": path.name,
                "timestamp_utc": format_timestamp(parse_snapshot_timestamp(path)),
            }
        )
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
        )
        st.caption(f"Base path: `{BASE_DIR}`")
        st.caption(f"Output path: `{OUTPUT_DIR}`")

    if page == "Overview / Latest Scan":
        render_overview_page(full_df, top_df, snapshot_files)
    elif page == "Symbol Detail":
        render_symbol_detail_page(full_df, history_df)
    elif page == "Performance Analysis":
        render_performance_page(summary_df, forward_df)
    else:
        render_history_page(snapshot_files)


if __name__ == "__main__":
    main()
