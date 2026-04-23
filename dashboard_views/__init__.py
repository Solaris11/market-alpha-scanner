"""Dashboard view package."""
from .history_view import render_history_page
from .overview import render_overview_page
from .performance import render_performance_page
from .symbol_detail import render_symbol_detail_page

__all__ = [
    "render_history_page",
    "render_overview_page",
    "render_performance_page",
    "render_symbol_detail_page",
]
