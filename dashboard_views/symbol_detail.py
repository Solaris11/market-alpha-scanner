from __future__ import annotations

from collections.abc import Mapping
from typing import cast

import pandas as pd
import streamlit as st

from .loaders import fetch_recent_news_items, filter_price_history, load_symbol_price_history, load_symbol_summary, prepare_scan_df
from .shared import (
    HISTORY_TIMELINE_COLUMNS,
    add_to_watchlist,
    display_key_value_table,
    format_billions,
    format_number,
    format_percent,
    load_watchlist,
    remove_from_watchlist,
    render_action_badge,
    render_info_card,
    render_rating_badge,
    render_score_badge,
    render_section_heading,
    render_symbol_header,
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

NEGATIVE_REASON_TERMS = (
    "risk",
    "weak",
    "headwind",
    "negative",
    "deteriorating",
    "below",
    "fading",
    "elevated",
    "overbought",
    "heavy",
    "unsupportive",
)


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


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        clean = item.strip()
        key = clean.lower()
        if not clean or key in seen:
            continue
        seen.add(key)
        ordered.append(clean)
    return ordered


def _parse_price_zone(value: object) -> tuple[float | None, float | None, float | None, str]:
    raw = str(value or "").strip()
    if not raw or raw.lower() in {"n/a", "-", "nan"}:
        return None, None, None, "N/A"

    compact = raw.replace(" ", "")
    if "-" in compact:
        left, right = compact.split("-", 1)
        low = _numeric_scalar(left)
        high = _numeric_scalar(right)
        if low is not None and high is not None:
            zone_low = min(low, high)
            zone_high = max(low, high)
            return zone_low, zone_high, (zone_low + zone_high) / 2.0, f"{zone_low:.2f}-{zone_high:.2f}"

    single = _numeric_scalar(compact)
    if single is None:
        return None, None, None, raw
    return single, single, single, f"{single:.2f}"


def _percent_change(current: float | None, other: float | None) -> float | None:
    if current is None or other is None or other == 0:
        return None
    return ((current - other) / other) * 100.0


def _distance_from_current(current: float | None, other: float | None) -> float | None:
    if current is None or other is None or current == 0:
        return None
    return ((other - current) / current) * 100.0


def _derive_upside_target(
    current_price: float | None,
    history_df: pd.DataFrame,
    entry_mid: float | None,
    invalidation: float | None,
) -> tuple[float | None, str]:
    if current_price is None:
        return None, "Target unavailable"

    if not history_df.empty and "close" in history_df.columns:
        recent_close = pd.to_numeric(history_df["close"], errors="coerce").dropna()
        if not recent_close.empty:
            lookback_high = float(recent_close.tail(252).max())
            if lookback_high > current_price * 1.02:
                return lookback_high, "52-week high retest"

    reference_entry = entry_mid if entry_mid is not None else current_price
    if invalidation is not None and reference_entry > invalidation:
        risk_unit = reference_entry - invalidation
        if risk_unit > 0:
            return reference_entry + (risk_unit * 2.0), "2R extension"

    return None, "Target unavailable"


def _build_trade_plan(current_row: pd.Series, history_df: pd.DataFrame) -> dict[str, object]:
    current_price = _numeric_scalar(current_row.get("price"))
    entry_low, entry_high, entry_mid, entry_label = _parse_price_zone(current_row.get("entry_zone"))
    invalidation = _numeric_scalar(current_row.get("invalidation_level"))
    upside_target, target_label = _derive_upside_target(current_price, history_df, entry_mid, invalidation)

    entry_distance_pct: float | None = None
    entry_context = "Entry zone unavailable"
    entry_status = "unknown"
    if current_price is not None and entry_low is not None and entry_high is not None:
        if entry_low <= current_price <= entry_high:
            entry_status = "inside"
            entry_context = "Current price is inside the entry zone"
            entry_distance_pct = 0.0
        elif current_price > entry_high:
            entry_status = "above"
            entry_distance_pct = _percent_change(current_price, entry_high)
            entry_context = f"Current price is {format_number(entry_distance_pct)}% above entry zone"
        else:
            entry_status = "below"
            entry_distance_pct = _percent_change(current_price, entry_low)
            below_distance = abs(entry_distance_pct) if entry_distance_pct is not None else None
            entry_context = f"Current price is {format_number(below_distance)}% below entry zone"

    risk_to_invalidation_pct: float | None = None
    invalidation_context = "Invalidation unavailable"
    if current_price is not None and invalidation is not None:
        risk_to_invalidation_pct = _distance_from_current(current_price, invalidation)
        if risk_to_invalidation_pct is not None:
            if risk_to_invalidation_pct < 0:
                invalidation_context = f"Risk to invalidation: {format_number(abs(risk_to_invalidation_pct))}%"
            elif risk_to_invalidation_pct > 0:
                invalidation_context = "Invalidation sits above current price; setup is already compromised"
            else:
                invalidation_context = "Current price is sitting on the invalidation level"

    upside_to_target_pct: float | None = None
    upside_context = target_label
    if current_price is not None and upside_target is not None:
        upside_to_target_pct = _distance_from_current(current_price, upside_target)
        if upside_to_target_pct is not None:
            if upside_to_target_pct > 0:
                upside_context = f"Upside to target: {format_number(upside_to_target_pct)}%"
            elif upside_to_target_pct < 0:
                upside_context = "Target is below current price; upside is already consumed"
            else:
                upside_context = "Current price is sitting on the target"

    risk_reward: float | None = None
    if risk_to_invalidation_pct is not None and upside_to_target_pct is not None:
        risk_size = abs(risk_to_invalidation_pct) if risk_to_invalidation_pct < 0 else None
        reward_size = upside_to_target_pct if upside_to_target_pct > 0 else None
        if risk_size is not None and reward_size is not None and risk_size > 0:
            risk_reward = reward_size / risk_size

    return {
        "current_price": current_price,
        "entry_low": entry_low,
        "entry_high": entry_high,
        "entry_mid": entry_mid,
        "entry_label": entry_label,
        "entry_status": entry_status,
        "entry_context": entry_context,
        "entry_distance_pct": entry_distance_pct,
        "invalidation": invalidation,
        "invalidation_context": invalidation_context,
        "risk_to_invalidation_pct": risk_to_invalidation_pct,
        "upside_target": upside_target,
        "upside_target_label": target_label,
        "upside_context": upside_context,
        "upside_to_target_pct": upside_to_target_pct,
        "risk_reward": risk_reward,
    }


def _build_confidence_summary(current_row: pd.Series) -> dict[str, object]:
    asset_type = str(current_row.get("asset_type", "Unknown"))
    technical = _numeric_scalar(current_row.get("technical_score")) or 0.0
    fundamental = _numeric_scalar(current_row.get("fundamental_score")) or 0.0
    macro = _numeric_scalar(current_row.get("macro_score")) or 0.0
    news = _numeric_scalar(current_row.get("news_score")) or 0.0
    risk_penalty = _numeric_scalar(current_row.get("risk_penalty")) or 0.0

    aligned: list[str] = []
    conflicts: list[str] = []

    if technical >= 70:
        aligned.append("technical structure strong")
    elif technical < 55:
        conflicts.append("technical structure not decisive")

    if asset_type != "EQUITY" or fundamental >= 60:
        aligned.append("fundamentals supportive")
    elif asset_type == "EQUITY" and fundamental < 45:
        conflicts.append("fundamentals lag the setup")

    if macro >= 58:
        aligned.append("macro backdrop supportive")
    elif macro < 45:
        conflicts.append("macro backdrop is lagging")

    if news >= 55:
        aligned.append("headline flow supportive")
    elif news <= 44:
        conflicts.append("headline flow is not helping")

    risk_supportive = risk_penalty <= 10
    if risk_penalty >= 16:
        conflicts.append("risk penalty elevated")

    alignment_count = len(aligned)
    if alignment_count >= 3 and risk_supportive:
        label = "High"
        tone = "positive"
        summary = f"{alignment_count} of 4 major inputs aligned and risk remains contained."
    elif alignment_count >= 2:
        label = "Medium"
        tone = "accent"
        summary = f"{alignment_count} of 4 major inputs aligned; one or more layers still need confirmation."
    else:
        label = "Low"
        tone = "negative"
        summary = f"Only {alignment_count} of 4 major inputs aligned; conflicts are still material."

    if conflicts:
        summary = f"{summary} Conflict: {conflicts[0]}."

    return {
        "label": label,
        "tone": tone,
        "alignment_count": alignment_count,
        "aligned": aligned,
        "conflicts": conflicts,
        "summary": summary,
    }


def _label_from_threshold(value: float | None, strong: float, acceptable: float) -> str:
    if value is None:
        return "Unknown"
    if value >= strong:
        return "Strong"
    if value >= acceptable:
        return "Acceptable"
    return "Weak"


def _valuation_label(pe_value: float | None, valuation_flag: str) -> str:
    if valuation_flag == "cheap":
        return "Cheap"
    if valuation_flag == "reasonable":
        return "Fair"
    if valuation_flag == "expensive":
        return "Expensive"
    if pe_value is None:
        return "Unknown"
    if pe_value <= 15:
        return "Cheap"
    if pe_value <= 28:
        return "Fair"
    return "Expensive"


def _build_fundamental_interpretation(current_row: pd.Series, summary_payload: Mapping[str, object] | None) -> dict[str, tuple[str, str]]:
    fundamentals_raw = summary_payload.get("fundamentals", {}) if summary_payload else {}
    fundamentals = fundamentals_raw if isinstance(fundamentals_raw, Mapping) else {}

    profit_margin = _numeric_scalar(fundamentals.get("profit_margin", current_row.get("profit_margin")))
    operating_margin = _numeric_scalar(fundamentals.get("operating_margin", current_row.get("operating_margin")))
    roe = _numeric_scalar(fundamentals.get("return_on_equity", current_row.get("return_on_equity")))
    revenue_growth = _numeric_scalar(fundamentals.get("revenue_growth", current_row.get("revenue_growth")))
    earnings_growth = _numeric_scalar(fundamentals.get("earnings_growth", current_row.get("earnings_growth")))
    debt_to_equity = _numeric_scalar(fundamentals.get("debt_to_equity", current_row.get("debt_to_equity")))
    forward_pe = _numeric_scalar(fundamentals.get("forward_pe", current_row.get("forward_pe")))
    trailing_pe = _numeric_scalar(fundamentals.get("trailing_pe", current_row.get("trailing_pe")))
    pe_value = forward_pe if forward_pe is not None else trailing_pe

    if profit_margin is not None and operating_margin is not None and roe is not None and profit_margin >= 0.18 and operating_margin >= 0.18 and roe >= 0.18:
        profitability = ("Elite", "Margins and returns are operating at premium quality levels.")
    elif profit_margin is not None and operating_margin is not None and profit_margin > 0.08 and operating_margin > 0.10:
        profitability = ("Strong", "Business quality is comfortably profitable.")
    elif profit_margin is not None and profit_margin > 0:
        profitability = ("Mixed", "Profitable, but not at a standout level.")
    else:
        profitability = ("Weak", "Profitability profile is not yet strong enough.")

    if revenue_growth is not None and earnings_growth is not None and revenue_growth >= 0.12 and earnings_growth >= 0.12:
        growth = ("Strong", "Sales and earnings growth are both supportive.")
    elif (revenue_growth is not None and revenue_growth > 0) or (earnings_growth is not None and earnings_growth > 0):
        growth = ("Mixed", "Growth is positive, but not fully synchronized.")
    else:
        growth = ("Weak", "Growth profile is soft or unavailable.")

    valuation = (_valuation_label(pe_value, str(current_row.get("valuation_flag", "")).lower()), "Relative valuation based on current earnings multiples.")

    if debt_to_equity is None:
        balance_sheet = ("Unknown", "Debt profile is unavailable.")
    elif debt_to_equity <= 60:
        balance_sheet = ("Strong", "Leverage remains well controlled.")
    elif debt_to_equity <= 150:
        balance_sheet = ("Acceptable", "Leverage is manageable for the current setup.")
    else:
        balance_sheet = ("Weak", "Balance sheet leverage is a caution flag.")

    return {
        "Profitability": profitability,
        "Growth": growth,
        "Valuation": valuation,
        "Balance Sheet": balance_sheet,
    }


def _build_rank_context(selected_symbol: str, full_df: pd.DataFrame, current_row: pd.Series) -> dict[str, object]:
    if "symbol" not in full_df.columns:
        return {"rank": None, "total": len(full_df), "percentile": None, "tier": "Unknown"}

    ordered = full_df.sort_values("final_score", ascending=False, na_position="last").reset_index(drop=True)
    matches = ordered.index[ordered["symbol"].astype(str) == selected_symbol].tolist()
    if not matches:
        return {"rank": None, "total": len(ordered), "percentile": None, "tier": "Unknown"}

    rank = matches[0] + 1
    total = len(ordered)
    percentile = 100.0 * (1.0 - (matches[0] / max(total - 1, 1))) if total > 1 else 100.0
    rating = str(current_row.get("rating", "N/A"))
    if rating == "TOP":
        tier = "Top-tier"
    elif rating == "ACTIONABLE":
        tier = "Actionable"
    elif rating == "WATCH":
        tier = "Watch-tier"
    else:
        tier = "Lower priority"

    return {"rank": rank, "total": total, "percentile": percentile, "tier": tier}


def _build_decision_summary(
    current_row: pd.Series,
    trade_plan: dict[str, object],
    confidence: dict[str, object],
) -> dict[str, str]:
    setup = str(current_row.get("setup_type", "mixed setup"))
    upside_driver = str(current_row.get("upside_driver", "no clear upside driver")).strip()
    key_risk = str(current_row.get("key_risk", "standard trend risk")).strip()
    entry_status = str(trade_plan.get("entry_status", "unknown"))
    risk_reward = trade_plan.get("risk_reward")
    risk_reward_value = risk_reward if isinstance(risk_reward, float) else None
    confidence_label = str(confidence.get("label", "Medium"))
    macro_score = _numeric_scalar(current_row.get("macro_score")) or 0.0
    technical_score = _numeric_scalar(current_row.get("technical_score")) or 0.0

    why_now = f"{setup.title()} with {upside_driver} showing up as the main upside driver."
    if technical_score >= 75 and macro_score >= 58:
        why_now = f"{setup.title()} with strong price structure and a supportive macro backdrop."
    elif technical_score >= 75 and macro_score < 45:
        why_now = f"{setup.title()} with clear technical strength, but macro is still lagging."

    posture = "Watch patiently until price improves."
    if entry_status == "inside" and confidence_label == "High" and (risk_reward_value is None or risk_reward_value >= 1.8):
        posture = "Constructive entry if price holds the zone and risk is sized to invalidation."
    elif entry_status == "above":
        posture = "Momentum is working, but price is extended versus the preferred entry."
    elif confidence_label == "Low":
        posture = "Better as watchlist material than an active chase right now."
    elif risk_reward_value is not None and risk_reward_value < 1.4:
        posture = "Reward does not clearly dominate risk yet; wait for a cleaner location."
    else:
        posture = "Actionable with measured size while price stays above invalidation."

    invalidation_note = str(trade_plan.get("invalidation_context", "Invalidation unavailable"))
    if "unavailable" in invalidation_note.lower():
        invalidation_note = f"Main caution flag: {key_risk}."
    else:
        invalidation_note = f"{invalidation_note}. Main caution flag: {key_risk}."

    return {
        "setup": setup.title(),
        "why_now": why_now,
        "invalidation": invalidation_note,
        "posture": posture,
    }


def _build_reason_groups(
    current_row: pd.Series,
    confidence: dict[str, object],
    trade_plan: dict[str, object],
) -> dict[str, list[str]]:
    short_reasons = _reason_points(current_row.get("short_reason"))
    mid_reasons = _reason_points(current_row.get("mid_reason"))
    long_reasons = _reason_points(current_row.get("long_reason"))
    all_reasons = _dedupe(short_reasons + mid_reasons + long_reasons)

    upside_drivers = _dedupe(
        [
            str(current_row.get("upside_driver", "")),
            str(current_row.get("selection_reason", "")),
        ]
        + [item for item in all_reasons if not any(term in item.lower() for term in NEGATIVE_REASON_TERMS)]
    )

    risks = _dedupe(
        [
            str(current_row.get("key_risk", "")),
            str(trade_plan.get("invalidation_context", "")),
        ]
        + [item for item in all_reasons if any(term in item.lower() for term in NEGATIVE_REASON_TERMS)]
    )

    aligned_items = cast(list[str], confidence.get("aligned", []))
    supporting_evidence = _dedupe(aligned_items + short_reasons[:1] + mid_reasons[:1] + long_reasons[:1])

    caution_flags = _dedupe(cast(list[str], confidence.get("conflicts", [])))
    risk_reward = trade_plan.get("risk_reward")
    if isinstance(risk_reward, float) and risk_reward < 1.5:
        caution_flags.append("risk/reward is not yet compelling")
    if str(trade_plan.get("entry_status")) == "above":
        caution_flags.append("price is extended above preferred entry")
    if str(confidence.get("label")) == "Low":
        caution_flags.append("signal quality is still mixed")

    return {
        "Upside Drivers": upside_drivers[:4],
        "Risks": risks[:4],
        "Supporting Evidence": supporting_evidence[:5],
        "Conflicts / Caution Flags": _dedupe(caution_flags)[:5],
    }


def render_symbol_detail_header(
    current_row: pd.Series,
    rank_context: dict[str, object],
    trade_plan: dict[str, object],
    confidence: dict[str, object],
) -> None:
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
            render_score_badge(rank_context.get("percentile"), label="Pct"),
        ],
    )

    rank = rank_context.get("rank")
    total = rank_context.get("total")
    percentile = rank_context.get("percentile")
    risk_reward = trade_plan.get("risk_reward")
    confidence_label = str(confidence.get("label", "Medium"))

    summary_columns = st.columns(4)
    with summary_columns[0]:
        st.markdown(
            render_info_card(
                "Price Context",
                format_number(current_row.get("price")),
                str(trade_plan.get("entry_context", "Entry zone unavailable")),
                "accent",
            ),
            unsafe_allow_html=True,
        )
    with summary_columns[1]:
        rank_meta = f"Rank {rank} of {total}" if rank is not None and total is not None else "Rank unavailable"
        if isinstance(percentile, float):
            rank_meta = f"{rank_meta} • {format_number(percentile)}th percentile"
        st.markdown(
            render_info_card(
                "Ranking",
                str(rank_context.get("tier", "Unknown")),
                rank_meta,
                "positive",
            ),
            unsafe_allow_html=True,
        )
    with summary_columns[2]:
        rr_text = format_number(risk_reward) if isinstance(risk_reward, float) else "N/A"
        st.markdown(
            render_info_card(
                "Risk / Reward",
                rr_text,
                str(trade_plan.get("upside_context", "Target unavailable")),
                "neutral",
            ),
            unsafe_allow_html=True,
        )
    with summary_columns[3]:
        st.markdown(
            render_info_card(
                "Signal Confidence",
                confidence_label,
                str(confidence.get("summary", "")),
                str(confidence.get("tone", "accent")),
            ),
            unsafe_allow_html=True,
        )


