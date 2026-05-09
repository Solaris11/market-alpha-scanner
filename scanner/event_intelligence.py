from __future__ import annotations

import hashlib
import json
import math
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Final, Mapping, TypedDict
from urllib.parse import urljoin, urlparse

import numpy as np
import pandas as pd

from .macro_context import (
    CRYPTO_PROXIES,
    FINANCIAL_SYMBOLS,
    GOLD_PROXIES,
    OIL_PROXIES,
    SEMICONDUCTOR_SYMBOLS,
    SOFTWARE_SYMBOLS,
)
from .event_llm import analyze_verified_event_with_llm
from .utils import clamp_score, safe_float, safe_str


@dataclass(frozen=True)
class TrustedEventFeed:
    key: str
    name: str
    url: str
    category_hint: str
    source_weight: float = 0.82


@dataclass(frozen=True)
class ClassificationRule:
    event_type: str
    category: str
    keywords: tuple[str, ...]
    impact_tags: tuple[str, ...]
    sectors: tuple[str, ...]
    asset_classes: tuple[str, ...]
    regime_tags: tuple[str, ...]
    pressure_score: float
    conviction_bias: float
    fragility_bias: float
    shock_bias: float
    reason_code: str


class VerifiedEvent(TypedDict):
    affected_sectors: list[str]
    affected_symbols: list[str]
    asset_classes: list[str]
    category: str
    confidence: float
    conviction_bias: float
    direction: str
    event_confidence: float
    event_decay: float
    event_direction: str
    event_id: str
    event_type: str
    event_types: list[str]
    evidence_phrases: list[str]
    feed_key: str
    fragility_bias: float
    impact_tags: list[str]
    pressure_score: float
    published_at: str
    reason_codes: list[str]
    regime_tags: list[str]
    sectors: list[str]
    shock_bias: float
    source: str
    source_name: str
    source_url: str
    source_weight: float
    summary: str
    title: str


class EventContext(TypedDict):
    available: bool
    cache_status: str
    event_pressure_score: float
    event_types: list[str]
    events: list[VerifiedEvent]
    generated_at: str
    macro_event_summary: str
    reason_codes: list[str]
    sources_used: list[str]


class EventImpact(TypedDict):
    event_context_available: bool
    event_context_label: str
    event_context_reason_codes: list[str]
    event_context_summary: str
    event_conviction_adjustment: float
    event_decay: float
    event_confidence: float
    event_fragility_adjustment: float
    event_impact_scope: str
    event_macro_pressure_adjustment: float
    event_risk_score: float
    event_shock_pressure_score: float
    event_source_weight: float
    macro_event_regime_signature: str
    verified_event_pressure_score: float
    verified_event_recent_events: list[dict[str, object]]
    verified_event_signature: str
    verified_event_sources_used: list[str]


DEFAULT_EVENT_FEEDS: Final[tuple[TrustedEventFeed, ...]] = (
    TrustedEventFeed(
        key="federal_reserve",
        name="Federal Reserve",
        url="https://www.federalreserve.gov/feeds/press_all.xml",
        category_hint="macro",
        source_weight=1.0,
    ),
    TrustedEventFeed(
        key="bls_latest",
        name="Bureau of Labor Statistics",
        url="https://www.bls.gov/feed/bls_latest.rss",
        category_hint="macro",
        source_weight=1.0,
    ),
    TrustedEventFeed(
        key="sec_press",
        name="SEC",
        url="https://www.sec.gov/news/pressreleases.rss",
        category_hint="company_regulatory",
        source_weight=1.0,
    ),
    TrustedEventFeed(
        key="sec_current_8k",
        name="SEC EDGAR 8-K Filings",
        url="https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&company=&dateb=&owner=include&start=0&count=40&output=atom",
        category_hint="company_regulatory",
        source_weight=0.98,
    ),
    TrustedEventFeed(
        key="cftc_general_press",
        name="CFTC",
        url="https://www.cftc.gov/RSS/RSSGP/rssgp.xml",
        category_hint="market_regulatory",
        source_weight=0.96,
    ),
    TrustedEventFeed(
        key="bea_news_releases",
        name="Bureau of Economic Analysis",
        url="https://apps.bea.gov/rss/rss.xml",
        category_hint="macro",
        source_weight=1.0,
    ),
    TrustedEventFeed(
        key="census_economic_indicators",
        name="U.S. Census Economic Indicators",
        url="https://www.census.gov/economic-indicators/indicator.xml",
        category_hint="macro",
        source_weight=0.98,
    ),
    TrustedEventFeed(
        key="eia_today_in_energy",
        name="U.S. Energy Information Administration",
        url="https://www.eia.gov/rss/todayinenergy.xml",
        category_hint="commodity",
        source_weight=0.96,
    ),
    TrustedEventFeed(
        key="eia_press",
        name="U.S. Energy Information Administration",
        url="https://www.eia.gov/rss/press_rss.xml",
        category_hint="commodity",
        source_weight=0.96,
    ),
    TrustedEventFeed(
        key="prnewswire_releases",
        name="PR Newswire",
        url="https://www.prnewswire.com/rss/news-releases-list.rss",
        category_hint="company",
        source_weight=0.78,
    ),
    TrustedEventFeed(
        key="marketwatch_top_stories",
        name="MarketWatch",
        url="https://feeds.content.dowjones.io/public/rss/mw_topstories",
        category_hint="market",
        source_weight=0.82,
    ),
)
DEFAULT_CACHE_TTL = timedelta(hours=6)
DEFAULT_STALE_CACHE_TTL = timedelta(days=3)
DEFAULT_LOOKBACK_DAYS = 21
DEFAULT_FEED_LIMIT = 12
MAX_CONTEXT_EVENTS = 40
MAX_RECENT_EVENTS_PER_ROW = 4
EVENT_CACHE_PATH = "event_intelligence/verified_events.json"
MIN_EVENT_DECAY = 0.12
TRUSTED_FEED_HOST_SUFFIXES: Final[frozenset[str]] = frozenset(
    {
        "federalreserve.gov",
        "bls.gov",
        "sec.gov",
        "cftc.gov",
        "bea.gov",
        "apps.bea.gov",
        "census.gov",
        "eia.gov",
        "prnewswire.com",
        "globenewswire.com",
        "businesswire.com",
        "marketwatch.com",
        "dowjones.io",
        "reuters.com",
        "apnews.com",
        "yahoo.com",
        "finance.yahoo.com",
    }
)
TRUSTED_NEWS_PROVIDERS: Final[frozenset[str]] = frozenset(
    {
        "ap",
        "associated press",
        "bloomberg",
        "business wire",
        "cnbc",
        "federal reserve",
        "globenewswire",
        "marketwatch",
        "mt newswires",
        "pr newswire",
        "reuters",
        "sec",
        "the wall street journal",
        "wall street journal",
        "yahoo finance",
    }
)

