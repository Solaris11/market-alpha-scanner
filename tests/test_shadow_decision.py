from __future__ import annotations

import sys
import types
import unittest
from datetime import datetime, timezone

import pandas as pd

# See tests/test_decision_funnel.py: scanner.engine imports the network layer at
# module scope, which these decision-logic tests have no use for.
if "yfinance" not in sys.modules:  # pragma: no cover - import shim
    try:
        import yfinance  # noqa: F401
    except ModuleNotFoundError:
        sys.modules["yfinance"] = types.ModuleType("yfinance")

from scanner.diagnostics import apply_scoring_diagnostics
from scanner.engine import apply_decision_safety_gates
from scanner.final_decision import evaluate_final_trade_decision
from scanner.shadow_decision import (
    ShadowConfig,
    apply_shadow_decision,
    evaluate_shadow_decision,
    shadow_config,
    shadow_summary,
)


def _row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "symbol": "AAPL",
        "asset_type": "EQUITY",
        "price": 190.0,
        "final_score": 92.0,
        "technical_score": 78.0,
        "trend_score": 82.0,
        "momentum_score": 70.0,
        "breakout_score": 62.0,
        "relative_volume_score": 64.0,
        "macro_score": 66.0,
        "fundamental_score": 63.0,
        "news_score": 50.0,
        "risk_penalty": 4.0,
        "risk_reward": 1.8,
        "atr_pct": 3.0,
        "annualized_volatility": 0.28,
        "entry_status": "GOOD ENTRY",
        "composite_action": "BUY",
        "recommendation_quality": "TRADE_READY",
        "setup_type": "PULLBACK",
        "setup_strength": 80.0,
        "confidence_score": 88.0,
        "market_regime": "NEUTRAL",
        "final_decision": "ENTER",
        "buy_zone": "$185.00-$188.00",
        "stop_loss": "$178.00",
        "take_profit_zone": "$205.00-$212.00",
        "data_timestamp": datetime.now(timezone.utc).isoformat(),
        "history_days": 365,
        "data_provider": "yfinance",
        "provider_error": "",
    }
    row.update(overrides)
    return row


def _engine_decisions(rows: list[dict[str, object]]) -> pd.DataFrame:
    """Run rows through the real decision path and return the finished frame."""
    staged = []
    for row in rows:
        stage_a = evaluate_final_trade_decision(pd.Series(row))
        staged.append({**row, **stage_a})
    return apply_decision_safety_gates(apply_scoring_diagnostics(pd.DataFrame(staged)))


BAND = ShadowConfig(mode="band", band_low=55.0, band_high=70.0)
FLOOR = ShadowConfig(mode="floor", band_low=55.0, band_high=70.0)


class ShadowDoesNotChangeTheEngineTests(unittest.TestCase):
    """The whole safety argument, stated as a test.

    Shadow mode exists because the holdout study said the evidence was not yet
    enough to move the live rule. If applying it could alter a live decision,
    the study's caution would be defeated by the tool built to respect it.
    """

    def test_applying_shadow_leaves_every_engine_column_byte_identical(self) -> None:
        rows = [
            _row(final_score=92.0),
            _row(final_score=62.0),
            _row(final_score=62.0, setup_type="AVOID"),
            _row(final_score=68.0, recommendation_quality="WAIT_PULLBACK"),
            _row(final_score=45.0, composite_action="SELL"),
        ]
        before = _engine_decisions(rows)
        after = apply_shadow_decision(before, BAND)

        for column in before.columns:
            pd.testing.assert_series_equal(after[column], before[column], check_names=False)

    def test_final_decision_is_unchanged_even_when_the_band_disagrees(self) -> None:
        before = _engine_decisions([_row(final_score=62.0)])
        self.assertEqual(before.iloc[0]["final_decision"], "WATCH")

        after = apply_shadow_decision(before, BAND)
        self.assertEqual(after.iloc[0]["final_decision"], "WATCH", "live decision must not move")
        self.assertEqual(after.iloc[0]["shadow_decision"], "ENTER", "the band should disagree here")
        self.assertTrue(after.iloc[0]["shadow_differs_from_live"])

    def test_shadow_adds_only_shadow_columns(self) -> None:
        before = _engine_decisions([_row()])
        after = apply_shadow_decision(before, BAND)
        added = set(after.columns) - set(before.columns)
        self.assertTrue(all(name.startswith("shadow_") for name in added), added)