def render_watchlist_actions(symbol: str) -> None:
    watchlist = load_watchlist()
    in_watchlist = symbol in watchlist
    render_section_heading("Watchlist", "Save this symbol for fast return access later.", eyebrow="Workflow")
    columns = st.columns([1, 1.8], gap="large")
    if in_watchlist:
        if columns[0].button("Remove from Watchlist", key=f"remove_watchlist_{symbol}", use_container_width=True):
            remove_from_watchlist(symbol)
            st.rerun()
        columns[1].markdown(
            render_info_card("Watchlist Status", "Saved", "This symbol is already on your personal watchlist.", "positive"),
            unsafe_allow_html=True,
        )
    else:
        if columns[0].button("Add to Watchlist", key=f"add_watchlist_{symbol}", use_container_width=True):
            add_to_watchlist(symbol)
            st.rerun()
        columns[1].markdown(
            render_info_card("Watchlist Status", "Not Saved", "Add it to reopen from the sidebar or overview watchlist panel.", "neutral"),
            unsafe_allow_html=True,
        )


def render_price_context_panel(trade_plan: dict[str, object]) -> None:
    render_section_heading("Trade Plan", "Price location, target path, and basic risk framing.", eyebrow="Decision Support")
    columns = st.columns(5)
    cards = [
        ("Current Price", format_number(trade_plan.get("current_price")), "Reference price now", "accent"),
        ("Entry Zone", str(trade_plan.get("entry_label", "N/A")), str(trade_plan.get("entry_context", "")), "neutral"),
        ("Invalidation", format_number(trade_plan.get("invalidation")), str(trade_plan.get("invalidation_context", "")), "negative"),
        ("Upside Target", format_number(trade_plan.get("upside_target")), str(trade_plan.get("upside_target_label", "")), "positive"),
        ("Risk / Reward", format_number(trade_plan.get("risk_reward")), "Simple target-to-risk ratio", "positive"),
    ]
    for column, (label, value, meta, tone) in zip(columns, cards):
        with column:
            st.markdown(render_info_card(label, value, meta, tone), unsafe_allow_html=True)


