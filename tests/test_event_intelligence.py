from __future__ import annotations

import unittest
from datetime import datetime, timezone

import pandas as pd

from scanner.event_intelligence import (
    TrustedEventFeed,
    apply_event_intelligence,
    build_event_context,
    classify_verified_event,
    event_impact_for_row,
    fetch_verified_events,
)
from scanner.recommendation_quality import evaluate_recommendation_quality


class EventIntelligenceTests(unittest.TestCase):
    def test_classifies_macro_and_geopolitical_events_without_prediction_language(self) -> None:
        feed = TrustedEventFeed("fed", "Federal Reserve", "https://example.test/feed", "macro")
        event = classify_verified_event(
            feed,
            "Federal Reserve discusses inflation pressure and interest rate policy",
            "Officials noted inflation and monetary policy remain important.",
            "https://example.test/fed-event",
            datetime(2026, 5, 8, tzinfo=timezone.utc),
        )

        self.assertIn("inflation", event["event_types"])
        self.assertIn("fed_rates", event["event_types"])
        self.assertIn("EVENT_INFLATION_PRESSURE", event["reason_codes"])
        generated = " ".join([event["title"], event["summary"], *event["reason_codes"]]).lower()
        self.assertNotRegex(generated, r"guarantee|will happen|buy now|sell now|prediction")

    def test_maps_semiconductor_events_to_symbol_context(self) -> None:
        feed = TrustedEventFeed("trusted", "Reuters", "https://example.test/feed", "market")
        event = classify_verified_event(
            feed,
            "AI semiconductor investment accelerates data center chip demand",
            "Chip suppliers and data center companies announced new investment plans.",
            "https://example.test/chip-event",
            datetime(2026, 5, 8, tzinfo=timezone.utc),
        )
        context = build_event_context([event], now=datetime(2026, 5, 8, tzinfo=timezone.utc))
        impact = event_impact_for_row(
            {
                "asset_type": "EQUITY",
                "macro_context_label": "Macro Aligned",
                "market_regime": "BULL",
                "sector": "Technology",
                "symbol": "NVDA",
            },
            context,
        )

        self.assertTrue(impact["event_context_available"])
        self.assertGreaterEqual(impact["event_conviction_adjustment"], 0.0)
        self.assertIn("EVENT_AI_SEMICONDUCTOR_THEME", impact["event_context_reason_codes"])
        self.assertIn("verified_event_recent_events", impact)

    def test_directional_macro_and_geopolitical_events_are_not_keyword_only(self) -> None:
        feed = TrustedEventFeed("trusted", "Reuters", "https://example.test/feed", "geopolitical")
        peace_failed = classify_verified_event(
            feed,
            "Peace talks failed after ceasefire negotiations collapsed",
            "Officials said no deal was reached and volatility increased.",
            "https://example.test/peace-failed",
            datetime(2026, 5, 8, tzinfo=timezone.utc),
        )
        hot_fed = classify_verified_event(
            TrustedEventFeed("fed", "Federal Reserve", "https://example.test/feed", "macro"),
            "Fed rate path looks higher than expected after hotter than expected inflation",
            "Treasury yields rose after the data came in hot.",
            "https://example.test/fed-hot",
            datetime(2026, 5, 8, tzinfo=timezone.utc),
        )

        self.assertIn("EVENT_FAILED_PEACE_TALKS", peace_failed["reason_codes"])
        self.assertNotIn("EVENT_GEOPOLITICAL_DEESCALATION", peace_failed["reason_codes"])
        self.assertGreater(peace_failed["pressure_score"], 70.0)
        self.assertIn("EVENT_HAWKISH_RATE_SURPRISE", hot_fed["reason_codes"])
        self.assertIn("EVENT_HOT_INFLATION_SURPRISE", hot_fed["reason_codes"])
        self.assertLess(hot_fed["conviction_bias"], 0.0)

    def test_company_events_use_directional_context(self) -> None:
        feed = TrustedEventFeed("trusted", "Bloomberg", "https://example.test/feed", "company")
        positive_product = classify_verified_event(
            feed,
            "Company launches new product as preorders exceed expectations",
            "Management said strong demand lifted the launch outlook.",
            "https://example.test/product-positive",
            datetime(2026, 5, 8, tzinfo=timezone.utc),
        )
        negative_earnings = classify_verified_event(
            feed,
            "Company misses earnings estimates and cuts guidance as margin compression worsens",
            "Revenue falls and profit falls below expectations.",
            "https://example.test/earnings-negative",
            datetime(2026, 5, 8, tzinfo=timezone.utc),
        )

        self.assertIn("EVENT_PRODUCT_CATALYST_POSITIVE", positive_product["reason_codes"])
        self.assertGreater(positive_product["conviction_bias"], 0.0)
        self.assertIn("EVENT_EARNINGS_NEGATIVE_SURPRISE", negative_earnings["reason_codes"])
        self.assertGreater(negative_earnings["fragility_bias"], positive_product["fragility_bias"])
        self.assertLess(negative_earnings["conviction_bias"], 0.0)

    def test_applies_bounded_event_fields_to_dataframe(self) -> None:
        feed = TrustedEventFeed("trusted", "Associated Press", "https://example.test/feed", "geopolitical")
        event = classify_verified_event(
            feed,
            "Oil supply shock follows geopolitical escalation",
            "Crude oil prices rose as conflict escalation affected supply routes.",
            "https://example.test/oil-event",
            datetime(2026, 5, 8, tzinfo=timezone.utc),
        )
        context = build_event_context([event], now=datetime(2026, 5, 8, tzinfo=timezone.utc))
        df = pd.DataFrame(
            [
                {
                    "asset_type": "EQUITY",
                    "factor_scores": {"macro": 60.0},
                    "final_score": 70.0,
                    "macro_context_label": "Macro Mixed",
                    "market_regime": "NEUTRAL",
                    "sector": "Energy",
                    "symbol": "OXY",
                }
            ]
        )
        result = apply_event_intelligence(df, context).iloc[0]

        self.assertTrue(bool(result["event_context_available"]))
        self.assertGreaterEqual(float(result["event_fragility_adjustment"]), 0.0)
        self.assertGreater(float(result["event_confidence"]), 0.0)
        self.assertGreater(float(result["event_decay"]), 0.0)
        self.assertGreater(float(result["event_source_weight"]), 0.0)
        self.assertLessEqual(float(result["event_fragility_adjustment"]), 6.0)
        self.assertGreaterEqual(float(result["event_macro_pressure_adjustment"]), -3.0)
        self.assertLessEqual(float(result["event_macro_pressure_adjustment"]), 2.0)
        self.assertIn("EVENT_OIL_SUPPLY_SHOCK", result["event_context_reason_codes"])

    def test_event_pressure_boundedly_reduces_recommendation_quality(self) -> None:
        base_row = pd.Series(
            {
                "action": "BUY",
                "asset_type": "EQUITY",
                "buy_zone_high": 101.0,
                "buy_zone_low": 98.0,
                "event_context_available": False,
                "final_score": 88.0,
                "market_regime": "RISK_ON",
                "price": 100.0,
                "risk_reward": 2.1,
                "setup_type": "CONTINUATION",
            }
        )
        event_row = base_row.copy()
        event_row["event_context_available"] = True
        event_row["event_conviction_adjustment"] = -3.0
        event_row["event_fragility_adjustment"] = 5.0
        event_row["event_macro_pressure_adjustment"] = -2.5
        event_row["event_risk_score"] = 78.0
        event_row["event_shock_pressure_score"] = 74.0

        base_quality = evaluate_recommendation_quality(base_row)
        event_quality = evaluate_recommendation_quality(event_row)
        base_score = base_quality["quality_score"]
        event_score = event_quality["quality_score"]
        if not isinstance(base_score, int) or not isinstance(event_score, int):
            self.fail("quality_score should be an integer")

        self.assertGreater(base_score, event_score)
        self.assertGreaterEqual(event_score, base_score - 8)
        self.assertIn("verified event pressure", str(event_quality["quality_reason"]).lower())

    def test_rejects_untrusted_configured_feed_url_without_fetching(self) -> None:
        events = fetch_verified_events(
            now=datetime(2026, 5, 8, tzinfo=timezone.utc),
            feeds=(TrustedEventFeed("bad", "Random Feed", "https://example.com/feed.xml", "macro"),),
        )

        self.assertEqual(events, [])

    def test_dedupes_source_urls_and_applies_event_decay(self) -> None:
        feed = TrustedEventFeed("fed", "Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml", "macro", source_weight=1.0)
        event_one = classify_verified_event(
            feed,
            "Federal Reserve discusses inflation pressure",
            "Officials noted inflation and interest rate policy remain important.",
            "https://www.federalreserve.gov/newsevents/pressreleases/test.htm",
            datetime(2026, 5, 2, tzinfo=timezone.utc),
        )
        event_two = classify_verified_event(
            feed,
            "Federal Reserve discusses inflation pressure",
            "Officials noted inflation and interest rate policy remain important.",
            "https://www.federalreserve.gov/newsevents/pressreleases/test.htm",
            datetime(2026, 5, 2, tzinfo=timezone.utc),
        )
        context = build_event_context([event_one, event_two], now=datetime(2026, 5, 8, tzinfo=timezone.utc))

        self.assertTrue(context["available"])
        self.assertEqual(len(context["events"]), 1)
        self.assertLess(context["events"][0]["event_decay"], 1.0)
        self.assertGreater(context["events"][0]["source_weight"], 0.9)

    def test_row_earnings_calendar_adds_source_backed_symbol_event(self) -> None:
        context = build_event_context([], now=datetime(2026, 5, 8, tzinfo=timezone.utc))
        impact = event_impact_for_row(
            {
                "asset_type": "EQUITY",
                "earnings_date": datetime.now(timezone.utc).date().isoformat(),
                "macro_context_label": "Macro Mixed",
                "market_regime": "NEUTRAL",
                "sector": "Technology",
                "symbol": "DDOG",
            },
            context,
        )

        self.assertTrue(impact["event_context_available"])
        self.assertIn("EVENT_EARNINGS_CALENDAR", impact["event_context_reason_codes"])
        self.assertGreater(impact["event_fragility_adjustment"], 0.0)
        self.assertEqual(impact["verified_event_recent_events"][0]["source"], "Yahoo Finance Earnings Calendar")


if __name__ == "__main__":
    unittest.main()
