from __future__ import annotations

import json
import subprocess
from collections.abc import Mapping
from dataclasses import dataclass
from html import escape
from pathlib import Path
from typing import Any, cast

import pandas as pd
import streamlit as st


DEFAULT_TABLE_COLUMNS = [
    "symbol",
    "asset_type",
    "sector",
    "price",
    "short_action",
    "mid_action",
    "long_action",
    "final_score",
    "short_score",
    "mid_score",
    "long_score",
    "rating",
    "setup_type",
]
RATING_STATUS_ORDER = ["TOP", "ACTIONABLE", "WATCH", "PASS"]
HISTORY_TIMELINE_COLUMNS = ["timestamp_utc", "price", "final_score", "rating"]
PERFORMANCE_METRIC_COLUMNS = ["avg_return", "median_return", "hit_rate", "avg_negative_return", "min_return"]
PERCENT_COLUMNS = {"avg_return", "median_return", "hit_rate", "avg_negative_return", "min_return"}

POSITIVE_COLOR = "#22c55e"
NEGATIVE_COLOR = "#ef4444"
NEUTRAL_COLOR = "#94a3b8"
ACCENT_COLOR = "#38bdf8"
WARN_COLOR = "#f59e0b"
BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "scanner_output"
WATCHLIST_PATH = OUTPUT_DIR / "watchlist.json"
COMMAND_TIMEOUT_SECONDS = 600
APP_OUTPUT_FIX_PATH = "/opt/apps/market-alpha-scanner/app/scanner_output"
RUNTIME_OUTPUT_FIX_PATH = "/opt/apps/market-alpha-scanner/runtime/scanner_output"


@dataclass(frozen=True)
class DashboardCommandResult:
    success: bool
    stdout: str
    stderr: str
    status: str
    returncode: int | None = None
    permission_error: bool = False
    preflight_errors: tuple[str, ...] = ()