def render_confidence_panel(confidence: dict[str, object]) -> None:
    render_section_heading("Confidence Layer", "Rule-based read on how well the major signal components agree.", eyebrow="Alignment")
    left, right = st.columns([1, 1.4], gap="large")
    with left:
        st.markdown(
            render_info_card(
                "Signal Confidence",
                str(confidence.get("label", "Medium")),
                f"{confidence.get('alignment_count', 0)} of 4 major inputs aligned",
                str(confidence.get("tone", "accent")),
            ),
            unsafe_allow_html=True,
        )
    with right:
        st.markdown(f"**Confidence Note**: {confidence.get('summary', 'No confidence summary available.')}")
        aligned = cast(list[str], confidence.get("aligned", []))
        conflicts = cast(list[str], confidence.get("conflicts", []))
        if aligned:
            st.caption("Aligned inputs")
            st.markdown("<ul class='scanner-reason-list'>" + "".join(f"<li>{item}</li>" for item in aligned) + "</ul>", unsafe_allow_html=True)
        if conflicts:
            st.caption("Conflicts")
            st.markdown("<ul class='scanner-reason-list'>" + "".join(f"<li>{item}</li>" for item in conflicts) + "</ul>", unsafe_allow_html=True)


def render_decision_summary_panel(decision_summary: dict[str, str]) -> None:
    render_section_heading("Operator Note", "Concise posture guidance for acting, waiting, or passing.", eyebrow="Desk Note")
    st.markdown(
        "<ul class='scanner-reason-list'>"
        f"<li><strong>Setup:</strong> {decision_summary['setup']}</li>"
        f"<li><strong>Why now:</strong> {decision_summary['why_now']}</li>"
        f"<li><strong>Invalidation:</strong> {decision_summary['invalidation']}</li>"
        f"<li><strong>Posture:</strong> {decision_summary['posture']}</li>"
        "</ul>",
        unsafe_allow_html=True,
    )