CLASSIFICATION_RULES: Final[tuple[ClassificationRule, ...]] = (
    ClassificationRule(
        event_type="inflation",
        category="macro",
        keywords=("consumer price", "producer price", "cpi", "ppi", "inflation", "price index", "real earnings"),
        impact_tags=("inflation_pressure", "rates_sensitive"),
        sectors=("technology", "software", "consumer discretionary", "financial services"),
        asset_classes=("equity", "growth"),
        regime_tags=("liquidity_tightening", "macro_pressure"),
        pressure_score=72.0,
        conviction_bias=-1.2,
        fragility_bias=2.4,
        shock_bias=2.0,
        reason_code="EVENT_INFLATION_PRESSURE",
    ),
    ClassificationRule(
        event_type="employment",
        category="macro",
        keywords=("employment situation", "nonfarm", "payroll", "unemployment", "jobs", "job openings", "jolts", "wages"),
        impact_tags=("employment_pressure", "rates_sensitive"),
        sectors=("technology", "software", "financial services", "consumer discretionary"),
        asset_classes=("equity", "growth"),
        regime_tags=("macro_pressure",),
        pressure_score=62.0,
        conviction_bias=-0.6,
        fragility_bias=1.4,
        shock_bias=1.4,
        reason_code="EVENT_EMPLOYMENT_PRESSURE",
    ),
    ClassificationRule(
        event_type="fed_rates",
        category="macro",
        keywords=("fomc", "federal reserve", "monetary policy", "interest rate", "fed funds", "powell", "balance sheet"),
        impact_tags=("fed_policy", "rates_sensitive"),
        sectors=("technology", "software", "financial services", "real estate"),
        asset_classes=("equity", "crypto", "growth"),
        regime_tags=("liquidity_context", "macro_pressure"),
        pressure_score=68.0,
        conviction_bias=-0.8,
        fragility_bias=2.0,
        shock_bias=1.8,
        reason_code="EVENT_FED_RATES",
    ),
    ClassificationRule(
        event_type="liquidity_tightening",
        category="macro",
        keywords=("tightening", "restrictive", "higher rates", "rate hike", "runoff", "treasury yields", "yield pressure"),
        impact_tags=("liquidity_tightening", "rates_sensitive"),
        sectors=("technology", "software", "crypto", "small cap"),
        asset_classes=("equity", "crypto", "growth"),
        regime_tags=("liquidity_tightening",),
        pressure_score=76.0,
        conviction_bias=-1.6,
        fragility_bias=2.8,
        shock_bias=2.2,
        reason_code="EVENT_LIQUIDITY_TIGHTENING",
    ),
    ClassificationRule(
        event_type="liquidity_easing",
        category="macro",
        keywords=("easing", "rate cut", "lower rates", "liquidity facility", "supportive liquidity", "dovish"),
        impact_tags=("liquidity_supportive", "risk_appetite"),
        sectors=("technology", "software", "semiconductors", "crypto", "small cap"),
        asset_classes=("equity", "crypto", "growth"),
        regime_tags=("liquidity_supportive", "risk_on"),
        pressure_score=38.0,
        conviction_bias=1.6,
        fragility_bias=-0.8,
        shock_bias=1.2,
        reason_code="EVENT_LIQUIDITY_SUPPORTIVE",
    ),
    ClassificationRule(
        event_type="volatility_expansion",
        category="market",
        keywords=("volatility", "market stress", "financial stress", "uncertainty", "turmoil", "risk-off", "risk off"),
        impact_tags=("volatility_expansion", "risk_off"),
        sectors=("technology", "software", "financial services", "crypto"),
        asset_classes=("equity", "crypto"),
        regime_tags=("volatility_expansion", "risk_off"),
        pressure_score=80.0,
        conviction_bias=-1.4,
        fragility_bias=3.4,
        shock_bias=3.0,
        reason_code="EVENT_VOLATILITY_PRESSURE",
    ),
    ClassificationRule(
        event_type="recession_fear",
        category="macro",
        keywords=("recession", "slowdown", "contraction", "weak demand", "consumer weakness", "credit stress"),
        impact_tags=("growth_pressure", "defensive_rotation"),
        sectors=("consumer discretionary", "technology", "financial services", "industrials"),
        asset_classes=("equity",),
        regime_tags=("risk_off", "defensive"),
        pressure_score=78.0,
        conviction_bias=-1.8,
        fragility_bias=3.0,
        shock_bias=2.2,
        reason_code="EVENT_RECESSION_PRESSURE",
    ),
    ClassificationRule(
        event_type="defensive_rotation",
        category="market",
        keywords=("defensive", "utilities", "consumer staples", "health care", "safe haven", "risk aversion"),
        impact_tags=("defensive_rotation",),
        sectors=("utilities", "consumer defensive", "healthcare"),
        asset_classes=("equity",),
        regime_tags=("defensive", "risk_off"),
        pressure_score=63.0,
        conviction_bias=-0.4,
        fragility_bias=1.4,
        shock_bias=1.0,
        reason_code="EVENT_DEFENSIVE_ROTATION",
    ),
    ClassificationRule(
        event_type="ai_semiconductor_momentum",
        category="market",
        keywords=("artificial intelligence", "ai", "semiconductor", "chip", "data center", "accelerator", "gpu"),
        impact_tags=("theme_momentum", "ai_infrastructure"),
        sectors=("semiconductors", "technology"),
        asset_classes=("equity", "growth"),
        regime_tags=("risk_on", "momentum_expansion"),
        pressure_score=42.0,
        conviction_bias=1.4,
        fragility_bias=0.6,
        shock_bias=1.8,
        reason_code="EVENT_AI_SEMICONDUCTOR_THEME",
    ),
    ClassificationRule(
        event_type="oil_supply_shock",
        category="geopolitical",
        keywords=("oil supply", "crude", "opec", "energy supply", "sanctions", "oil shock", "production cut", "oil prices", "oil price"),
        impact_tags=("oil_volatility", "commodity_pressure"),
        sectors=("energy", "commodities"),
        asset_classes=("equity", "commodity"),
        regime_tags=("volatility_expansion", "inflation_pressure"),
        pressure_score=70.0,
        conviction_bias=0.6,
        fragility_bias=2.4,
        shock_bias=3.2,
        reason_code="EVENT_OIL_SUPPLY_SHOCK",
    ),
    ClassificationRule(
        event_type="gold_safe_haven",
        category="market",
        keywords=("gold", "safe haven", "precious metals", "bullion", "gold prices", "gold price"),
        impact_tags=("gold_context", "defensive_pressure"),
        sectors=("commodities", "gold"),
        asset_classes=("commodity", "equity"),
        regime_tags=("defensive", "risk_off"),
        pressure_score=60.0,
        conviction_bias=0.2,
        fragility_bias=1.2,
        shock_bias=1.4,
        reason_code="EVENT_GOLD_SAFE_HAVEN",
    ),
    ClassificationRule(
        event_type="war_escalation",
        category="geopolitical",
        keywords=("war", "missile", "invasion", "attack", "escalation", "ceasefire collapsed", "conflict escalates", "military strike"),
        impact_tags=("geopolitical_risk", "risk_off"),
        sectors=("energy", "defense", "commodities"),
        asset_classes=("equity", "commodity", "crypto"),
        regime_tags=("risk_off", "volatility_expansion"),
        pressure_score=82.0,
        conviction_bias=-1.8,
        fragility_bias=3.6,
        shock_bias=3.4,
        reason_code="EVENT_GEOPOLITICAL_ESCALATION",
    ),
    ClassificationRule(
        event_type="peace_deescalation",
        category="geopolitical",
        keywords=("ceasefire", "peace agreement", "de-escalation", "deescalation", "truce", "peace talks"),
        impact_tags=("geopolitical_deescalation", "risk_appetite"),
        sectors=("energy", "industrials", "transportation"),
        asset_classes=("equity", "commodity"),
        regime_tags=("risk_on", "volatility_compression"),
        pressure_score=42.0,
        conviction_bias=0.8,
        fragility_bias=-0.6,
        shock_bias=0.8,
        reason_code="EVENT_GEOPOLITICAL_DEESCALATION",
    ),
    ClassificationRule(
        event_type="earnings_guidance",
        category="company",
        keywords=("earnings", "guidance", "quarterly results", "revenue", "profit", "net loss", "operating loss", "margin", "eps", "income"),
        impact_tags=("earnings_fragility", "company_catalyst"),
        sectors=(),
        asset_classes=("equity",),
        regime_tags=("event_sensitive",),
        pressure_score=58.0,
        conviction_bias=0.0,
        fragility_bias=1.8,
        shock_bias=2.6,
        reason_code="EVENT_EARNINGS_SENSITIVITY",
    ),
    ClassificationRule(
        event_type="earnings_beat",
        category="company",
        keywords=("earnings beat", "beats estimates", "beats expectations", "raises guidance", "guidance raise", "profit rises", "revenue rises"),
        impact_tags=("earnings_positive", "company_catalyst"),
        sectors=(),
        asset_classes=("equity",),
        regime_tags=("event_sensitive", "momentum_expansion"),
        pressure_score=44.0,
        conviction_bias=1.6,
        fragility_bias=0.8,
        shock_bias=2.4,
        reason_code="EVENT_EARNINGS_POSITIVE",
    ),
    ClassificationRule(
        event_type="earnings_miss",
        category="company",
        keywords=("earnings miss", "misses estimates", "misses expectations", "cuts guidance", "guidance cut", "profit falls", "loss widens", "revenue falls"),
        impact_tags=("earnings_negative", "company_catalyst"),
        sectors=(),
        asset_classes=("equity",),
        regime_tags=("event_sensitive", "fragility_pressure"),
        pressure_score=78.0,
        conviction_bias=-2.0,
        fragility_bias=3.8,
        shock_bias=3.2,
        reason_code="EVENT_EARNINGS_NEGATIVE",
    ),
    ClassificationRule(
        event_type="merger_acquisition",
        category="company",
        keywords=("acquisition", "acquires", "merger", "takeover", "buyout", "strategic combination", "deal to buy"),
        impact_tags=("m_and_a", "company_catalyst"),
        sectors=(),
        asset_classes=("equity",),
        regime_tags=("event_sensitive",),
        pressure_score=55.0,
        conviction_bias=0.8,
        fragility_bias=2.0,
        shock_bias=3.0,
        reason_code="EVENT_MERGER_ACQUISITION",
    ),
    ClassificationRule(
        event_type="investment_capex",
        category="company",
        keywords=("investment", "invests", "capital expenditure", "capex", "factory", "plant", "data center", "expansion plan"),
        impact_tags=("investment_catalyst", "company_catalyst"),
        sectors=("semiconductors", "technology", "energy", "industrials"),
        asset_classes=("equity",),
        regime_tags=("event_sensitive", "theme_momentum"),
        pressure_score=48.0,
        conviction_bias=0.8,
        fragility_bias=0.8,
        shock_bias=1.8,
        reason_code="EVENT_INVESTMENT_CATALYST",
    ),
    ClassificationRule(
        event_type="product_launch",
        category="company",
        keywords=("launches", "launch", "new product", "unveils", "introduces", "rollout", "product line"),
        impact_tags=("product_catalyst", "company_catalyst"),
        sectors=("technology", "semiconductors", "consumer discretionary", "healthcare"),
        asset_classes=("equity",),
        regime_tags=("event_sensitive", "theme_momentum"),
        pressure_score=50.0,
        conviction_bias=0.8,
        fragility_bias=1.0,
        shock_bias=1.8,
        reason_code="EVENT_PRODUCT_LAUNCH",
    ),
    ClassificationRule(
        event_type="regulatory_issue",
        category="company",
        keywords=(
            "antitrust",
            "class action",
            "compliance",
            "enforcement",
            "investigation",
            "investor deadline",
            "lawsuit",
            "lead plaintiff",
            "penalty",
            "regulation",
            "regulatory",
            "rulemaking",
            "sanction",
            "sec charges",
            "shareholder",
        ),
        impact_tags=("regulatory_risk",),
        sectors=("financial services", "crypto", "technology"),
        asset_classes=("equity", "crypto"),
        regime_tags=("event_sensitive", "risk_off"),
        pressure_score=74.0,
        conviction_bias=-1.2,
        fragility_bias=3.2,
        shock_bias=2.4,
        reason_code="EVENT_REGULATORY_RISK",
    ),
    ClassificationRule(
        event_type="crypto_macro",
        category="market",
        keywords=("bitcoin", "ether", "crypto", "digital asset", "spot etf", "stablecoin"),
        impact_tags=("crypto_context",),
        sectors=("crypto",),
        asset_classes=("crypto",),
        regime_tags=("event_sensitive",),
        pressure_score=58.0,
        conviction_bias=0.4,
        fragility_bias=1.8,
        shock_bias=2.6,
        reason_code="EVENT_CRYPTO_CONTEXT",
    ),
)
PEACE_CONTEXT_TERMS: Final[tuple[str, ...]] = ("peace talks", "ceasefire", "truce", "peace agreement", "negotiations", "talks")
FAILURE_TERMS: Final[tuple[str, ...]] = (
    "break down",
    "breakdown",
    "collapsed",
    "collapse",
    "failed",
    "fails",
    "fall apart",
    "no deal",
    "stalemate",
)
UPSIDE_SURPRISE_TERMS: Final[tuple[str, ...]] = (
    "above expectations",
    "above forecast",
    "above forecasts",
    "higher than expected",
    "hotter than expected",
    "more than expected",
    "stronger than expected",
    "unexpectedly rose",
    "rose more than expected",
    "came in hot",
)
DOWNSIDE_SURPRISE_TERMS: Final[tuple[str, ...]] = (
    "below expectations",
    "below forecast",
    "below forecasts",
    "cooler than expected",
    "less than expected",
    "lower than expected",
    "softer than expected",
    "unexpectedly fell",
    "fell more than expected",
    "came in cool",
)
FED_RATE_CONTEXT_TERMS: Final[tuple[str, ...]] = (
    "federal reserve",
    "fed",
    "fomc",
    "interest rate",
    "fed funds",
    "policy rate",
    "powell",
    "treasury yield",
    "yields",
)
INFLATION_CONTEXT_TERMS: Final[tuple[str, ...]] = (
    "consumer price",
    "producer price",
    "cpi",
    "ppi",
    "inflation",
    "price index",
)
EMPLOYMENT_CONTEXT_TERMS: Final[tuple[str, ...]] = (
    "employment",
    "jobs",
    "jobless",
    "jolts",
    "nonfarm",
    "payroll",
    "unemployment",
    "wages",
)
POSITIVE_COMPANY_TERMS: Final[tuple[str, ...]] = (
    "accelerates",
    "above expectations",
    "backlog grows",
    "beat",
    "beats",
    "better than expected",
    "demand accelerates",
    "expands margin",
    "margin expansion",
    "preorders exceed",
    "profit rises",
    "raises forecast",
    "raises guidance",
    "record revenue",
    "revenue rises",
    "strong demand",
    "tops estimates",
    "upgrade",
    "wins contract",
)
NEGATIVE_COMPANY_TERMS: Final[tuple[str, ...]] = (
    "below expectations",
    "cuts forecast",
    "cuts guidance",
    "delay",
    "delayed",
    "demand weakens",
    "downgrade",
    "investigation",
    "lawsuit",
    "loss widens",
    "margin compression",
    "miss",
    "misses",
    "probe",
    "profit falls",
    "recall",
    "regulatory scrutiny",
    "revenue falls",
    "weak demand",
)
PRODUCT_CONTEXT_TERMS: Final[tuple[str, ...]] = ("launch", "launches", "new product", "rollout", "unveils", "introduces", "product line")
INVESTMENT_CONTEXT_TERMS: Final[tuple[str, ...]] = ("investment", "invests", "capex", "capital expenditure", "factory", "plant", "data center", "expansion plan")
MNA_CONTEXT_TERMS: Final[tuple[str, ...]] = ("acquisition", "acquires", "merger", "takeover", "buyout", "deal to buy", "strategic combination")
EARNINGS_CONTEXT_TERMS: Final[tuple[str, ...]] = (
    "earnings",
    "guidance",
    "quarterly results",
    "revenue",
    "profit",
    "net loss",
    "operating loss",
    "margin",
    "eps",
    "income",
)
SHAREHOLDER_LITIGATION_TERMS: Final[tuple[str, ...]] = (
    "class action",
    "investor deadline",
    "investors with losses",
    "lead plaintiff",
    "securities fraud",
    "shareholder alert",
    "shareholder lawsuit",
)


