from __future__ import annotations

import itertools
import sys
import types
import unittest
from datetime import datetime, timezone

import pandas as pd

# scanner.engine imports scanner.data_fetch at module scope, which imports
# yfinance -- so the decision-gate logic cannot be imported without the network
# layer being importable, even though none of it is used here. That coupling is
# worth removing on its own merits; until then a stub keeps these tests
# runnable in an environment without the data provider installed. If yfinance
# is present, the real module is used and this does nothing.
if "yfinance" not in sys.modules:  # pragma: no cover - import shim
    try:
        import yfinance  # noqa: F401
    except ModuleNotFoundError:
        sys.modules["yfinance"] = types.ModuleType("yfinance")

from scanner.decision_funnel import (
    apply_decision_funnel,
    evaluate_decision_funnel,
    funnel_summary,
)
from scanner.diagnostics import apply_scoring_diagnostics
from scanner.engine import apply_decision_safety_gates
from scanner.final_decision import evaluate_final_trade_decision


def _base_row() -> dict[str, object]:
    """A row that clears every gate, so each test can break exactly one."""
    return {
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
        "data_timestamp": datetime.now(timezone.utc).isoformat(),
        "history_days": 365,
        "data_provider": "yfinance",
        "provider_error": "",
    }


def _engine_decision(row: dict[str, object]) -> str:
    """Run the row through the real decision path, exactly as the engine does."""
    series = pd.Series(row)
    stage_a = evaluate_final_trade_decision(series)
    merged = {**row, **stage_a}
    diagnosed = apply_scoring_diagnostics(pd.DataFrame([merged]))
    gated = apply_decision_safety_gates(diagnosed)
    return str(gated.iloc[0]["final_decision"]).upper()


class DecisionFunnelObserverTests(unittest.TestCase):
    """The observer must agree with the engine, or it is the observer that is wrong.

    This is the whole safety argument for the module: it re-derives the gates
    rather than intercepting them, so it cannot change a decision -- and these
    tests are what stop it drifting into describing a funnel the engine no
    longer has.
    """

    def _assert_agrees(self, row: dict[str, object], expected_gate: str | None = None) -> str:
        actual = _engine_decision(row)
        diagnosed = apply_scoring_diagnostics(pd.DataFrame([{**row, "final_decision": actual}]))
        funnel = evaluate_decision_funnel(diagnosed.iloc[0])
        self.assertEqual(
            funnel.predicted_decision,
            actual,
            f"observer said {funnel.predicted_decision}, engine said {actual}, blocking gate {funnel.blocking_gate}",
        )
        if expected_gate is not None:
            self.assertEqual(funnel.blocking_gate, expected_gate)
        return actual

    def test_a_clean_row_passes_every_gate_and_enters(self) -> None:
        decision = self._assert_agrees(_base_row(), expected_gate="passed")
        self.assertEqual(decision, "ENTER")

    def test_sell_action_blocks_first(self) -> None:
        row = _base_row()
        row["composite_action"] = "SELL"
        self.assertEqual(self._assert_agrees(row, expected_gate="sell_action"), "EXIT")

    def test_avoid_quality_is_attributed_to_the_quality_gate(self) -> None:
        row = _base_row()
        row["recommendation_quality"] = "AVOID"
        self.assertEqual(self._assert_agrees(row, expected_gate="quality_avoid"), "AVOID")

    def test_setup_avoid_is_attributed_to_the_setup_gate(self) -> None:
        row = _base_row()
        row["setup_type"] = "AVOID"
        self.assertEqual(self._assert_agrees(row, expected_gate="setup_type_avoid"), "AVOID")

    def test_score_shortfall_is_recorded_with_its_margin(self) -> None:
        row = _base_row()
        row["final_score"] = 62.0
        self._assert_agrees(row, expected_gate="final_score")
        diagnosed = apply_scoring_diagnostics(pd.DataFrame([{**row, "final_decision": _engine_decision(row)}]))
        funnel = evaluate_decision_funnel(diagnosed.iloc[0])
        score_gate = next(gate for gate in funnel.gates if gate.gate == "final_score")
        self.assertEqual(score_gate.margin, -18.0, "62 against a floor of 80 is an 18-point shortfall")

    def test_confidence_shortfall_is_recorded(self) -> None:
        row = _base_row()
        row["confidence_score"] = 40.0
        row["news_score"] = 5.0
        row["fundamental_score"] = 5.0
        self._assert_agrees(row)

    # The distinction the engine does not currently make, recorded so its cost
    # is visible: HIGH_VOLATILITY is advisory but empties trade_permitted just
    # as completely as a stale feed does.
    def test_advisory_and_severe_vetoes_are_reported_separately(self) -> None:
        row = _base_row()
        row["annualized_volatility"] = 0.76
        diagnosed = apply_scoring_diagnostics(pd.DataFrame([row]))
        funnel = evaluate_decision_funnel(diagnosed.iloc[0])
        self.assertIn("HIGH_VOLATILITY", funnel.advisory_vetoes)
        self.assertEqual(funnel.severe_vetoes, [])
        self.assertFalse(next(gate for gate in funnel.gates if gate.gate == "trade_permitted").passed)

    def test_stale_data_is_severe(self) -> None:
        row = _base_row()
        row["data_timestamp"] = "2020-01-01T00:00:00+00:00"
        diagnosed = apply_scoring_diagnostics(pd.DataFrame([row]))
        funnel = evaluate_decision_funnel(diagnosed.iloc[0])
        self.assertIn("STALE_DATA", funnel.severe_vetoes)

    def test_observer_agrees_across_a_grid_of_rows(self) -> None:
        """The single-gate tests above each break one thing. Real rows break
        several at once, and the order gates fire in is where an observer
        drifts from the engine."""
        qualities = ["TRADE_READY", "WAIT_PULLBACK", "LOW_EDGE", "AVOID"]
        entries = ["GOOD ENTRY", "BUY ZONE", "NEAR ENTRY", "OVEREXTENDED", "STOP RISK"]
        actions = ["BUY", "STRONG BUY", "SELL", "WAIT"]
        setups = ["PULLBACK", "BREAKOUT", "AVOID"]
        scores = [92.0, 62.0]

        checked = 0
        for quality, entry, action, setup, score in itertools.product(
            qualities, entries, actions, setups, scores
        ):
            row = _base_row()
            row.update(
                recommendation_quality=quality,
                entry_status=entry,
                composite_action=action,
                setup_type=setup,
                final_score=score,
            )
            actual = _engine_decision(row)
            diagnosed = apply_scoring_diagnostics(pd.DataFrame([{**row, "final_decision": actual}]))
            funnel = evaluate_decision_funnel(diagnosed.iloc[0])
            self.assertEqual(
                funnel.predicted_decision,
                actual,
                f"quality={quality} entry={entry} action={action} setup={setup} score={score}: "
                f"observer {funnel.predicted_decision} vs engine {actual} (gate {funnel.blocking_gate})",
            )
            checked += 1
        self.assertEqual(checked, 480)