class ShadowRuleTests(unittest.TestCase):
    def test_the_band_admits_the_range_the_floor_rejects(self) -> None:
        frame = _engine_decisions([_row(final_score=62.0)])
        shadow = evaluate_shadow_decision(frame.iloc[0], BAND)
        self.assertEqual(shadow.decision, "ENTER")
        self.assertEqual(shadow.rule, "band:55-70")

    def test_the_band_is_a_range_not_a_lower_floor(self) -> None:
        """A band that only ever admits more is just a lower floor. 92 is a
        strong score and the band must still decline it, or the rule being
        tested is not the rule the study measured."""
        frame = _engine_decisions([_row(final_score=92.0)])
        shadow = evaluate_shadow_decision(frame.iloc[0], BAND)
        self.assertEqual(shadow.decision, "WATCH")
        self.assertEqual(shadow.blocking_gate, "final_score_band")

    def test_floor_mode_reproduces_the_live_rule(self) -> None:
        for score, expected in ((92.0, "ENTER"), (62.0, "WATCH")):
            frame = _engine_decisions([_row(final_score=score)])
            shadow = evaluate_shadow_decision(frame.iloc[0], FLOOR)
            self.assertEqual(shadow.decision, expected)
            self.assertEqual(shadow.decision, str(frame.iloc[0]["final_decision"]).upper())

    # The study's finding was that setup, veto and confidence filtering roughly
    # doubles the band's edge. "Replace the floor" must not become "remove the
    # gates".
    def test_the_band_still_respects_every_other_gate(self) -> None:
        for overrides, gate in (
            ({"setup_type": "AVOID"}, "setup_type_avoid"),
            ({"composite_action": "SELL"}, "sell_action"),
            ({"recommendation_quality": "AVOID"}, "quality_avoid"),
            ({"entry_status": "STOP RISK"}, "entry_status"),
        ):
            frame = _engine_decisions([_row(final_score=62.0, **overrides)])
            shadow = evaluate_shadow_decision(frame.iloc[0], BAND)
            self.assertNotEqual(shadow.decision, "ENTER", f"{overrides} must still block")
            self.assertEqual(shadow.blocking_gate, gate)

    def test_the_existing_trade_plan_is_surfaced_not_recomputed(self) -> None:
        frame = _engine_decisions([_row(final_score=62.0)])
        shadow = evaluate_shadow_decision(frame.iloc[0], BAND)
        self.assertEqual(shadow.entry_zone, "$185.00-$188.00")
        self.assertEqual(shadow.stop_loss, "$178.00")
        self.assertEqual(shadow.target_zone, "$205.00-$212.00")
        self.assertAlmostEqual(shadow.risk_reward, 1.8)


class ShadowConfigTests(unittest.TestCase):
    def test_default_is_todays_behaviour(self) -> None:
        config = shadow_config({})
        self.assertEqual(config.mode, "floor")
        self.assertEqual(config.label, "floor")

    def test_band_bounds_come_from_the_environment(self) -> None:
        config = shadow_config(
            {
                "TRADEVETO_ENTRY_SCORE_MODE": "band",
                "TRADEVETO_ENTRY_SCORE_BAND_LOW": "58",
                "TRADEVETO_ENTRY_SCORE_BAND_HIGH": "72",
            }
        )
        self.assertEqual((config.mode, config.band_low, config.band_high), ("band", 58.0, 72.0))

    def test_inverted_bounds_are_swapped_rather_than_rejected(self) -> None:
        config = shadow_config(
            {
                "TRADEVETO_ENTRY_SCORE_MODE": "band",
                "TRADEVETO_ENTRY_SCORE_BAND_LOW": "70",
                "TRADEVETO_ENTRY_SCORE_BAND_HIGH": "55",
            }
        )
        self.assertEqual((config.band_low, config.band_high), (55.0, 70.0))

    # A typo in an environment variable must not be able to stop a scan.
    def test_a_malformed_mode_falls_back_instead_of_raising(self) -> None:
        config = shadow_config({"TRADEVETO_ENTRY_SCORE_MODE": "aggressive"})
        self.assertEqual(config.mode, "floor")

    def test_a_malformed_bound_falls_back_to_the_default(self) -> None:
        config = shadow_config({"TRADEVETO_ENTRY_SCORE_MODE": "band", "TRADEVETO_ENTRY_SCORE_BAND_LOW": "abc"})
        self.assertEqual(config.band_low, 55.0)


class ShadowSummaryTests(unittest.TestCase):
    def test_summary_counts_both_rules(self) -> None:
        frame = _engine_decisions([_row(final_score=92.0), _row(final_score=62.0), _row(final_score=45.0)])
        summary = shadow_summary(apply_shadow_decision(frame, BAND))
        self.assertEqual(summary["rows"], 3)
        self.assertEqual(summary["rule"], "band:55-70")
        self.assertEqual(summary["live_enter"], 1)
        self.assertEqual(summary["shadow_enter"], 1)
        self.assertEqual(summary["differs"], 2)

    def test_empty_frame_is_handled(self) -> None:
        self.assertTrue(apply_shadow_decision(pd.DataFrame()).empty)
        self.assertEqual(shadow_summary(pd.DataFrame())["rows"], 0)


if __name__ == "__main__":
    unittest.main()
