from __future__ import annotations

from collections.abc import Callable
import os
from typing import cast
import unittest

import pandas as pd
from sqlalchemy.orm import Session

from database import writeback
from database.writeback import to_database_jsonable


class RecordingSession:
    def __init__(self) -> None:
        self.executed_batch_sizes: list[int] = []
        self.executed_symbols: list[str] = []

    def execute(self, statement: object, params: object | None = None) -> None:
        _ = statement
        if isinstance(params, list):
            self.executed_batch_sizes.append(len(params))
            for item in params:
                if isinstance(item, dict):
                    symbol = item.get("symbol")
                    if isinstance(symbol, str):
                        self.executed_symbols.append(symbol)


class DatabaseWritebackTests(unittest.TestCase):
    def test_jsonable_replaces_non_finite_floats_with_none(self) -> None:
        payload = {
            "finite": 12.5,
            "nan": float("nan"),
            "positive_infinity": float("inf"),
            "negative_infinity": float("-inf"),
            "nested": {"trailing_pe": float("inf")},
        }

        normalized = to_database_jsonable(payload)

        self.assertEqual(
            normalized,
            {
                "finite": 12.5,
                "nan": None,
                "positive_infinity": None,
                "negative_infinity": None,
                "nested": {"trailing_pe": None},
            },
        )

    def test_dataframe_dicts_are_safe_for_postgres_json(self) -> None:
        frame = pd.DataFrame(
            [
                {
                    "symbol": "SMR",
                    "trailing_pe": float("inf"),
                    "forward_pe": float("-inf"),
                    "market_cap": 1_000_000_000,
                }
            ]
        )

        rows = [
            {str(key): to_database_jsonable(value) for key, value in row.items()}
            for row in frame.to_dict(orient="records")
        ]

        self.assertEqual(rows[0]["symbol"], "SMR")
        self.assertIsNone(rows[0]["trailing_pe"])
        self.assertIsNone(rows[0]["forward_pe"])
        self.assertEqual(rows[0]["market_cap"], 1_000_000_000)

    def test_price_history_writeback_streams_batches(self) -> None:
        price_rows = 1001
        price_frame = pd.DataFrame(
            {
                "Date": pd.date_range("2026-01-01", periods=price_rows, freq="D", tz="UTC"),
                "Open": [1.0] * price_rows,
                "High": [1.1] * price_rows,
                "Low": [0.9] * price_rows,
                "Close": [1.05] * price_rows,
                "Volume": [1000.0] * price_rows,
            }
        )
        ranking_frame = pd.DataFrame([{"symbol": "AMD"}])
        ranking_frame.attrs["price_map"] = {"AMD": price_frame}
        session = RecordingSession()
        persist_symbol_price_history = cast(
            Callable[[Session, pd.DataFrame], int],
            getattr(writeback, "_persist_symbol_price_history"),
        )
        old_symbol_limit = os.environ.get("TRADEVETO_PRICE_HISTORY_MAX_SYMBOLS")
        old_row_limit = os.environ.get("TRADEVETO_PRICE_HISTORY_MAX_ROWS_PER_SYMBOL")

        try:
            os.environ["TRADEVETO_PRICE_HISTORY_MAX_SYMBOLS"] = "10"
            os.environ["TRADEVETO_PRICE_HISTORY_MAX_ROWS_PER_SYMBOL"] = str(price_rows)
            inserted = persist_symbol_price_history(cast(Session, session), ranking_frame)
        finally:
            _restore_env("TRADEVETO_PRICE_HISTORY_MAX_SYMBOLS", old_symbol_limit)
            _restore_env("TRADEVETO_PRICE_HISTORY_MAX_ROWS_PER_SYMBOL", old_row_limit)

        self.assertEqual(inserted, price_rows)
        self.assertEqual(session.executed_batch_sizes, [1000, 1])

    def test_price_history_writeback_applies_symbol_and_row_limits(self) -> None:
        price_frame = pd.DataFrame(
            {
                "Date": pd.date_range("2026-01-01", periods=5, freq="D", tz="UTC"),
                "Open": [1.0] * 5,
                "High": [1.1] * 5,
                "Low": [0.9] * 5,
                "Close": [1.05] * 5,
                "Volume": [1000.0] * 5,
            }
        )
        ranking_frame = pd.DataFrame([{"symbol": "AMD"}, {"symbol": "NVDA"}])
        ranking_frame.attrs["price_map"] = {"AMD": price_frame, "NVDA": price_frame}
        session = RecordingSession()
        persist_symbol_price_history = cast(
            Callable[[Session, pd.DataFrame], int],
            getattr(writeback, "_persist_symbol_price_history"),
        )
        old_symbol_limit = os.environ.get("TRADEVETO_PRICE_HISTORY_MAX_SYMBOLS")
        old_row_limit = os.environ.get("TRADEVETO_PRICE_HISTORY_MAX_ROWS_PER_SYMBOL")

        try:
            os.environ["TRADEVETO_PRICE_HISTORY_MAX_SYMBOLS"] = "1"
            os.environ["TRADEVETO_PRICE_HISTORY_MAX_ROWS_PER_SYMBOL"] = "2"
            inserted = persist_symbol_price_history(cast(Session, session), ranking_frame)
        finally:
            _restore_env("TRADEVETO_PRICE_HISTORY_MAX_SYMBOLS", old_symbol_limit)
            _restore_env("TRADEVETO_PRICE_HISTORY_MAX_ROWS_PER_SYMBOL", old_row_limit)

        self.assertEqual(inserted, 2)
        self.assertEqual(session.executed_batch_sizes, [2])
        self.assertEqual(session.executed_symbols, ["AMD", "AMD"])


def _restore_env(name: str, value: str | None) -> None:
    if value is None:
        os.environ.pop(name, None)
        return
    os.environ[name] = value


if __name__ == "__main__":
    unittest.main()
