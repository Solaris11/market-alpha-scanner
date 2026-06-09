from __future__ import annotations

import unittest

import pandas as pd

from database.writeback import to_database_jsonable


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


if __name__ == "__main__":
    unittest.main()