THEME_CSS = """
<style>
    .stApp {
        background:
            radial-gradient(circle at top left, rgba(56, 189, 248, 0.12), transparent 28%),
            radial-gradient(circle at top right, rgba(34, 197, 94, 0.10), transparent 24%),
            linear-gradient(180deg, #050816 0%, #0a1020 42%, #0b1222 100%);
        color: #e2e8f0;
    }
    .block-container {
        max-width: 1480px;
        padding-top: 1.35rem;
        padding-bottom: 2.2rem;
    }
    .stSidebar {
        background: linear-gradient(180deg, rgba(8, 15, 28, 0.98), rgba(10, 16, 30, 0.98));
        border-right: 1px solid rgba(148, 163, 184, 0.14);
    }
    [data-testid="stMetric"] {
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(10, 17, 30, 0.94));
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 16px;
        padding: 0.9rem 1rem;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    }
    [data-testid="stMetricLabel"] {
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.72rem;
    }
    [data-testid="stMetricValue"] {
        color: #f8fafc;
        font-size: 1.5rem;
        font-weight: 700;
    }
    div[data-testid="stVerticalBlock"] > div:has(> div[data-testid="stMarkdownContainer"] .scanner-panel) {
        width: 100%;
    }
    .scanner-shell {
        padding: 0.2rem 0 1rem 0;
    }
    .scanner-hero {
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 22px;
        padding: 1.2rem 1.35rem;
        background: linear-gradient(135deg, rgba(9, 14, 28, 0.96), rgba(15, 23, 42, 0.86));
        box-shadow: 0 18px 44px rgba(2, 6, 23, 0.35);
        margin-bottom: 1rem;
    }
    .scanner-eyebrow {
        color: #38bdf8;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.72rem;
        font-weight: 700;
        margin-bottom: 0.45rem;
    }
    .scanner-hero h1,
    .scanner-section-heading h2,
    .scanner-card-title,
    .scanner-symbol {
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        letter-spacing: -0.02em;
    }
    .scanner-hero h1 {
        margin: 0;
        font-size: 2.05rem;
        color: #f8fafc;
    }
    .scanner-hero p {
        margin: 0.35rem 0 0 0;
        color: #94a3b8;
        font-size: 0.98rem;
        line-height: 1.5;
    }
    .scanner-section-heading {
        margin: 1.1rem 0 0.8rem 0;
    }
    .scanner-section-heading h2 {
        margin: 0;
        font-size: 1.15rem;
        color: #f8fafc;
    }
    .scanner-section-heading p {
        margin: 0.32rem 0 0 0;
        color: #94a3b8;
        font-size: 0.92rem;
    }
    .scanner-panel {
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 18px;
        padding: 1rem 1.05rem;
        background: linear-gradient(180deg, rgba(9, 14, 28, 0.92), rgba(15, 23, 42, 0.82));
        margin-bottom: 0.8rem;
    }
    .scanner-info-card {
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 18px;
        padding: 0.9rem 1rem;
        background: linear-gradient(180deg, rgba(8, 15, 28, 0.96), rgba(13, 20, 36, 0.90));
        min-height: 118px;
    }
    .scanner-info-card--positive { border-color: rgba(34, 197, 94, 0.32); }
    .scanner-info-card--negative { border-color: rgba(239, 68, 68, 0.28); }
    .scanner-info-card--accent { border-color: rgba(56, 189, 248, 0.28); }
    .scanner-info-label {
        color: #94a3b8;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 0.55rem;
    }
    .scanner-info-value {
        color: #f8fafc;
        font-size: 1.2rem;
        font-weight: 700;
    }
    .scanner-info-meta {
        color: #94a3b8;
        font-size: 0.86rem;
        margin-top: 0.42rem;
        line-height: 1.45;
    }
    .scanner-symbol {
        font-size: 2rem;
        color: #f8fafc;
        margin: 0;
    }
    .scanner-symbol-subtitle {
        color: #94a3b8;
        margin-top: 0.35rem;
        font-size: 0.95rem;
    }
    .scanner-badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        margin-top: 0.55rem;
    }
    .scanner-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.34rem 0.7rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(51, 65, 85, 0.26);
        color: #cbd5e1;
    }
    .scanner-badge--positive {
        background: rgba(34, 197, 94, 0.14);
        color: #86efac;
        border-color: rgba(34, 197, 94, 0.28);
    }
    .scanner-badge--negative {
        background: rgba(239, 68, 68, 0.12);
        color: #fca5a5;
        border-color: rgba(239, 68, 68, 0.26);
    }
    .scanner-badge--neutral {
        background: rgba(71, 85, 105, 0.28);
        color: #cbd5e1;
        border-color: rgba(148, 163, 184, 0.2);
    }
    .scanner-badge--accent {
        background: rgba(56, 189, 248, 0.12);
        color: #7dd3fc;
        border-color: rgba(56, 189, 248, 0.26);
    }
    .scanner-badge--warning {
        background: rgba(245, 158, 11, 0.13);
        color: #fcd34d;
        border-color: rgba(245, 158, 11, 0.26);
    }
    .scanner-reason-list {
        margin: 0.55rem 0 0 0;
        padding-left: 1rem;
        color: #cbd5e1;
        line-height: 1.55;
    }
    .scanner-reason-list li {
        margin-bottom: 0.4rem;
    }
    .scanner-muted {
        color: #94a3b8;
    }
    .scanner-divider {
        height: 1px;
        background: linear-gradient(90deg, rgba(56, 189, 248, 0.26), rgba(148, 163, 184, 0.04));
        margin: 0.8rem 0 1rem 0;
    }
    .stTabs [data-baseweb="tab-list"] {
        gap: 0.5rem;
    }
    .stTabs [data-baseweb="tab"] {
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.12);
        border-radius: 12px;
        padding: 0.45rem 0.85rem;
    }
    .stButton > button {
        border-radius: 12px;
        border: 1px solid rgba(56, 189, 248, 0.25);
        background: linear-gradient(180deg, rgba(14, 116, 144, 0.45), rgba(14, 116, 144, 0.28));
        color: #e0f2fe;
        font-weight: 600;
    }
    .stButton > button:hover {
        border-color: rgba(56, 189, 248, 0.45);
        background: linear-gradient(180deg, rgba(14, 165, 233, 0.44), rgba(14, 116, 144, 0.34));
        color: #f8fafc;
    }
</style>
"""