def render_score_stack(current_row: pd.Series) -> None:
    render_section_heading("Signal Stack", "Core score components that drive the ranking output.", eyebrow="Scoring")
    grouped_scores = [
        ("Technical", current_row.get("technical_score"), "Technical structure and momentum"),
        ("Fundamental", current_row.get("fundamental_score"), "Quality, growth, and valuation"),
        ("Macro", current_row.get("macro_score"), "Regime alignment"),
        ("News", current_row.get("news_score"), "Headline and event flow"),
        ("Risk", current_row.get("risk_penalty"), "Penalty applied to the setup"),
    ]
    columns = st.columns(len(grouped_scores))
    for column, (label, value, meta) in zip(columns, grouped_scores):
        numeric = _numeric_scalar(value)
        progress_value = max(0, min(100, int(numeric if numeric is not None else 0)))
        tone = "warning" if label == "Risk" else "positive"
        with column:
            st.markdown(render_info_card(label, format_number(numeric), meta, tone), unsafe_allow_html=True)
            st.progress(progress_value, text=f"{label} {format_number(numeric)}")


def render_action_cards(current_row: pd.Series) -> None:
    render_section_heading("Action Ladder", "Short, medium, and long horizon recommendations with score context.", eyebrow="Execution")
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


def render_summary_tab(
    current_row: pd.Series,
    confidence: dict[str, object],
    trade_plan: dict[str, object],
    decision_summary: dict[str, str],
    reason_groups: dict[str, list[str]],
) -> None:
    left, right = st.columns([1.15, 1], gap="large")

    with left:
        with st.container(border=True):
            render_price_context_panel(trade_plan)
        with st.container(border=True):
            render_confidence_panel(confidence)
        with st.container(border=True):
            render_decision_summary_panel(decision_summary)

    with right:
        with st.container(border=True):
            render_section_heading("Decision Snapshot", "Reference fields that matter when moving from scan to trade.", eyebrow="Snapshot")
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
                render_section_heading("Diagnostics", "Quick technical diagnostics for confirming structure quality.", eyebrow="Monitoring")
                display_key_value_table(diagnostic_data, "Diagnostics")

        with st.container(border=True):
            render_section_heading("Why Selected", "Grouped for faster scanning of reward drivers versus failure modes.", eyebrow="Reason Map")
            for title, items in reason_groups.items():
                st.markdown(f"**{title}**")
                if items:
                    st.markdown("<ul class='scanner-reason-list'>" + "".join(f"<li>{item}</li>" for item in items) + "</ul>", unsafe_allow_html=True)
                else:
                    st.caption("No items available.")


