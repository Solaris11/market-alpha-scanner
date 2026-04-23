"""Lightweight database plumbing for PostgreSQL-backed scanner storage."""

from .config import AppConfig, load_app_config
from .models import FundamentalSnapshot, NewsItem, PriceHistory, ScanRun, SymbolReason, SymbolSnapshot
from .repositories import (
    add_fundamental_snapshot,
    add_news_items,
    add_price_history_rows,
    add_symbol_snapshot,
    build_news_fingerprint,
    create_scan_run,
)
from .session import create_db_engine, get_engine, get_session_factory, session_scope

__all__ = [
    "AppConfig",
    "FundamentalSnapshot",
    "NewsItem",
    "PriceHistory",
    "ScanRun",
    "SymbolReason",
    "SymbolSnapshot",
    "add_fundamental_snapshot",
    "add_news_items",
    "add_price_history_rows",
    "add_symbol_snapshot",
    "build_news_fingerprint",
    "create_db_engine",
    "create_scan_run",
    "get_engine",
    "get_session_factory",
    "load_app_config",
    "session_scope",
]