class DecisionFunnelFrameTests(unittest.TestCase):
    def test_apply_adds_columns_without_touching_existing_ones(self) -> None:
        rows = []
        for score, setup in ((92.0, "PULLBACK"), (62.0, "PULLBACK"), (92.0, "AVOID")):
            row = _base_row()
            row.update(final_score=score, setup_type=setup)
            rows.append(row)
        original = apply_scoring_diagnostics(pd.DataFrame(rows))
        result = apply_decision_funnel(original)

        for column in original.columns:
            pd.testing.assert_series_equal(result[column], original[column], check_names=False)
        self.assertIn("funnel_blocking_gate", result.columns)
        self.assertIn("funnel_shortfalls", result.columns)

    def test_summary_counts_gates_and_reports_agreement(self) -> None:
        rows = []
        for score, setup in ((92.0, "PULLBACK"), (62.0, "PULLBACK"), (92.0, "AVOID")):
            row = _base_row()
            row.update(final_score=score, setup_type=setup)
            row["final_decision"] = _engine_decision(row)
            rows.append(row)
        frame = apply_decision_funnel(apply_scoring_diagnostics(pd.DataFrame(rows)))
        summary = funnel_summary(frame)

        self.assertEqual(summary["rows"], 3)
        self.assertEqual(summary["by_gate"].get("setup_type_avoid"), 1)
        self.assertEqual(summary["by_gate"].get("final_score"), 1)
        self.assertEqual(summary["agreement"]["rate"], 1.0)
        self.assertEqual(summary["median_shortfall"].get("final_score"), -18.0)

    def test_empty_frame_is_handled(self) -> None:
        empty = pd.DataFrame()
        self.assertTrue(apply_decision_funnel(empty).empty)
        self.assertEqual(funnel_summary(empty)["rows"], 0)


if __name__ == "__main__":
    unittest.main()