def render_price_history_tab(selected_symbol: str, history_df: pd.DataFrame, history_source: str) -> None:
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
        st.caption("Artifacts are preferred first; live market data is used only as fallback.")

    if not filtered_history.empty and "close" in filtered_history.columns:
        with st.container(border=True):
            st.line_chart(filtered_history.set_index("date")[["close"]], use_container_width=True)
    st.dataframe(filtered_history, use_container_width=True, height=320, hide_index=True)


def render_fundamentals_tab(current_row: pd.Series, summary_payload: Mapping[str, object] | None) -> None:
    fundamentals_raw = summary_payload.get("fundamentals", {}) if summary_payload else {}
    fundamentals = fundamentals_raw if isinstance(fundamentals_raw, Mapping) else {}
    interpretation = _build_fundamental_interpretation(current_row, summary_payload)

    render_section_heading("Fundamental Interpretation", "Turn raw fundamentals into trade-relevant labels before reading the table.", eyebrow="Interpretation")
    top_columns = st.columns(4)
    tone_map = {
        "Elite": "positive",
        "Strong": "positive",
        "Fair": "neutral",
        "Cheap": "positive",
        "Acceptable": "accent",
        "Mixed": "warning",
        "Expensive": "negative",
        "Weak": "negative",
        "Unknown": "neutral",
    }
    for column, (label, (value, note)) in zip(top_columns, interpretation.items()):
        with column:
            st.markdown(render_info_card(label, value, note, tone_map.get(value, "neutral")), unsafe_allow_html=True)

    render_section_heading("Raw Fundamentals", "Underlying values from the latest available company snapshot.", eyebrow="Reference")
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