def load_verified_event_context(cache_dir: Path | None, *, now: datetime | None = None) -> EventContext:
    current_time = now or datetime.now(timezone.utc)
    if not _event_intelligence_enabled():
        return _empty_context("disabled", current_time, "Verified event intelligence is disabled by environment configuration.")

    ttl = _cache_ttl_from_env()
    cached = _read_cached_payload(cache_dir, ttl, current_time)
    if cached is not None:
        return build_event_context(_events_from_payload(cached), cache_status="hit", now=current_time)

    stale_cached = _read_cached_payload(cache_dir, DEFAULT_STALE_CACHE_TTL, current_time)
    events = fetch_verified_events(now=current_time)
    if not events and stale_cached is not None:
        return build_event_context(_events_from_payload(stale_cached), cache_status="stale_fallback", now=current_time)

    _write_cached_payload(cache_dir, events, current_time)
    return build_event_context(events, cache_status="refresh", now=current_time)


def fetch_verified_events(*, now: datetime | None = None, feeds: tuple[TrustedEventFeed, ...] | None = None) -> list[VerifiedEvent]:
    current_time = now or datetime.now(timezone.utc)
    events: list[VerifiedEvent] = []
    for feed in feeds or _configured_event_feeds():
        events.extend(_fetch_feed_events(feed, current_time))
    events = _dedupe_events(events)
    events.sort(key=lambda event: event["published_at"], reverse=True)
    return events[:MAX_CONTEXT_EVENTS]


def build_event_context(events: list[VerifiedEvent], *, cache_status: str = "computed", now: datetime | None = None) -> EventContext:
    current_time = now or datetime.now(timezone.utc)
    recent_events = _recent_events(_dedupe_events(events), current_time)
    if not recent_events:
        return _empty_context("empty" if cache_status != "hit" else cache_status, current_time, "No recent verified macro/event feed items were available.")

    pressure = _weighted_average([(_event_pressure_with_decay(event), _event_quality_weight(event)) for event in recent_events], 50.0)
    event_types = _unique_strings([event_type for event in recent_events for event_type in event["event_types"]])
    sources = _unique_strings([event["source"] for event in recent_events])
    reason_codes = _unique_strings([code for event in recent_events for code in event["reason_codes"]])
    label = "elevated" if pressure >= 66.0 else "supportive" if pressure <= 42.0 else "mixed"
    return {
        "available": True,
        "cache_status": cache_status,
        "event_pressure_score": round(pressure, 2),
        "event_types": event_types,
        "events": recent_events,
        "generated_at": current_time.isoformat(),
        "macro_event_summary": f"Verified event context is {label} based on {len(recent_events)} recent trusted feed item{'' if len(recent_events) == 1 else 's'}.",
        "reason_codes": reason_codes,
        "sources_used": sources,
    }


def apply_event_intelligence(
    df: pd.DataFrame,
    context: EventContext,
    *,
    symbol_news: dict[str, list[dict[str, object]]] | None = None,
) -> pd.DataFrame:
    if df.empty:
        return df
    working = df.copy()
    rows = _records_from_dataframe(working)
    impacts = [event_impact_for_row(row, context, symbol_events=_symbol_news_events(row, symbol_news or {})) for row in rows]

    numeric_keys = (
        "event_confidence",
        "event_conviction_adjustment",
        "event_decay",
        "event_fragility_adjustment",
        "event_macro_pressure_adjustment",
        "event_risk_score",
        "event_shock_pressure_score",
        "event_source_weight",
        "verified_event_pressure_score",
    )
    object_keys = (
        "event_context_available",
        "event_context_label",
        "event_context_reason_codes",
        "event_context_summary",
        "event_impact_scope",
        "macro_event_regime_signature",
        "verified_event_recent_events",
        "verified_event_signature",
        "verified_event_sources_used",
    )
    for key in numeric_keys:
        working[key] = pd.Series([impact[key] for impact in impacts], index=working.index)
    for key in object_keys:
        working[key] = pd.Series([impact[key] for impact in impacts], index=working.index, dtype="object")

    if "factor_scores" in working.columns:
        working["factor_scores"] = pd.Series(
            [_factor_scores_with_event(row.get("factor_scores"), impacts[index]) for index, row in enumerate(rows)],
            index=working.index,
            dtype="object",
        )
    return working