def inject_dashboard_theme() -> None:
    st.markdown(THEME_CSS, unsafe_allow_html=True)


def _normalize_watchlist_symbols(symbols: list[object]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for value in symbols:
        symbol = str(value).strip().upper()
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        ordered.append(symbol)
    return ordered


def load_watchlist() -> list[str]:
    if not WATCHLIST_PATH.exists():
        return []
    try:
        payload = json.loads(WATCHLIST_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    if isinstance(payload, list):
        return _normalize_watchlist_symbols(list(payload))
    if isinstance(payload, dict):
        symbols = payload.get("symbols", [])
        if isinstance(symbols, list):
            return _normalize_watchlist_symbols(list(symbols))
    return []


def save_watchlist(symbols: list[str]) -> list[str]:
    normalized = _normalize_watchlist_symbols(cast(list[object], list(symbols)))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    WATCHLIST_PATH.write_text(json.dumps(normalized, indent=2), encoding="utf-8")
    return normalized


def add_to_watchlist(symbol: str) -> list[str]:
    watchlist = load_watchlist()
    normalized_symbol = str(symbol).strip().upper()
    if not normalized_symbol or normalized_symbol in watchlist:
        return watchlist
    return save_watchlist(watchlist + [normalized_symbol])


def remove_from_watchlist(symbol: str) -> list[str]:
    normalized_symbol = str(symbol).strip().upper()
    watchlist = [item for item in load_watchlist() if item != normalized_symbol]
    return save_watchlist(watchlist)


def _coerce_numeric_scalar(value: object) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(str(value))
    except (TypeError, ValueError):
        return None
    return None if pd.isna(numeric) else numeric


def format_timestamp(value: object) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "N/A"
    candidate: str | int | float = value if isinstance(value, (str, int, float)) else str(value)
    ts = pd.to_datetime(candidate, utc=True, errors="coerce")
    if pd.isna(ts):
        return "N/A"
    return ts.strftime("%Y-%m-%d %H:%M:%S UTC")


def format_percent(value: object) -> str:
    numeric = _coerce_numeric_scalar(value)
    if numeric is None:
        return "N/A"
    return f"{numeric * 100:.2f}%"


def format_number(value: object, decimals: int = 2) -> str:
    numeric = _coerce_numeric_scalar(value)
    if numeric is None:
        return "N/A"
    return f"{numeric:.{decimals}f}"


def format_billions(value: object) -> str:
    numeric = _coerce_numeric_scalar(value)
    if numeric is None:
        return "N/A"
    number = numeric
    if number >= 1_000_000_000_000:
        return f"{number / 1_000_000_000_000:.2f}T"
    if number >= 1_000_000_000:
        return f"{number / 1_000_000_000:.2f}B"
    if number >= 1_000_000:
        return f"{number / 1_000_000:.2f}M"
    return f"{number:,.0f}"


def render_section_heading(title: str, subtitle: str = "", eyebrow: str = "Desk View") -> None:
    subtitle_html = f"<p>{escape(subtitle)}</p>" if subtitle else ""
    st.markdown(
        (
            '<div class="scanner-section-heading">'
            f'<div class="scanner-eyebrow">{escape(eyebrow)}</div>'
            f"<h2>{escape(title)}</h2>"
            f"{subtitle_html}"
            "</div>"
        ),
        unsafe_allow_html=True,
    )


def render_panel(title: str, body: str, tone: str = "neutral") -> None:
    st.markdown(
        (
            f'<div class="scanner-panel scanner-panel--{escape(tone)}">'
            f'<div class="scanner-card-title">{escape(title)}</div>'
            f'<div class="scanner-info-meta">{body}</div>'
            "</div>"
        ),
        unsafe_allow_html=True,
    )


def _action_tone(value: object) -> str:
    text = str(value or "").upper()
    if any(token in text for token in ("STRONG BUY", "BUY", "ACCUMULATE", "ADD", "LONG")):
        return "positive"
    if any(token in text for token in ("SELL", "AVOID", "SHORT", "REDUCE")):
        return "negative"
    if any(token in text for token in ("WATCH", "WAIT", "HOLD", "PASS")):
        return "neutral"
    return "accent"


def _rating_tone(value: object) -> str:
    text = str(value or "").upper()
    if text == "TOP":
        return "positive"
    if text == "ACTIONABLE":
        return "accent"
    if text == "WATCH":
        return "warning"
    if text == "PASS":
        return "negative"
    return "neutral"


def _score_tone(value: object) -> str:
    numeric = _coerce_numeric_scalar(value)
    if numeric is None:
        return "neutral"
    if numeric >= 80:
        return "positive"
    if numeric >= 65:
        return "accent"
    if numeric >= 50:
        return "warning"
    return "negative"


def render_badge(label: object, tone: str | None = None) -> str:
    text = str(label or "N/A").strip() or "N/A"
    badge_tone = tone or "neutral"
    return f'<span class="scanner-badge scanner-badge--{badge_tone}">{escape(text)}</span>'


def render_rating_badge(value: object) -> str:
    return render_badge(value, _rating_tone(value))


def render_action_badge(value: object) -> str:
    return render_badge(value, _action_tone(value))


def render_score_badge(value: object, label: str = "Score") -> str:
    formatted = format_number(value)
    return render_badge(f"{label} {formatted}", _score_tone(value))


def render_info_card(label: str, value: object, meta: str = "", tone: str = "neutral") -> str:
    meta_html = f'<div class="scanner-info-meta">{escape(meta)}</div>' if meta else ""
    return (
        f'<div class="scanner-info-card scanner-info-card--{escape(tone)}">'
        f'<div class="scanner-info-label">{escape(label)}</div>'
        f'<div class="scanner-info-value">{escape(str(value))}</div>'
        f"{meta_html}"
        "</div>"
    )


def render_symbol_header(symbol: str, subtitle: str, badges: list[str]) -> None:
    badge_row = "".join(badges)
    st.markdown(
        (
            '<div class="scanner-panel">'
            f'<h1 class="scanner-symbol">{escape(symbol)}</h1>'
            f'<div class="scanner-symbol-subtitle">{escape(subtitle)}</div>'
            f'<div class="scanner-badge-row">{badge_row}</div>'
            "</div>"
        ),
        unsafe_allow_html=True,
    )


def display_key_value_table(data: Mapping[str, object], title: str) -> None:
    rows = [{"field": key.replace("_", " ").title(), "value": value} for key, value in data.items()]
    with st.container(border=True):
        render_section_heading(title, eyebrow="Reference")
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
    numeric = _coerce_numeric_scalar(value)
    if numeric is None:
        return "N/A"
    if numeric >= 75:
        return "High"
    if numeric >= 55:
        return "Medium"
    return "Low"


def risk_level(value: object) -> str:
    numeric = _coerce_numeric_scalar(value)
    if numeric is None:
        return "N/A"
    if numeric <= 10:
        return "Low"
    if numeric <= 25:
        return "Medium"
    return "High"


def selected_symbol_index(symbols: list[str]) -> int:
    for state_key in ("selected_symbol", "symbol_detail_selector"):
        selected_symbol = normalize_symbol(st.session_state.get(state_key, ""))
        if selected_symbol in symbols:
            return symbols.index(selected_symbol)
    return 0


def normalize_symbol(symbol: object) -> str:
    return str(symbol).strip().upper()


def open_symbol_detail(symbol: str) -> None:
    cleaned_symbol = normalize_symbol(symbol)
    if not cleaned_symbol:
        return
    st.query_params["page"] = "symbol-detail"
    st.query_params["symbol"] = cleaned_symbol
    st.session_state["current_page"] = "Symbol Detail"
    st.session_state["page_selector"] = "Symbol Detail"
    st.session_state["selected_symbol"] = cleaned_symbol
    st.session_state["symbol_detail_selector"] = cleaned_symbol
    st.rerun()


def _write_test_directory(path: Path) -> str | None:
    test_path = path / ".write_test"
    try:
        test_path.write_text("ok\n", encoding="utf-8")
        test_path.unlink()
    except Exception as exc:
        try:
            if test_path.exists():
                test_path.unlink()
        except Exception:
            pass
        return f"{path}: {exc}"
    return None


def _write_test_file(path: Path) -> str | None:
    try:
        with path.open("a", encoding="utf-8"):
            pass
    except Exception as exc:
        return f"{path}: {exc}"
    return None


def check_scanner_output_writable(cwd: Path) -> tuple[bool, tuple[str, ...]]:
    output_dir = cwd / "scanner_output"
    history_dir = output_dir / "history"
    symbols_dir = output_dir / "symbols"
    analysis_dir = output_dir / "analysis"
    errors: list[str] = []

    for directory in (output_dir, history_dir, symbols_dir, analysis_dir):
        try:
            directory.mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            errors.append(f"{directory}: could not create directory: {exc}")
            continue
        error = _write_test_directory(directory)
        if error is not None:
            errors.append(error)

    if symbols_dir.exists():
        try:
            symbol_paths = sorted(path for path in symbols_dir.iterdir() if path.is_dir())
        except Exception as exc:
            errors.append(f"{symbols_dir}: could not list symbol directories: {exc}")
            symbol_paths = []

        for symbol_dir in symbol_paths:
            directory_error = _write_test_directory(symbol_dir)
            if directory_error is not None:
                errors.append(directory_error)
            history_file = symbol_dir / "history.csv"
            if history_file.exists():
                file_error = _write_test_file(history_file)
                if file_error is not None:
                    errors.append(file_error)

    return not errors, tuple(errors)


def run_dashboard_command(command: list[str], cwd: Path, timeout_seconds: int = COMMAND_TIMEOUT_SECONDS) -> DashboardCommandResult:
    writable, preflight_errors = check_scanner_output_writable(cwd)
    if not writable:
        return DashboardCommandResult(
            success=False,
            stdout="",
            stderr="\n".join(preflight_errors),
            status="scanner_output is not writable by this Streamlit process.",
            permission_error=True,
            preflight_errors=preflight_errors,
        )

    try:
        result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=timeout_seconds, check=False)
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout.decode("utf-8", errors="replace") if isinstance(exc.stdout, bytes) else str(exc.stdout or "")
        stderr = exc.stderr.decode("utf-8", errors="replace") if isinstance(exc.stderr, bytes) else str(exc.stderr or "")
        return DashboardCommandResult(
            False,
            stdout,
            stderr,
            f"Command timed out after {timeout_seconds} seconds.",
            permission_error=_contains_permission_error(stderr) or _contains_permission_error(stdout),
        )
    except Exception as exc:
        message = f"Command failed to start: {exc}"
        return DashboardCommandResult(False, "", "", message, permission_error=_contains_permission_error(message))

    stderr = result.stderr or ""
    stdout = result.stdout or ""
    status = f"Command exited with code {result.returncode}."
    return DashboardCommandResult(
        success=result.returncode == 0,
        stdout=stdout,
        stderr=stderr,
        status=status,
        returncode=result.returncode,
        permission_error=_contains_permission_error(stderr) or _contains_permission_error(stdout),
    )


def _contains_permission_error(text: str) -> bool:
    lowered = text.lower()
    return "permissionerror" in lowered or "permission denied" in lowered


def render_output_permission_fix() -> None:
    st.error("scanner_output is not writable by this Streamlit process.")
    st.caption("Operator fix for the app path:")
    st.code(
        "\n".join(
            [
                f"sudo chown -R sre:sre {APP_OUTPUT_FIX_PATH}",
                f"chmod -R u+rwX {APP_OUTPUT_FIX_PATH}",
            ]
        ),
        language="bash",
    )
    st.caption("If scanner_output is a symlink, fix the real target:")
    st.code(
        "\n".join(
            [
                f"sudo chown -R sre:sre {RUNTIME_OUTPUT_FIX_PATH}",
                f"chmod -R u+rwX {RUNTIME_OUTPUT_FIX_PATH}",
            ]
        ),
        language="bash",
    )


def render_dashboard_command_result(
    result: DashboardCommandResult,
    *,
    success_message: str,
    failure_message: str,
    log_title: str,
) -> None:
    if result.success:
        st.success(success_message)
    else:
        st.error(failure_message)
        if result.returncode is not None:
            st.caption(f"Exit code: {result.returncode}")
        if result.permission_error:
            render_output_permission_fix()
    st.caption(result.status)
    render_command_logs(log_title, result.stdout, result.stderr, expanded=not result.success)


def render_command_logs(title: str, stdout: str, stderr: str, *, expanded: bool = False) -> None:
    if not stdout and not stderr:
        return
    with st.expander(title, expanded=expanded):
        if stdout:
            st.caption("stdout")
            st.code(stdout)
        if stderr:
            st.caption("stderr")
            st.code(stderr)


def go_to_overview() -> None:
    for key in ("page", "symbol"):
        if key in st.query_params:
            del st.query_params[key]
    st.session_state["current_page"] = "Overview / Latest Scan"
    st.session_state["page_selector"] = "Overview / Latest Scan"
    st.rerun()


def render_watchlist_panel(
    watchlist: list[str],
    *,
    panel_key: str,
    title: str = "Watchlist",
    subtitle: str = "Saved names for fast return access.",
    eyebrow: str = "Watchlist",
    empty_message: str = "No saved symbols yet.",
    removable: bool = True,
) -> None:
    render_section_heading(title, subtitle, eyebrow=eyebrow)
    if not watchlist:
        st.info(empty_message)
        return

    st.caption(f"{len(watchlist)} saved symbol{'s' if len(watchlist) != 1 else ''}")
    for index, symbol in enumerate(watchlist):
        row_columns = st.columns([1.4, 0.8] if removable else [1], gap="small")
        if row_columns[0].button(symbol, key=f"{panel_key}_open_{index}_{symbol}", use_container_width=True):
            open_symbol_detail(symbol)
        if removable and row_columns[1].button("Remove", key=f"{panel_key}_remove_{index}_{symbol}", use_container_width=True):
            remove_from_watchlist(symbol)
            st.rerun()


def render_symbol_quick_actions(symbols: list[str], key_prefix: str = "quick") -> None:
    if not symbols:
        return
    render_section_heading("Quick Access", "Jump directly into a visible name.", eyebrow="Workflow")
    visible_symbols = symbols[:12]
    for start in range(0, len(visible_symbols), 4):
        row_symbols = visible_symbols[start : start + 4]
        columns = st.columns(len(row_symbols))
        for offset, (column, symbol) in enumerate(zip(columns, row_symbols)):
            symbol_index = start + offset
            if column.button(symbol, key=f"{key_prefix}_quick_open_{symbol_index}_{symbol}", use_container_width=True):
                open_symbol_detail(symbol)


def render_clickable_symbol_rows(df: pd.DataFrame, section_key: str) -> None:
    sorted_df = sort_scan_df(df)
    if sorted_df.empty or "symbol" not in sorted_df.columns:
        return

    row_df = sorted_df.copy()
    row_df["symbol"] = row_df["symbol"].astype("string").str.strip()
    row_df = row_df[row_df["symbol"].notna() & (row_df["symbol"] != "")]
    if row_df.empty:
        return

    st.caption("Fast symbol jump")
    header_columns = st.columns([1.25, 0.95, 1.0, 1.3, 0.8])
    header_columns[0].markdown("**Symbol**")
    header_columns[1].markdown("**Asset**")
    header_columns[2].markdown("**Rating**")
    header_columns[3].markdown("**Action**")
    header_columns[4].markdown("**Score**")

    action_column = "composite_action" if "composite_action" in row_df.columns else "long_action"
    for index, (_, row) in enumerate(row_df.iterrows()):
        symbol = str(row["symbol"]).strip()
        if not symbol:
            continue
        row_columns = st.columns([1.25, 0.95, 1.0, 1.3, 0.8])
        if row_columns[0].button(symbol, key=f"{section_key}_symbol_open_{index}_{symbol}", use_container_width=True):
            open_symbol_detail(symbol)
        row_columns[1].write(str(row.get("asset_type", "N/A")))
        row_columns[2].markdown(render_rating_badge(row.get("rating", "N/A")), unsafe_allow_html=True)
        row_columns[3].markdown(render_action_badge(row.get(action_column, "N/A")), unsafe_allow_html=True)
        row_columns[4].markdown(render_score_badge(row.get("final_score"), label=""), unsafe_allow_html=True)


def sort_scan_df(df: pd.DataFrame) -> pd.DataFrame:
    sorted_df = df.copy()
    if "final_score" in sorted_df.columns:
        sorted_df = sorted_df.sort_values("final_score", ascending=False, na_position="last")
    return sorted_df.reset_index(drop=True)


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


def _style_rating(value: object) -> str:
    tone = _rating_tone(value)
    color = {
        "positive": POSITIVE_COLOR,
        "accent": ACCENT_COLOR,
        "warning": WARN_COLOR,
        "negative": NEGATIVE_COLOR,
        "neutral": NEUTRAL_COLOR,
    }[tone]
    return f"color: {color}; font-weight: 700;"


def _style_action(value: object) -> str:
    tone = _action_tone(value)
    color = {
        "positive": POSITIVE_COLOR,
        "accent": ACCENT_COLOR,
        "warning": WARN_COLOR,
        "negative": NEGATIVE_COLOR,
        "neutral": NEUTRAL_COLOR,
    }[tone]
    return f"color: {color}; font-weight: 700;"


def highlight_top_rows(row: pd.Series) -> list[str]:
    if str(row.get("rating", "")).upper() == "TOP":
        return ["background-color: rgba(34, 197, 94, 0.08);" for _ in row.index]
    return ["" for _ in row.index]


def display_table(df: pd.DataFrame, preferred_columns: list[str], height: int = 420, highlight_top: bool = False) -> None:
    if df.empty:
        st.info("No rows match the current selection.")
        return

    sorted_df = sort_scan_df(df)
    visible_columns = [column for column in preferred_columns if column in sorted_df.columns]
    display_df = sorted_df[visible_columns].copy() if visible_columns else sorted_df.copy()

    number_formats = {
        column: "{:.2f}"
        for column in display_df.columns
        if pd.api.types.is_numeric_dtype(display_df[column]) and column not in {"volume"}
    }
    if "volume" in display_df.columns:
        number_formats["volume"] = "{:,.0f}"

    try:
        styler = display_df.style.format(cast(Any, number_formats), na_rep="—")
        gradient_columns = [
            column
            for column in ["final_score", "short_score", "mid_score", "long_score", "technical_score", "fundamental_score", "macro_score", "news_score"]
            if column in display_df.columns
        ]
        if gradient_columns:
            styler = styler.background_gradient(
                subset=cast(Any, gradient_columns),
                cmap="RdYlGn",
                low=0.25,
                high=0.2,
                vmin=0,
                vmax=100,
            )
        if "rating" in display_df.columns:
            styler = cast(Any, styler).map(_style_rating, subset=["rating"])
        action_columns = [column for column in ["composite_action", "short_action", "mid_action", "long_action"] if column in display_df.columns]
        if action_columns:
            styler = cast(Any, styler).map(_style_action, subset=action_columns)
        if highlight_top and "rating" in display_df.columns:
            styler = styler.apply(highlight_top_rows, axis=1)
        styler = cast(Any, styler).set_properties(
            **{
                "background-color": "rgba(15, 23, 42, 0.88)",
                "color": "#e2e8f0",
                "border-color": "rgba(148, 163, 184, 0.16)",
                "font-size": "0.9rem",
            }
        )
        numeric_columns = [column for column in display_df.columns if pd.api.types.is_numeric_dtype(display_df[column])]
        if numeric_columns:
            styler = cast(Any, styler).set_properties(subset=numeric_columns, **{"text-align": "right"})
        styler = styler.hide(axis="index")
        st.dataframe(styler, use_container_width=True, height=height)
    except Exception:
        st.dataframe(display_df, use_container_width=True, height=height, hide_index=True)


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
    return cast(pd.DataFrame, display_df)
