from __future__ import annotations

import unittest

from scanner.universe import (
    CORE_UNIVERSE,
    REQUIRED_OPPORTUNITY_SYMBOLS,
    build_universe,
    missing_required_symbols,
    source_category_counts,
)
from scanner.universe_foundation import (
    CATEGORY_ORDER,
    build_symbol_classifications,
    build_symbol_health_dashboard,
    category_counts,
    health_state_counts,
    tier_counts,
    validate_classification_completeness,
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

    def test_symbol_classification_covers_every_1000_symbol_row(self) -> None:
        classifications = build_symbol_classifications("1000")

        self.assertEqual(len(classifications), 1000)
        self.assertEqual(len({item.symbol for item in classifications}), 1000)
        self.assertEqual(validate_classification_completeness(classifications), [])
        for classification in classifications:
            self.assertGreater(len(classification.categories), 0)
            for category in classification.categories:
                self.assertIn(category, CATEGORY_ORDER)

    def test_universe_tiers_and_required_categories_are_present(self) -> None:
        classifications = build_symbol_classifications("1000")
        by_symbol = {classification.symbol: classification for classification in classifications}
        tiers = tier_counts(classifications)
        categories = category_counts(classifications)

        self.assertEqual(tiers["Tier 1"], 111)
        self.assertGreater(tiers["Tier 2"], 150)
        self.assertGreater(tiers["Tier 3"], 600)
        self.assertIn("Quantum", by_symbol["RGTI"].categories)
        self.assertIn("Space", by_symbol["RKLB"].categories)
        self.assertIn("AI", by_symbol["SOUN"].categories)
        self.assertIn("Semiconductor", by_symbol["SNDK"].categories)
        self.assertIn("Growth", by_symbol["SNDK"].categories)
        self.assertIn("Momentum", by_symbol["SNDK"].categories)
        self.assertIn("Biotech", by_symbol["TEM"].categories)
        self.assertIn("Crypto", by_symbol["IBIT"].categories)
        for category in CATEGORY_ORDER:
            self.assertIn(category, categories)

    def test_symbol_health_dashboard_uses_latest_scanner_rows(self) -> None:
        classifications = build_symbol_classifications("500")
        rows = [
            {
                "symbol": "AAPL",
                "avg_dollar_volume": "1000000000",
                "market_cap": "3000000000000",
                "data_quality_score": "95",
                "final_score": "74.5",
                "provider_error": "",
            },
            {
                "symbol": "RGTI",
                "avg_dollar_volume": "25000000",
                "market_cap": "1500000000",
                "data_quality_score": "65",
                "final_score": "42",
                "provider_error": "",
            },
        ]

        dashboard = build_symbol_health_dashboard(classifications, rows)
        by_symbol = {item.symbol: item for item in dashboard}
        counts = health_state_counts(dashboard)

        self.assertEqual(by_symbol["AAPL"].provider_coverage, "active")
        self.assertEqual(by_symbol["AAPL"].liquidity_state, "strong")
        self.assertEqual(by_symbol["RGTI"].tier, "Tier 2")
        self.assertEqual(by_symbol["RGTI"].market_cap_state, "acceptable")
        self.assertGreater(counts["provider_coverage"]["not_ranked_latest_scan"], 400)


if __name__ == "__main__":
    unittest.main()