def event_impact_for_row(row: dict[str, object], context: EventContext, *, symbol_events: list[VerifiedEvent] | None = None) -> EventImpact:
    available_events = [*context["events"], *_row_earnings_events(row), *(symbol_events or [])]
    if not context["available"] and not available_events:
        return _empty_impact(context)

    matched = _matched_events(row, available_events)
    if not matched:
        return _neutral_impact(row, context)

    total_weight = max(1.0, sum(weight for _, weight, _ in matched))
    pressure = _weighted_average([(event["pressure_score"], weight) for event, weight, _ in matched], context["event_pressure_score"])
    conviction = _clamp(sum(event["conviction_bias"] * weight for event, weight, _ in matched) / total_weight * 2.0, -4.0, 3.0)
    fragility = _clamp(sum(max(-1.5, event["fragility_bias"]) * weight for event, weight, _ in matched) / total_weight * 2.0, 0.0, 6.0)
    shock = _clamp(50.0 + sum(event["shock_bias"] * weight for event, weight, _ in matched) / total_weight * 11.0, 0.0, 100.0)
    risk_score = _clamp(pressure * 0.62 + shock * 0.24 + fragility * 5.0)
    macro_adjustment = _clamp(conviction * 0.65 - fragility * 0.35, -3.0, 2.0)
    event_confidence = _weighted_average([(event["event_confidence"], weight) for event, weight, _ in matched], 50.0)
    event_decay = _weighted_average([(event["event_decay"], weight) for event, weight, _ in matched], 0.5)
    source_weight = _weighted_average([(event["source_weight"], weight) for event, weight, _ in matched], 0.75)
    event_types = _unique_strings([event_type for event, _, _ in matched for event_type in event["event_types"]])
    scopes = _unique_strings([scope for _, _, scope in matched])
    reason_codes = _impact_reason_codes(matched, risk_score, conviction, fragility, shock)
    label = _impact_label(conviction, risk_score, fragility)
    recent_events = [_event_summary(event, scope, weight) for event, weight, scope in matched[:MAX_RECENT_EVENTS_PER_ROW]]
    sources_used = _unique_strings([*context["sources_used"], *[event["source"] for event in available_events]])
    signature = "|".join(event_types[:6])
    return {
        "event_context_available": True,
        "event_context_label": label,
        "event_context_reason_codes": reason_codes,
        "event_context_summary": _impact_summary(label, matched, event_types, risk_score, conviction, fragility),
        "event_confidence": round(event_confidence, 2),
        "event_conviction_adjustment": round(conviction, 2),
        "event_decay": round(event_decay, 3),
        "event_fragility_adjustment": round(fragility, 2),
        "event_impact_scope": ", ".join(scopes) if scopes else "broad",
        "event_macro_pressure_adjustment": round(macro_adjustment, 2),
        "event_risk_score": round(risk_score, 2),
        "event_shock_pressure_score": round(shock, 2),
        "event_source_weight": round(source_weight, 3),
        "macro_event_regime_signature": _macro_event_signature(row, signature),
        "verified_event_pressure_score": round(pressure, 2),
        "verified_event_recent_events": recent_events,
        "verified_event_signature": signature,
        "verified_event_sources_used": sources_used,
    }


def _symbol_news_events(row: dict[str, object], symbol_news: dict[str, list[dict[str, object]]]) -> list[VerifiedEvent]:
    symbol = _normalize_symbol(row.get("symbol"))
    if not symbol:
        return []
    items = symbol_news.get(symbol) or symbol_news.get(symbol.upper()) or []
    events: list[VerifiedEvent] = []
    for item in items[:6]:
        title = safe_str(item.get("title"), "")
        summary = safe_str(item.get("summary"), "")
        source = safe_str(item.get("source"), "")
        source_url = safe_str(item.get("url"), "")
        provider_key = source.lower().strip()
        if not title or not source_url or not provider_key:
            continue
        if provider_key not in TRUSTED_NEWS_PROVIDERS:
            continue
        published = _parse_datetime(item.get("published_at")) or datetime.now(timezone.utc)
        if not _is_allowed_source_url(source_url):
            continue
        feed = TrustedEventFeed(key=f"symbol_news_{symbol.lower()}", name=source, url=source_url, category_hint="company", source_weight=_provider_source_weight(source))
        event = classify_verified_event(feed, title, summary, source_url, published)
        if _event_decay(event, datetime.now(timezone.utc)) >= MIN_EVENT_DECAY:
            events.append(event)
    return events


def write_verified_event_context(outdir: Path, context: EventContext) -> Path:
    analysis_dir = outdir / "analysis"
    analysis_dir.mkdir(parents=True, exist_ok=True)
    path = analysis_dir / "verified_event_context.json"
    tmp_path = path.with_name(f"{path.name}.{os.getpid()}.{datetime.now(timezone.utc).timestamp():.6f}.tmp")
    try:
        tmp_path.write_text(json.dumps(_jsonable(context), indent=2, sort_keys=True), encoding="utf-8")
        tmp_path.replace(path)
    finally:
        tmp_path.unlink(missing_ok=True)
    return path


def _fetch_feed_events(feed: TrustedEventFeed, now: datetime) -> list[VerifiedEvent]:
    if not _is_allowed_source_url(feed.url):
        return []
    try:
        request = urllib.request.Request(
            feed.url,
            headers={
                "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
                "User-Agent": "TradeVetoEventIntelligence/1.0 (+https://tradeveto.com)",
            },
        )
        with urllib.request.urlopen(request, timeout=8) as response:
            body = response.read(2_000_000)
    except Exception:
        return []

    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return []

    events: list[VerifiedEvent] = []
    for item in _feed_items(root):
        title = _text_from_child(item, ("title",))
        summary = _clean_html(_text_from_child(item, ("description", "summary", "content", "encoded")))
        source_url = _absolute_event_url(feed.url, _event_url(item))
        published_at = _published_at(item, now)
        if not title or not source_url or published_at is None:
            continue
        if not _is_allowed_source_url(source_url):
            continue
        if now - published_at > timedelta(days=DEFAULT_LOOKBACK_DAYS):
            continue
        event = classify_verified_event(feed, title, summary, source_url, published_at)
        event["event_decay"] = _event_decay(event, now)
        if event["event_decay"] < MIN_EVENT_DECAY:
            continue
        events.append(event)
        if len(events) >= DEFAULT_FEED_LIMIT:
            break
    return events


def classify_verified_event(feed: TrustedEventFeed, title: str, summary: str, source_url: str, published_at: datetime) -> VerifiedEvent:
    text = f"{title} {summary}".lower()
    matched_rules = [rule for rule in CLASSIFICATION_RULES if _rule_matches(text, rule)]
    directional_rules = _directional_classification_rules(text)
    if directional_rules:
        matched_rules = _apply_directional_overrides(matched_rules, directional_rules)
    llm_assessment = analyze_verified_event_with_llm(
        source=feed.name,
        title=title,
        summary=summary,
        source_url=source_url,
        published_at=published_at,
    )
    if not matched_rules:
        matched_rules = [
            ClassificationRule(
                event_type="verified_update",
                category=feed.category_hint,
                keywords=(),
                impact_tags=("verified_source",),
                sectors=(),
                asset_classes=(),
                regime_tags=("event_context",),
                pressure_score=50.0,
                conviction_bias=0.0,
                fragility_bias=0.0,
                shock_bias=0.0,
                reason_code="VERIFIED_EVENT_SOURCE",
            )
        ]

    event_types = _unique_strings([rule.event_type for rule in matched_rules])
    categories = _unique_strings([rule.category for rule in matched_rules])
    asset_classes = _unique_strings([asset_class for rule in matched_rules for asset_class in rule.asset_classes])
    impact_tags = _unique_strings([tag for rule in matched_rules for tag in rule.impact_tags])
    reason_codes = _unique_strings([rule.reason_code for rule in matched_rules])
    regime_tags = _unique_strings([tag for rule in matched_rules for tag in rule.regime_tags])
    sectors = _unique_strings([sector for rule in matched_rules for sector in rule.sectors])
    pressure = _average([rule.pressure_score for rule in matched_rules], 50.0)
    conviction_bias = _average([rule.conviction_bias for rule in matched_rules], 0.0)
    fragility_bias = _average([rule.fragility_bias for rule in matched_rules], 0.0)
    shock_bias = _average([rule.shock_bias for rule in matched_rules], 0.0)
    direction = _direction_from_scores(conviction_bias, fragility_bias, pressure)
    evidence_phrases: list[str] = []
    confidence = _base_event_confidence(feed, source_url)
    if llm_assessment is not None:
        event_types = _unique_strings([*event_types, llm_assessment["event_type"]])
        categories = _unique_strings([*categories, llm_assessment["category"]])
        asset_classes = _unique_strings([*asset_classes, *llm_assessment["asset_classes"]])
        impact_tags = _unique_strings([*impact_tags, *llm_assessment["impact_tags"], "llm_verified_interpretation"])
        reason_codes = _unique_strings([*reason_codes, *llm_assessment["reason_codes"], "EVENT_LLM_VERIFIED_CONTEXT"])
        regime_tags = _unique_strings([*regime_tags, *llm_assessment["regime_tags"]])
        sectors = _unique_strings([*sectors, *llm_assessment["sectors"]])
        pressure = _average([pressure, llm_assessment["pressure_score"]], pressure)
        conviction_bias = _average([conviction_bias, llm_assessment["conviction_bias"]], conviction_bias)
        fragility_bias = _average([fragility_bias, llm_assessment["fragility_bias"]], fragility_bias)
        shock_bias = _average([shock_bias, llm_assessment["shock_bias"]], shock_bias)
        direction = llm_assessment["direction"]
        evidence_phrases = llm_assessment["evidence_phrases"]
        confidence = max(confidence, round(llm_assessment["confidence"] * 100.0, 2))
    return {
        "affected_sectors": sectors,
        "affected_symbols": _symbols_from_text(text),
        "asset_classes": asset_classes,
        "category": categories[0] if categories else feed.category_hint,
        "confidence": confidence,
        "conviction_bias": round(conviction_bias, 2),
        "direction": direction,
        "event_confidence": confidence,
        "event_decay": 1.0,
        "event_direction": direction,
        "event_id": _event_id(feed.key, source_url, title, published_at),
        "event_type": event_types[0] if event_types else "verified_update",
        "event_types": event_types,
        "evidence_phrases": evidence_phrases,
        "feed_key": feed.key,
        "fragility_bias": round(fragility_bias, 2),
        "impact_tags": impact_tags,
        "pressure_score": round(pressure, 2),
        "published_at": published_at.astimezone(timezone.utc).isoformat(),
        "reason_codes": reason_codes,
        "regime_tags": regime_tags,
        "sectors": sectors,
        "shock_bias": round(shock_bias, 2),
        "source": feed.name,
        "source_name": feed.name,
        "source_url": source_url,
        "source_weight": round(_clamp(feed.source_weight, 0.2, 1.0), 3),
        "summary": summary[:420],
        "title": title[:220],
    }