def render_reason_tab(reason_groups: dict[str, list[str]]) -> None:
    render_section_heading("Reason Breakdown", "Grouped to make reward drivers and failure modes obvious at a glance.", eyebrow="Why It Ranked")
    for title, items in reason_groups.items():
        with st.container(border=True):
            st.markdown(f"**{title}**")
            if items:
                st.markdown("<ul class='scanner-reason-list'>" + "".join(f"<li>{item}</li>" for item in items) + "</ul>", unsafe_allow_html=True)
            else:
                st.caption("No items available.")


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


def render_symbol_detail_content(selected_symbol: str, full_df: pd.DataFrame, snapshot_history_df: pd.DataFrame) -> None:
    symbol_rows = full_df[full_df["symbol"] == selected_symbol].copy()
    if symbol_rows.empty:
        st.info("Selected symbol is not available in the latest scan.")
        return

    current_row = symbol_rows.iloc[0]
    summary_payload = load_symbol_summary(selected_symbol)
    history_df, history_source = load_symbol_price_history(selected_symbol)
    rank_context = _build_rank_context(selected_symbol, full_df, current_row)
    trade_plan = _build_trade_plan(current_row, history_df)
    confidence = _build_confidence_summary(current_row)
    decision_summary = _build_decision_summary(current_row, trade_plan, confidence)
    reason_groups = _build_reason_groups(current_row, confidence, trade_plan)

    render_symbol_detail_header(current_row, rank_context, trade_plan, confidence)
    render_watchlist_actions(selected_symbol)
    render_score_stack(current_row)
    render_action_cards(current_row)

    tabs = st.tabs(["Decision Screen", "Price History", "Fundamentals", "News", "Why Selected", "Scan History", "Full Row"])

    with tabs[0]:
        render_summary_tab(current_row, confidence, trade_plan, decision_summary, reason_groups)
    with tabs[1]:
        render_price_history_tab(selected_symbol, history_df, history_source)
    with tabs[2]:
        render_fundamentals_tab(current_row, summary_payload)
    with tabs[3]:
        render_news_tab(selected_symbol)
    with tabs[4]:
        render_reason_tab(reason_groups)
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
    if st.session_state.get("symbol_detail_selector") not in symbols:
        st.session_state["symbol_detail_selector"] = symbols[selected_symbol_index(symbols)]
    selected_symbol = st.selectbox("Select symbol", symbols, index=selected_symbol_index(symbols), key="symbol_detail_selector")
    if not isinstance(selected_symbol, str):
        st.info("Selected symbol is invalid.")
        return
    selected_symbol = selected_symbol.strip().upper()
    st.session_state["selected_symbol"] = selected_symbol
    st.query_params["page"] = "symbol-detail"
    st.query_params["symbol"] = selected_symbol
    render_symbol_detail_content(selected_symbol, full_df, history_df)
