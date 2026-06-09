from __future__ import annotations

import unittest

from scanner.universe import (
    CORE_UNIVERSE,
    REQUIRED_OPPORTUNITY_SYMBOLS,
    build_universe,
    missing_required_symbols,
    source_category_counts,
)


class ExpandedUniverseTests(unittest.TestCase):
    def test_core_universe_remains_compact_baseline(self) -> None:
        universe = build_universe("core")

        self.assertEqual(universe, CORE_UNIVERSE)
        self.assertEqual(len(universe), 111)

    def test_expanded_500_universe_has_required_opportunity_names(self) -> None:
        universe = build_universe("500")

        self.assertEqual(len(universe), 500)
        self.assertEqual(len(set(universe)), 500)
        self.assertEqual(missing_required_symbols(universe), [])

    def test_expanded_1000_universe_has_required_opportunity_names(self) -> None:
        universe = build_universe("1000")

        self.assertEqual(len(universe), 1000)
        self.assertEqual(len(set(universe)), 1000)
        self.assertEqual(missing_required_symbols(universe), [])

    def test_expanded_universe_keeps_thematic_and_exchange_coverage(self) -> None:
        universe = build_universe("1000")
        counts = source_category_counts(universe)

        self.assertEqual(counts["core"], len(CORE_UNIVERSE))
        self.assertGreater(counts["nasdaqtrader_nasdaq"], 250)
        self.assertGreater(counts["nasdaqtrader_otherlisted"], 200)
        self.assertGreaterEqual(counts["biotech"], 30)
        self.assertGreaterEqual(counts["momentum_midcap"], 30)
        self.assertGreaterEqual(counts["ai"], 20)
        self.assertGreaterEqual(counts["crypto_proxies"], 20)
        self.assertGreaterEqual(counts["space"], 10)
        self.assertGreaterEqual(counts["defense"], 10)
        for symbol in REQUIRED_OPPORTUNITY_SYMBOLS:
            self.assertIn(symbol, universe)


if __name__ == "__main__":
    unittest.main()