def _apply_directional_overrides(matched_rules: list[ClassificationRule], directional_rules: list[ClassificationRule]) -> list[ClassificationRule]:
    filtered = matched_rules
    directional_types = {rule.event_type for rule in directional_rules}
    if "failed_peace_talks" in directional_types:
        filtered = [rule for rule in filtered if rule.event_type != "peace_deescalation"]
    if "hawkish_rate_surprise" in directional_types or "hot_inflation_surprise" in directional_types:
        filtered = [rule for rule in filtered if rule.event_type != "liquidity_easing"]
    if "cooling_inflation_surprise" in directional_types or "dovish_rate_surprise" in directional_types:
        filtered = [rule for rule in filtered if rule.event_type not in {"liquidity_tightening", "volatility_expansion"}]
    if directional_types.intersection({"earnings_positive_surprise", "positive_product_catalyst", "positive_investment_catalyst", "mna_positive"}):
        filtered = [rule for rule in filtered if rule.event_type not in {"earnings_miss", "regulatory_issue"}]
    if directional_types.intersection({"earnings_negative_surprise", "negative_product_catalyst", "negative_investment_catalyst", "mna_negative"}):
        filtered = [rule for rule in filtered if rule.event_type != "earnings_beat"]
    if "shareholder_litigation" in directional_types:
        filtered = [rule for rule in filtered if rule.event_type not in {"earnings_guidance", "earnings_beat", "earnings_miss"}]
    return [*filtered, *directional_rules]


def _directional_classification_rules(text: str) -> list[ClassificationRule]:
    rules: list[ClassificationRule] = []
    if _has_any(text, PEACE_CONTEXT_TERMS) and _has_any(text, FAILURE_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="failed_peace_talks",
                category="geopolitical",
                impact_tags=("geopolitical_risk", "risk_off"),
                sectors=("energy", "defense", "commodities"),
                asset_classes=("equity", "commodity", "crypto"),
                regime_tags=("risk_off", "volatility_expansion"),
                pressure_score=84.0,
                conviction_bias=-2.0,
                fragility_bias=3.8,
                shock_bias=3.6,
                reason_code="EVENT_FAILED_PEACE_TALKS",
            )
        )
    if _has_any(text, FED_RATE_CONTEXT_TERMS) and (_has_any(text, UPSIDE_SURPRISE_TERMS) or "higher for longer" in text or "hawkish" in text):
        rules.append(
            _synthetic_rule(
                event_type="hawkish_rate_surprise",
                category="macro",
                impact_tags=("rates_sensitive", "liquidity_tightening"),
                sectors=("technology", "software", "financial services", "real estate"),
                asset_classes=("equity", "crypto", "growth"),
                regime_tags=("liquidity_tightening", "macro_pressure"),
                pressure_score=82.0,
                conviction_bias=-2.0,
                fragility_bias=3.4,
                shock_bias=2.6,
                reason_code="EVENT_HAWKISH_RATE_SURPRISE",
            )
        )
    if _has_any(text, FED_RATE_CONTEXT_TERMS) and (_has_any(text, DOWNSIDE_SURPRISE_TERMS) or "dovish" in text):
        rules.append(
            _synthetic_rule(
                event_type="dovish_rate_surprise",
                category="macro",
                impact_tags=("liquidity_supportive", "risk_appetite"),
                sectors=("technology", "software", "semiconductors", "crypto", "small cap"),
                asset_classes=("equity", "crypto", "growth"),
                regime_tags=("liquidity_supportive", "risk_on"),
                pressure_score=36.0,
                conviction_bias=1.6,
                fragility_bias=-0.8,
                shock_bias=1.4,
                reason_code="EVENT_DOVISH_RATE_SURPRISE",
            )
        )
    if _has_any(text, INFLATION_CONTEXT_TERMS) and _has_any(text, UPSIDE_SURPRISE_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="hot_inflation_surprise",
                category="macro",
                impact_tags=("inflation_pressure", "rates_sensitive"),
                sectors=("technology", "software", "consumer discretionary", "financial services"),
                asset_classes=("equity", "growth", "crypto"),
                regime_tags=("liquidity_tightening", "macro_pressure"),
                pressure_score=84.0,
                conviction_bias=-2.0,
                fragility_bias=3.6,
                shock_bias=3.0,
                reason_code="EVENT_HOT_INFLATION_SURPRISE",
            )
        )
    if _has_any(text, INFLATION_CONTEXT_TERMS) and _has_any(text, DOWNSIDE_SURPRISE_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="cooling_inflation_surprise",
                category="macro",
                impact_tags=("inflation_cooling", "liquidity_supportive"),
                sectors=("technology", "software", "semiconductors", "consumer discretionary"),
                asset_classes=("equity", "growth", "crypto"),
                regime_tags=("liquidity_supportive", "risk_on"),
                pressure_score=38.0,
                conviction_bias=1.2,
                fragility_bias=-0.6,
                shock_bias=1.2,
                reason_code="EVENT_COOLING_INFLATION_SURPRISE",
            )
        )
    if _has_any(text, EMPLOYMENT_CONTEXT_TERMS) and "unemployment" in text and _has_any(text, UPSIDE_SURPRISE_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="unemployment_upside_surprise",
                category="macro",
                impact_tags=("employment_weakness", "growth_pressure"),
                sectors=("consumer discretionary", "technology", "financial services"),
                asset_classes=("equity", "growth"),
                regime_tags=("risk_off", "macro_pressure"),
                pressure_score=78.0,
                conviction_bias=-1.4,
                fragility_bias=2.8,
                shock_bias=2.2,
                reason_code="EVENT_UNEMPLOYMENT_SURPRISE",
            )
        )
    if _has_any(text, EMPLOYMENT_CONTEXT_TERMS) and _has_any(text, UPSIDE_SURPRISE_TERMS) and "unemployment" not in text:
        rules.append(
            _synthetic_rule(
                event_type="strong_labor_rate_pressure",
                category="macro",
                impact_tags=("employment_strength", "rates_sensitive"),
                sectors=("technology", "software", "financial services", "consumer discretionary"),
                asset_classes=("equity", "growth"),
                regime_tags=("macro_pressure", "liquidity_tightening"),
                pressure_score=68.0,
                conviction_bias=-0.8,
                fragility_bias=1.8,
                shock_bias=1.6,
                reason_code="EVENT_STRONG_LABOR_RATE_PRESSURE",
            )
        )
    if _has_any(text, EARNINGS_CONTEXT_TERMS) and _has_any(text, POSITIVE_COMPANY_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="earnings_positive_surprise",
                category="company",
                impact_tags=("earnings_positive", "company_catalyst"),
                sectors=(),
                asset_classes=("equity",),
                regime_tags=("event_sensitive", "momentum_expansion"),
                pressure_score=38.0,
                conviction_bias=2.0,
                fragility_bias=0.4,
                shock_bias=2.2,
                reason_code="EVENT_EARNINGS_POSITIVE_SURPRISE",
            )
        )
    if _has_any(text, EARNINGS_CONTEXT_TERMS) and _has_any(text, NEGATIVE_COMPANY_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="earnings_negative_surprise",
                category="company",
                impact_tags=("earnings_negative", "company_catalyst"),
                sectors=(),
                asset_classes=("equity",),
                regime_tags=("event_sensitive", "fragility_pressure"),
                pressure_score=82.0,
                conviction_bias=-2.4,
                fragility_bias=4.0,
                shock_bias=3.4,
                reason_code="EVENT_EARNINGS_NEGATIVE_SURPRISE",
            )
        )
    if _has_any(text, SHAREHOLDER_LITIGATION_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="shareholder_litigation",
                category="company",
                impact_tags=("shareholder_litigation", "company_catalyst"),
                sectors=(),
                asset_classes=("equity",),
                regime_tags=("event_sensitive", "fragility_pressure"),
                pressure_score=70.0,
                conviction_bias=-1.0,
                fragility_bias=2.8,
                shock_bias=2.0,
                reason_code="EVENT_SHAREHOLDER_LITIGATION",
            )
        )
    if _has_any(text, PRODUCT_CONTEXT_TERMS) and _has_any(text, POSITIVE_COMPANY_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="positive_product_catalyst",
                category="company",
                impact_tags=("product_catalyst_positive", "company_catalyst"),
                sectors=("technology", "semiconductors", "consumer discretionary", "healthcare"),
                asset_classes=("equity",),
                regime_tags=("event_sensitive", "theme_momentum"),
                pressure_score=40.0,
                conviction_bias=1.6,
                fragility_bias=0.5,
                shock_bias=2.0,
                reason_code="EVENT_PRODUCT_CATALYST_POSITIVE",
            )
        )
    if _has_any(text, PRODUCT_CONTEXT_TERMS) and _has_any(text, NEGATIVE_COMPANY_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="negative_product_catalyst",
                category="company",
                impact_tags=("product_catalyst_negative", "company_catalyst"),
                sectors=("technology", "semiconductors", "consumer discretionary", "healthcare"),
                asset_classes=("equity",),
                regime_tags=("event_sensitive", "fragility_pressure"),
                pressure_score=78.0,
                conviction_bias=-1.8,
                fragility_bias=3.2,
                shock_bias=2.8,
                reason_code="EVENT_PRODUCT_CATALYST_NEGATIVE",
            )
        )
    if _has_any(text, INVESTMENT_CONTEXT_TERMS) and _has_any(text, POSITIVE_COMPANY_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="positive_investment_catalyst",
                category="company",
                impact_tags=("investment_catalyst_positive", "company_catalyst"),
                sectors=("semiconductors", "technology", "energy", "industrials"),
                asset_classes=("equity",),
                regime_tags=("event_sensitive", "theme_momentum"),
                pressure_score=42.0,
                conviction_bias=1.2,
                fragility_bias=0.5,
                shock_bias=1.8,
                reason_code="EVENT_INVESTMENT_POSITIVE",
            )
        )
    if _has_any(text, INVESTMENT_CONTEXT_TERMS) and _has_any(text, NEGATIVE_COMPANY_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="negative_investment_catalyst",
                category="company",
                impact_tags=("investment_catalyst_negative", "company_catalyst"),
                sectors=("semiconductors", "technology", "energy", "industrials"),
                asset_classes=("equity",),
                regime_tags=("event_sensitive", "fragility_pressure"),
                pressure_score=72.0,
                conviction_bias=-1.4,
                fragility_bias=2.8,
                shock_bias=2.2,
                reason_code="EVENT_INVESTMENT_NEGATIVE",
            )
        )
    if _has_any(text, MNA_CONTEXT_TERMS) and _has_any(text, POSITIVE_COMPANY_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="mna_positive",
                category="company",
                impact_tags=("m_and_a_positive", "company_catalyst"),
                sectors=(),
                asset_classes=("equity",),
                regime_tags=("event_sensitive",),
                pressure_score=42.0,
                conviction_bias=1.2,
                fragility_bias=1.2,
                shock_bias=2.8,
                reason_code="EVENT_MNA_POSITIVE",
            )
        )
    if _has_any(text, MNA_CONTEXT_TERMS) and _has_any(text, NEGATIVE_COMPANY_TERMS):
        rules.append(
            _synthetic_rule(
                event_type="mna_negative",
                category="company",
                impact_tags=("m_and_a_negative", "company_catalyst"),
                sectors=(),
                asset_classes=("equity",),
                regime_tags=("event_sensitive", "fragility_pressure"),
                pressure_score=74.0,
                conviction_bias=-1.2,
                fragility_bias=2.8,
                shock_bias=3.0,
                reason_code="EVENT_MNA_NEGATIVE",
            )
        )
    return rules


def _synthetic_rule(
    *,
    event_type: str,
    category: str,
    impact_tags: tuple[str, ...],
    sectors: tuple[str, ...],
    asset_classes: tuple[str, ...],
    regime_tags: tuple[str, ...],
    pressure_score: float,
    conviction_bias: float,
    fragility_bias: float,
    shock_bias: float,
    reason_code: str,
) -> ClassificationRule:
    return ClassificationRule(
        event_type=event_type,
        category=category,
        keywords=(),
        impact_tags=impact_tags,
        sectors=sectors,
        asset_classes=asset_classes,
        regime_tags=regime_tags,
        pressure_score=pressure_score,
        conviction_bias=conviction_bias,
        fragility_bias=fragility_bias,
        shock_bias=shock_bias,
        reason_code=reason_code,
    )


def _matched_events(row: dict[str, object], events: list[VerifiedEvent]) -> list[tuple[VerifiedEvent, float, str]]:
    matches: list[tuple[VerifiedEvent, float, str]] = []
    current_time = datetime.now(timezone.utc)
    for event in events:
        weight, scope = _event_row_weight(row, event)
        if weight <= 0.0:
            continue
        event["event_decay"] = _event_decay(event, current_time)
        if event["event_decay"] < MIN_EVENT_DECAY:
            continue
        weight *= _event_quality_weight(event)
        if weight <= 0.0:
            continue
        matches.append((event, weight, scope))
    matches.sort(key=lambda item: (item[1], item[0]["pressure_score"], item[0]["published_at"]), reverse=True)
    return matches[:8]


def _event_row_weight(row: dict[str, object], event: VerifiedEvent) -> tuple[float, str]:
    symbol = _normalize_symbol(row.get("symbol"))
    sector = safe_str(row.get("sector"), "").lower()
    asset_type = safe_str(row.get("asset_type"), "").lower()
    group = _symbol_group(row)
    title_text = f"{event['title']} {event['summary']}".upper()

    if symbol and symbol in event.get("affected_symbols", []):
        return 1.0, "symbol"
    if symbol and re.search(rf"\b{re.escape(symbol)}\b", title_text):
        return 1.0, "symbol"
    if _generic_verified_event(event):
        return 0.0, ""
    if group and group in event["sectors"]:
        return 0.92, "sector"
    if sector and any(sector_key in sector for sector_key in event["sectors"]):
        return 0.86, "sector"
    if event["category"] == "company":
        return 0.0, ""
    if "crypto" in asset_type and "crypto" in event["asset_classes"]:
        return 0.86, "asset"
    if "equity" in asset_type and "equity" in event["asset_classes"]:
        return 0.58, "asset"
    if event["category"] in {"macro", "market", "geopolitical"}:
        return 0.48, "broad"
    return 0.0, ""


def _generic_verified_event(event: VerifiedEvent) -> bool:
    meaningful_codes = [code for code in event["reason_codes"] if code != "VERIFIED_EVENT_SOURCE"]
    return event["event_type"] == "verified_update" and not meaningful_codes


def _row_earnings_events(row: dict[str, object]) -> list[VerifiedEvent]:
    symbol = _normalize_symbol(row.get("symbol"))
    earnings_date_text = safe_str(row.get("earnings_date"), "")
    if not symbol or not earnings_date_text:
        return []
    try:
        earnings_date = datetime.fromisoformat(earnings_date_text).replace(tzinfo=timezone.utc)
    except ValueError:
        try:
            earnings_date = datetime.fromisoformat(f"{earnings_date_text}T00:00:00+00:00")
        except ValueError:
            return []
    now = datetime.now(timezone.utc)
    days_until_event = (earnings_date.date() - now.date()).days
    if days_until_event < -2 or days_until_event > 21:
        return []
    source_url = f"https://finance.yahoo.com/quote/{symbol}"
    feed = TrustedEventFeed(
        key=f"earnings_calendar_{symbol.lower()}",
        name="Yahoo Finance Earnings Calendar",
        url=source_url,
        category_hint="company",
        source_weight=0.72,
    )
    title = f"{symbol} earnings calendar event"
    summary = f"{symbol} has an earnings date within {days_until_event} calendar day{'' if abs(days_until_event) == 1 else 's'}."
    event = classify_verified_event(feed, title, summary, source_url, now)
    event["affected_symbols"] = [symbol]
    event["event_type"] = "earnings_calendar"
    event["event_types"] = _unique_strings(["earnings_calendar", *event["event_types"]])
    event["reason_codes"] = _unique_strings(["EVENT_EARNINGS_CALENDAR", *event["reason_codes"]])
    event["event_confidence"] = 72.0
    event["confidence"] = 72.0
    event["source_weight"] = 0.72
    event["event_decay"] = _earnings_event_decay(days_until_event)
    event["pressure_score"] = round(_clamp(54.0 + max(0, 7 - abs(days_until_event)) * 2.6), 2)
    event["fragility_bias"] = round(_clamp(1.1 + max(0, 7 - abs(days_until_event)) * 0.32, 0.0, 4.0), 2)
    event["shock_bias"] = round(_clamp(1.8 + max(0, 7 - abs(days_until_event)) * 0.22, 0.0, 4.0), 2)
    return [event]


def _symbol_group(row: dict[str, object]) -> str:
    symbol = _normalize_symbol(row.get("symbol"))
    sector = safe_str(row.get("sector"), "").lower()
    asset_type = safe_str(row.get("asset_type"), "").lower()
    if "crypto" in asset_type or symbol in CRYPTO_PROXIES:
        return "crypto"
    if symbol in SEMICONDUCTOR_SYMBOLS:
        return "semiconductors"
    if symbol in SOFTWARE_SYMBOLS:
        return "software"
    if symbol in OIL_PROXIES or "energy" in sector:
        return "energy"
    if symbol in GOLD_PROXIES or "gold" in sector or "metal" in sector:
        return "commodities"
    if symbol in FINANCIAL_SYMBOLS or "financial" in sector:
        return "financial services"
    if "technology" in sector:
        return "technology"
    return sector


def _factor_scores_with_event(value: object, impact: EventImpact) -> object:
    if not isinstance(value, dict):
        return value
    updated = {str(key): item for key, item in value.items()}
    event_score = _clamp(100.0 - impact["event_risk_score"] + impact["event_conviction_adjustment"] * 4.0)
    macro_score = safe_float(updated.get("macro"), np.nan)
    if not np.isnan(macro_score):
        updated["macro"] = round(_clamp(macro_score + impact["event_macro_pressure_adjustment"]), 2)
    updated["event"] = round(event_score, 2)
    return updated


def _empty_context(cache_status: str, now: datetime, summary: str) -> EventContext:
    return {
        "available": False,
        "cache_status": cache_status,
        "event_pressure_score": 50.0,
        "event_types": [],
        "events": [],
        "generated_at": now.isoformat(),
        "macro_event_summary": summary,
        "reason_codes": [],
        "sources_used": [],
    }


def _empty_impact(context: EventContext) -> EventImpact:
    return {
        "event_context_available": False,
        "event_context_label": "Event Context Limited",
        "event_context_reason_codes": [],
        "event_context_summary": context["macro_event_summary"],
        "event_confidence": 0.0,
        "event_conviction_adjustment": 0.0,
        "event_decay": 0.0,
        "event_fragility_adjustment": 0.0,
        "event_impact_scope": "unavailable",
        "event_macro_pressure_adjustment": 0.0,
        "event_risk_score": 50.0,
        "event_shock_pressure_score": 50.0,
        "event_source_weight": 0.0,
        "macro_event_regime_signature": "",
        "verified_event_pressure_score": 50.0,
        "verified_event_recent_events": [],
        "verified_event_signature": "",
        "verified_event_sources_used": context["sources_used"],
    }


def _neutral_impact(row: dict[str, object], context: EventContext) -> EventImpact:
    event_types = context["event_types"][:4]
    signature = "|".join(event_types)
    return {
        "event_context_available": True,
        "event_context_label": "Event Context Mixed",
        "event_context_reason_codes": ["VERIFIED_EVENT_CONTEXT_AVAILABLE"],
        "event_context_summary": "Verified event context is available, but no recent trusted event strongly maps to this symbol or sector.",
        "event_confidence": 0.0,
        "event_conviction_adjustment": 0.0,
        "event_decay": 0.0,
        "event_fragility_adjustment": 0.0,
        "event_impact_scope": "broad",
        "event_macro_pressure_adjustment": 0.0,
        "event_risk_score": round(context["event_pressure_score"], 2),
        "event_shock_pressure_score": 50.0,
        "event_source_weight": 0.0,
        "macro_event_regime_signature": _macro_event_signature(row, signature),
        "verified_event_pressure_score": round(context["event_pressure_score"], 2),
        "verified_event_recent_events": [],
        "verified_event_signature": signature,
        "verified_event_sources_used": context["sources_used"],
    }


def _impact_reason_codes(
    matched: list[tuple[VerifiedEvent, float, str]],
    risk_score: float,
    conviction: float,
    fragility: float,
    shock: float,
) -> list[str]:
    codes = [code for event, _, _ in matched for code in event["reason_codes"]]
    scopes = {scope for _, _, scope in matched}
    if "symbol" in scopes:
        codes.append("EVENT_SYMBOL_MATCH")
    elif "sector" in scopes:
        codes.append("EVENT_SECTOR_MATCH")
    else:
        codes.append("EVENT_BROAD_MACRO")
    if conviction >= 0.75:
        codes.append("EVENT_CONTEXT_SUPPORTIVE")
    if risk_score >= 66.0 or fragility >= 2.5:
        codes.append("EVENT_RISK_ELEVATED")
    if shock >= 66.0:
        codes.append("EVENT_SHOCK_PRESSURE")
    if fragility >= 4.0:
        codes.append("EVENT_FRAGILITY_PRESSURE")
    return _unique_strings(codes)


def _impact_label(conviction: float, risk_score: float, fragility: float) -> str:
    if risk_score >= 70.0 or fragility >= 4.0:
        return "Event Risk Elevated"
    if conviction >= 1.0 and risk_score < 62.0:
        return "Verified Event Supportive"
    if risk_score >= 60.0:
        return "Macro Event Pressure"
    return "Event Context Mixed"


def _impact_summary(
    label: str,
    matched: list[tuple[VerifiedEvent, float, str]],
    event_types: list[str],
    risk_score: float,
    conviction: float,
    fragility: float,
) -> str:
    type_text = ", ".join(_title_label(event_type) for event_type in event_types[:3]) or "verified events"
    direction = "supports conviction" if conviction >= 0.75 and fragility < 2.5 else "raises fragility" if fragility >= 2.5 else "keeps context mixed"
    return (
        f"{label}: {len(matched)} verified event item{'' if len(matched) == 1 else 's'} mapped to this setup. "
        f"Confirmed event context {direction}; key context: {type_text}. "
        f"Event risk {risk_score:.0f}/100. This is probabilistic context, not a forecast."
    )


def _event_summary(event: VerifiedEvent, scope: str, weight: float) -> dict[str, object]:
    return {
        "affected_sectors": event.get("affected_sectors", []),
        "affected_symbols": event.get("affected_symbols", []),
        "direction": event.get("direction", "mixed"),
        "event_confidence": event.get("event_confidence", event.get("confidence", 0.0)),
        "event_decay": event.get("event_decay", 1.0),
        "event_direction": event.get("event_direction", event.get("direction", "mixed")),
        "event_type": event["event_types"][0] if event["event_types"] else "verified_update",
        "evidence_phrases": event.get("evidence_phrases", []),
        "published_at": event["published_at"],
        "reason_codes": event["reason_codes"],
        "scope": scope,
        "source": event["source"],
        "source_name": event.get("source_name", event["source"]),
        "source_url": event["source_url"],
        "source_weight": event.get("source_weight", 0.0),
        "title": event["title"],
        "weight": round(weight, 2),
    }


def _macro_event_signature(row: dict[str, object], event_signature: str) -> str:
    regime = safe_str(row.get("market_regime"), "unknown").lower()
    macro_label = safe_str(row.get("macro_context_label"), "unknown").lower().replace(" ", "_")
    if not event_signature:
        return f"{regime}|{macro_label}"
    return f"{regime}|{macro_label}|{event_signature}"


def _direction_from_scores(conviction_bias: float, fragility_bias: float, pressure: float) -> str:
    if conviction_bias >= 0.75 and pressure <= 55.0 and fragility_bias < 2.0:
        return "positive"
    if fragility_bias >= 2.5 or pressure >= 68.0:
        return "negative"
    if conviction_bias > 0.5 and fragility_bias >= 2.0:
        return "mixed"
    if pressure <= 42.0:
        return "risk_reducing"
    return "neutral"


def _feed_items(root: ET.Element) -> list[ET.Element]:
    items = [node for node in root.iter() if _local_name(node.tag) == "item"]
    if items:
        return items
    return [node for node in root.iter() if _local_name(node.tag) == "entry"]


def _text_from_child(element: ET.Element, names: tuple[str, ...]) -> str:
    for child in element.iter():
        if child is element:
            continue
        if _local_name(child.tag) in names and child.text:
            return child.text.strip()
    return ""


def _event_url(element: ET.Element) -> str:
    rss_link = _text_from_child(element, ("link",))
    if rss_link:
        return rss_link
    for child in element.iter():
        if _local_name(child.tag) != "link":
            continue
        href = child.attrib.get("href")
        if href:
            return href.strip()
    return ""


def _published_at(element: ET.Element, fallback: datetime) -> datetime | None:
    text = _text_from_child(element, ("pubDate", "published", "updated", "date"))
    if not text:
        return fallback
    try:
        parsed = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _rule_matches(text: str, rule: ClassificationRule) -> bool:
    return any(_keyword_matches(text, keyword) for keyword in rule.keywords)


def _keyword_matches(text: str, keyword: str) -> bool:
    normalized = keyword.strip().lower()
    if not normalized:
        return False
    if len(normalized) <= 3 and normalized.replace(" ", "").isalnum():
        return re.search(rf"(?<![a-z0-9]){re.escape(normalized)}(?![a-z0-9])", text) is not None
    return normalized in text


def _has_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def _recent_events(events: list[VerifiedEvent], now: datetime) -> list[VerifiedEvent]:
    recent: list[VerifiedEvent] = []
    for event in events:
        published = _parse_datetime(event.get("published_at"))
        if published is not None and now - published <= timedelta(days=DEFAULT_LOOKBACK_DAYS):
            event["event_decay"] = _event_decay(event, now)
            if event["event_decay"] < MIN_EVENT_DECAY:
                continue
            recent.append(event)
    return recent[:MAX_CONTEXT_EVENTS]


def _read_cached_payload(cache_dir: Path | None, max_age: timedelta, now: datetime) -> dict[str, object] | None:
    path = _event_cache_file(cache_dir)
    if path is None:
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    fetched_at = _parse_datetime(payload.get("fetched_at"))
    if fetched_at is None or now - fetched_at > max_age:
        return None
    return {str(key): value for key, value in payload.items()}


def _write_cached_payload(cache_dir: Path | None, events: list[VerifiedEvent], now: datetime) -> None:
    path = _event_cache_file(cache_dir)
    if path is None:
        return
    payload = {
        "events": events,
        "fetched_at": now.isoformat(),
        "sources": [feed.name for feed in _configured_event_feeds()],
    }
    tmp_path: Path | None = None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_name(f"{path.name}.{os.getpid()}.{now.timestamp():.6f}.tmp")
        tmp_path.write_text(json.dumps(_jsonable(payload), indent=2, sort_keys=True), encoding="utf-8")
        tmp_path.replace(path)
    except Exception:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)


def _events_from_payload(payload: dict[str, object]) -> list[VerifiedEvent]:
    raw_events = payload.get("events")
    if not isinstance(raw_events, list):
        return []
    events: list[VerifiedEvent] = []
    for raw_event in raw_events:
        if not isinstance(raw_event, dict):
            continue
        event = _event_from_mapping(raw_event)
        if event is not None:
            events.append(event)
    return events


def _event_from_mapping(raw_event: Mapping[object, object]) -> VerifiedEvent | None:
    title = safe_str(raw_event.get("title"), "")
    source_url = safe_str(raw_event.get("source_url"), "")
    published_at = safe_str(raw_event.get("published_at"), "")
    if not title or not source_url or not published_at:
        return None
    direction = safe_str(raw_event.get("direction"), "neutral")
    source = safe_str(raw_event.get("source"), "Verified source")
    event_types = _string_list(raw_event.get("event_types"))
    sectors = _string_list(raw_event.get("sectors"))
    confidence = safe_float(raw_event.get("confidence"), 70.0)
    return {
        "affected_sectors": _string_list(raw_event.get("affected_sectors")) or sectors,
        "affected_symbols": _string_list(raw_event.get("affected_symbols")),
        "asset_classes": _string_list(raw_event.get("asset_classes")),
        "category": safe_str(raw_event.get("category"), "market"),
        "confidence": confidence,
        "conviction_bias": safe_float(raw_event.get("conviction_bias"), 0.0),
        "direction": direction,
        "event_confidence": safe_float(raw_event.get("event_confidence"), confidence),
        "event_decay": safe_float(raw_event.get("event_decay"), 1.0),
        "event_direction": safe_str(raw_event.get("event_direction"), direction),
        "event_id": safe_str(raw_event.get("event_id"), ""),
        "event_type": safe_str(raw_event.get("event_type"), event_types[0] if event_types else "verified_update"),
        "event_types": event_types,
        "evidence_phrases": _string_list(raw_event.get("evidence_phrases")),
        "feed_key": safe_str(raw_event.get("feed_key"), ""),
        "fragility_bias": safe_float(raw_event.get("fragility_bias"), 0.0),
        "impact_tags": _string_list(raw_event.get("impact_tags")),
        "pressure_score": safe_float(raw_event.get("pressure_score"), 50.0),
        "published_at": published_at,
        "reason_codes": _string_list(raw_event.get("reason_codes")),
        "regime_tags": _string_list(raw_event.get("regime_tags")),
        "sectors": sectors,
        "shock_bias": safe_float(raw_event.get("shock_bias"), 0.0),
        "source": source,
        "source_name": safe_str(raw_event.get("source_name"), source),
        "source_url": source_url,
        "source_weight": safe_float(raw_event.get("source_weight"), 0.75),
        "summary": safe_str(raw_event.get("summary"), ""),
        "title": title,
    }


def _configured_event_feeds() -> tuple[TrustedEventFeed, ...]:
    configured = _feeds_from_env()
    if not configured:
        return DEFAULT_EVENT_FEEDS
    return (*DEFAULT_EVENT_FEEDS, *configured)


def _dedupe_events(events: list[VerifiedEvent]) -> list[VerifiedEvent]:
    selected: dict[str, VerifiedEvent] = {}
    for event in events:
        key = _dedupe_key(event)
        existing = selected.get(key)
        if existing is None or _event_quality_weight(event) > _event_quality_weight(existing):
            selected[key] = event
    return list(selected.values())


def _dedupe_key(event: VerifiedEvent) -> str:
    source_url = _normalize_url(event["source_url"])
    if source_url:
        return source_url
    published = safe_str(event.get("published_at"), "")[:10]
    title = re.sub(r"\W+", " ", event["title"].lower()).strip()
    return f"{published}|{title[:120]}"


def _normalize_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if not parsed.scheme or not parsed.netloc:
        return ""
    path = parsed.path.rstrip("/")
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{path}"


def _absolute_event_url(feed_url: str, event_url: str) -> str:
    if not event_url:
        return ""
    return urljoin(feed_url, event_url.strip())


def _is_allowed_source_url(url: str) -> bool:
    parsed = urlparse(url.strip())
    if parsed.scheme != "https" or not parsed.netloc:
        return False
    host = parsed.netloc.lower().split(":", 1)[0]
    return any(host == suffix or host.endswith(f".{suffix}") for suffix in TRUSTED_FEED_HOST_SUFFIXES)


def _provider_source_weight(source: str) -> float:
    normalized = source.lower().strip()
    if any(token in normalized for token in ("federal reserve", "bureau of labor", "sec", "cftc", "bea", "census", "eia")):
        return 1.0
    if any(token in normalized for token in ("reuters", "associated press", "ap", "wall street journal", "marketwatch")):
        return 0.86
    if any(token in normalized for token in ("pr newswire", "business wire", "globenewswire", "mt newswires")):
        return 0.78
    if "yahoo finance" in normalized or normalized == "yahoo":
        return 0.72
    return 0.70


def _base_event_confidence(feed: TrustedEventFeed, source_url: str) -> float:
    source_weight = _clamp(feed.source_weight, 0.2, 1.0)
    url_bonus = 7.0 if _is_allowed_source_url(source_url) else -20.0
    return round(_clamp(52.0 + source_weight * 42.0 + url_bonus, 35.0, 100.0), 2)


def _event_quality_weight(event: VerifiedEvent) -> float:
    source_weight = _clamp(event.get("source_weight", 0.75), 0.2, 1.0)
    confidence_weight = _clamp(event.get("event_confidence", event.get("confidence", 60.0)) / 100.0, 0.25, 1.0)
    decay_weight = _clamp(event.get("event_decay", 1.0), 0.0, 1.0)
    return source_weight * confidence_weight * decay_weight


def _event_pressure_with_decay(event: VerifiedEvent) -> float:
    decay = _clamp(event.get("event_decay", 1.0), 0.0, 1.0)
    return 50.0 + (event["pressure_score"] - 50.0) * decay


def _event_decay(event: VerifiedEvent, now: datetime) -> float:
    published = _parse_datetime(event.get("published_at"))
    if published is None:
        return 0.0
    age_days = max(0.0, (now - published).total_seconds() / 86400.0)
    category = event.get("category", "market")
    if category == "company":
        half_life_days = 5.0
    elif category in {"geopolitical", "commodity"}:
        half_life_days = 6.0
    elif category in {"macro", "market"}:
        half_life_days = 9.0
    else:
        half_life_days = 7.0
    return round(_clamp(math.exp(-age_days / half_life_days), 0.0, 1.0), 3)


def _earnings_event_decay(days_until_event: int) -> float:
    distance = abs(days_until_event)
    if distance <= 1:
        return 1.0
    if distance <= 3:
        return 0.86
    if distance <= 7:
        return 0.68
    if distance <= 14:
        return 0.42
    return 0.24


def _symbols_from_text(text: str) -> list[str]:
    symbols = sorted(
        set(SEMICONDUCTOR_SYMBOLS)
        | set(SOFTWARE_SYMBOLS)
        | set(OIL_PROXIES)
        | set(GOLD_PROXIES)
        | set(CRYPTO_PROXIES)
        | set(FINANCIAL_SYMBOLS)
    )
    found: list[str] = []
    upper_text = text.upper()
    for symbol in symbols:
        if re.search(rf"\b{re.escape(symbol)}\b", upper_text):
            found.append(symbol)
    return found[:12]


def _feeds_from_env() -> tuple[TrustedEventFeed, ...]:
    raw = os.getenv("TRADEVETO_EVENT_FEEDS_JSON", "").strip()
    if not raw:
        return ()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return ()
    if not isinstance(parsed, list):
        return ()

    feeds: list[TrustedEventFeed] = []
    seen_urls = {feed.url for feed in DEFAULT_EVENT_FEEDS}
    for index, item in enumerate(parsed):
        if not isinstance(item, dict):
            continue
        url = safe_str(item.get("url"), "").strip()
        name = safe_str(item.get("name"), "").strip()
        if not url.startswith("https://") or not name:
            continue
        if not _is_allowed_source_url(url):
            continue
        if url in seen_urls:
            continue
        seen_urls.add(url)
        key = safe_str(item.get("key"), "").strip() or f"configured_feed_{index + 1}"
        category_hint = safe_str(item.get("category_hint"), "").strip() or "configured_verified"
        source_weight = _clamp(safe_float(item.get("source_weight"), _provider_source_weight(name)), 0.2, 1.0)
        feeds.append(TrustedEventFeed(key=key, name=name, url=url, category_hint=category_hint, source_weight=source_weight))
    return tuple(feeds[:8])


def _event_cache_file(cache_dir: Path | None) -> Path | None:
    if cache_dir is None:
        return None
    return cache_dir / EVENT_CACHE_PATH


def _event_intelligence_enabled() -> bool:
    value = os.getenv("TRADEVETO_EVENT_INTELLIGENCE", "true").strip().lower()
    return value not in {"0", "false", "no", "off", "disabled"}


def _cache_ttl_from_env() -> timedelta:
    raw = os.getenv("TRADEVETO_EVENT_CACHE_TTL_MINUTES", "")
    try:
        minutes = int(raw) if raw.strip() else int(DEFAULT_CACHE_TTL.total_seconds() / 60)
    except ValueError:
        minutes = int(DEFAULT_CACHE_TTL.total_seconds() / 60)
    return timedelta(minutes=max(30, min(minutes, 24 * 60)))


def _parse_datetime(value: object) -> datetime | None:
    text = safe_str(value, "")
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _event_id(feed_key: str, source_url: str, title: str, published_at: datetime) -> str:
    raw = f"{feed_key}|{source_url}|{title}|{published_at.isoformat()}".encode("utf-8")
    return hashlib.sha1(raw).hexdigest()


def _clean_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _records_from_dataframe(df: pd.DataFrame) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for row in df.to_dict(orient="records"):
        records.append({str(key): value for key, value in row.items()})
    return records


def _string_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [safe_str(item, "") for item in value if safe_str(item, "")]
    if isinstance(value, tuple):
        return [safe_str(item, "") for item in value if safe_str(item, "")]
    text = safe_str(value, "")
    if not text:
        return []
    return [part.strip().strip("'\"") for part in text.strip("[]").split(",") if part.strip()]


def _normalize_symbol(value: object) -> str:
    return safe_str(value, "").strip().upper()


def _title_label(value: str) -> str:
    return " ".join(part.capitalize() for part in value.replace("_", " ").replace("-", " ").split())


def _average(values: list[float], fallback: float) -> float:
    numbers = [value for value in values if np.isfinite(value)]
    if not numbers:
        return fallback
    return float(sum(numbers) / len(numbers))


def _weighted_average(values: list[tuple[float, float]], fallback: float) -> float:
    numerator = 0.0
    denominator = 0.0
    for value, weight in values:
        if not np.isfinite(value) or not np.isfinite(weight):
            continue
        numerator += value * weight
        denominator += weight
    return numerator / denominator if denominator > 0.0 else fallback


def _clamp(value: float, lower: float = 0.0, upper: float = 100.0) -> float:
    return clamp_score(value, lower, upper)


def _unique_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        normalized = value.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        unique.append(normalized)
    return unique


def _jsonable(value: object) -> object:
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(item) for item in value]
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        numeric = float(value)
        return None if np.isnan(numeric) or not np.isfinite(numeric) else numeric
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    return value
