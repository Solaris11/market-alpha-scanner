from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

import pandas as pd

from scanner.diagnostics import (
    apply_scoring_diagnostics,
    confidence_score_for_row,
    data_quality_flags,
    factor_scores_for_row,
    factor_weights_for_asset,
    vetoes_for_row,
)
from scanner.engine import apply_decision_safety_gates
from scanner.regime import apply_regime_adjustments, regime_policy, standardize_regime
from scanner.setup_engine import apply_setup_decision_layer, classify_setup


def _base_row() -> dict[str, object]:
    return {
        "symbol": "AAPL",
        "asset_type": "EQUITY",
        "price": 190.0,
        "final_score": 76.0,
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
        "setup_type": "pullback to AVWAP",
        "market_regime": "NEUTRAL",
        "final_decision": "ENTER",
        "data_timestamp": datetime.now(timezone.utc).isoformat(),
        "history_days": 365,
        "data_provider": "yfinance",
        "provider_error": "",
    }


class ScannerDiagnosticsTests(unittest.TestCase):
    def test_factor_weights_sum_to_one(self) -> None:
        for asset_type in ("EQUITY", "ETF", "CRYPTO", "UNKNOWN"):
            weights = factor_weights_for_asset(asset_type)
            self.assertAlmostEqual(sum(weights.values()), 1.0, places=6)

    def test_factor_scores_are_normalized(self) -> None:
        row = _base_row()
        row["trend_score"] = 140.0
        row["momentum_score"] = -20.0
        scores = factor_scores_for_row(row)
        for value in scores.values():
            self.assertGreaterEqual(value, 0.0)
            self.assertLessEqual(value, 100.0)

    def test_risk_veto_blocks_trade_permission(self) -> None:
        row = _base_row()
        row["risk_reward"] = 0.6
        row["annualized_volatility"] = 0.76
        result = apply_scoring_diagnostics(pd.DataFrame([row])).iloc[0]
        self.assertIn("POOR_RISK_REWARD", result["vetoes"])
        self.assertIn("HIGH_VOLATILITY", result["vetoes"])
        self.assertFalse(result["trade_permitted"])

    def test_stale_data_penalty_and_reason_code(self) -> None:
        row = _base_row()
        row["data_timestamp"] = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        flags = data_quality_flags(row)
        vetoes = vetoes_for_row(row, flags)
        self.assertTrue(flags["stale_data"])
        score_value = flags["data_quality_score"]
        if not isinstance(score_value, float):
            self.fail("data_quality_score must be a float")
        score: float = score_value
        self.assertLess(score, 80.0)
        self.assertIn("STALE_DATA", vetoes)

    def test_enter_requires_no_veto(self) -> None:
        allowed = apply_scoring_diagnostics(pd.DataFrame([_base_row()])).iloc[0]
        self.assertEqual(allowed["final_decision"], "ENTER")
        self.assertTrue(allowed["trade_permitted"])

        blocked_row = _base_row()
        blocked_row["entry_status"] = "OVEREXTENDED"
        blocked = apply_scoring_diagnostics(pd.DataFrame([blocked_row])).iloc[0]
        self.assertFalse(blocked["trade_permitted"])
        self.assertIn("OVEREXTENDED_ENTRY", blocked["vetoes"])

    def test_wait_can_happen_with_high_score_but_weak_confirmation(self) -> None:
        row = _base_row()
        row["final_decision"] = "WAIT_PULLBACK"
        row["entry_status"] = "OVEREXTENDED"
        row["final_score"] = 82.0
        result = apply_scoring_diagnostics(pd.DataFrame([row])).iloc[0]
        self.assertEqual(result["final_decision"], "WAIT_PULLBACK")
        self.assertIn("HIGH_SCORE", result["decision_reason_codes"])
        self.assertIn("OVEREXTENDED_ENTRY", result["decision_reason_codes"])
        self.assertFalse(result["trade_permitted"])

    def test_poor_tradability_gets_low_confidence_data(self) -> None:
        row = _base_row()
        row["history_days"] = 90
        row["price"] = None
        result = apply_scoring_diagnostics(pd.DataFrame([row])).iloc[0]
        self.assertTrue(result["low_confidence_data"])
        self.assertIn("LOW_CONFIDENCE_DATA", result["vetoes"])

    def test_confidence_score_rewards_clean_rows(self) -> None:
        clean_row = _base_row()
        weak_row = _base_row()
        weak_row["risk_reward"] = 0.5
        weak_row["atr_pct"] = 11.0
        weak_row["data_timestamp"] = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        clean_confidence = confidence_score_for_row(clean_row)
        weak_confidence = confidence_score_for_row(weak_row)
        self.assertGreater(clean_confidence, weak_confidence)

    def test_reason_codes_are_explanatory_not_advice(self) -> None:
        result = apply_scoring_diagnostics(pd.DataFrame([_base_row()])).iloc[0]
        joined = " ".join(result["decision_reason_codes"]).lower()
        blocked_phrases = ("buy now", "guaranteed", "should buy", "financial advice")
        for phrase in blocked_phrases:
            self.assertNotIn(phrase, joined)
        self.assertIn("TREND_CONFIRMED", result["decision_reason_codes"])

    def test_hard_veto_downgrades_enter_to_avoid(self) -> None:
        row = _base_row()
        row["risk_reward"] = 0.4
        diagnostics = apply_scoring_diagnostics(pd.DataFrame([row]))
        gated = apply_decision_safety_gates(diagnostics).iloc[0]
        self.assertEqual(gated["final_decision"], "AVOID")
        self.assertIn("Hard veto blocked entry", str(gated["decision_reason"]))

    def test_recoverable_veto_downgrades_enter_to_wait(self) -> None:
        row = _base_row()
        row["market_regime"] = "OVERHEATED"
        diagnostics = apply_scoring_diagnostics(pd.DataFrame([row]))
        gated = apply_decision_safety_gates(diagnostics).iloc[0]
        self.assertEqual(gated["final_decision"], "WAIT_PULLBACK")
        self.assertIn("wait for confirmation", str(gated["decision_reason"]))

    def test_low_confidence_downgrades_enter_to_watch(self) -> None:
        row = _base_row()
        row["final_score"] = 85.0
        diagnostics = apply_scoring_diagnostics(pd.DataFrame([row]))
        diagnostics.at[0, "final_score"] = 85.0
        diagnostics.at[0, "confidence_score"] = 45.0
        diagnostics.at[0, "trade_permitted"] = True
        gated = apply_decision_safety_gates(diagnostics).iloc[0]
        self.assertEqual(gated["final_decision"], "WATCH")
        self.assertIn("Confidence score below", str(gated["decision_reason"]))

    def test_standardized_regime_mapping(self) -> None:
        self.assertEqual(standardize_regime({"regime": "RISK_ON"}), "BULL")
        self.assertEqual(standardize_regime({"regime": "PULLBACK"}), "NEUTRAL")
        self.assertEqual(standardize_regime({"regime": "RISK_OFF", "trend": "DOWN", "vix": {"trend": "rising"}}), "BEAR")
        self.assertEqual(standardize_regime({"regime": "RISK_OFF", "trend": "MIXED"}), "RISK_OFF")

    def test_regime_adjustments_are_conservative_in_risk_regimes(self) -> None:
        row = _base_row()
        row["final_score"] = 82.0
        row["breakout_score"] = 78.0
        row["risk_penalty"] = 5.0
        row["data_quality_score"] = 92.0
        bull = apply_regime_adjustments(pd.DataFrame([row]), {"regime": "RISK_ON"}).iloc[0]
        overheated = apply_regime_adjustments(pd.DataFrame([row]), {"regime": "OVERHEATED"}).iloc[0]
        risk_off = apply_regime_adjustments(pd.DataFrame([row]), {"regime": "RISK_OFF"}).iloc[0]
        self.assertGreaterEqual(float(bull["final_score"]), float(overheated["final_score"]))
        self.assertGreater(float(overheated["final_score"]), float(risk_off["final_score"]))
        self.assertEqual(overheated["market_regime"], "OVERHEATED")
        self.assertIn("adjusted_thresholds", overheated.index)

    def test_overheated_overextended_entry_is_hard_veto(self) -> None:
        row = _base_row()
        row["market_regime"] = "OVERHEATED"
        row["entry_status"] = "OVEREXTENDED"
        diagnostics = apply_scoring_diagnostics(pd.DataFrame([row]))
        diagnostics.at[0, "trade_permitted"] = False
        gated = apply_decision_safety_gates(diagnostics).iloc[0]
        self.assertEqual(gated["final_decision"], "AVOID")
        self.assertIn("Hard veto blocked entry", str(gated["decision_reason"]))

    def test_risk_off_thresholds_require_stronger_confirmation(self) -> None:
        row = _base_row()
        row["final_score"] = 88.0
        row["confidence_score"] = 75.0
        row["adjusted_thresholds"] = regime_policy({"regime": "RISK_OFF"})["adjusted_thresholds"]
        row["trade_permitted"] = True
        gated = apply_decision_safety_gates(pd.DataFrame([row])).iloc[0]
        self.assertEqual(gated["final_decision"], "WATCH")
        self.assertIn("Regime-adjusted score below", str(gated["decision_reason"]))

    def test_setup_classification_assigns_pullback(self) -> None:
        row = _base_row()
        row["setup_type"] = "pullback to AVWAP"
        row["avwap_score"] = 76.0
        row["trend_score"] = 84.0
        evaluation = classify_setup(row)
        self.assertEqual(evaluation["setup_type"], "PULLBACK")
        self.assertGreaterEqual(evaluation["setup_strength"], 60.0)
        self.assertIn("SETUP_PULLBACK", evaluation["setup_reason_codes"])

    def test_setup_classification_assigns_breakout_only_with_volume(self) -> None:
        row = _base_row()
        row["setup_type"] = "breakout continuation"
        row["breakout_score"] = 82.0
        row["relative_volume_score"] = 72.0
        row["momentum_score"] = 73.0
        self.assertEqual(classify_setup(row)["setup_type"], "BREAKOUT")

        weak_volume = dict(row)
        weak_volume["relative_volume_score"] = 42.0
        evaluation = classify_setup(weak_volume)
        self.assertEqual(evaluation["setup_type"], "AVOID")
        self.assertIn("WEAK_VOLUME_FOR_BREAKOUT", evaluation["setup_reason_codes"])

    def test_setup_gate_blocks_invalid_enter(self) -> None:
        row = _base_row()
        row["setup_type"] = "mixed setup"
        row["breakout_score"] = 25.0
        row["trend_score"] = 45.0
        row["momentum_score"] = 42.0
        row["relative_volume_score"] = 35.0
        setup = apply_setup_decision_layer(pd.DataFrame([row]))
        diagnostics = apply_scoring_diagnostics(setup)
        diagnostics.at[0, "final_decision"] = "ENTER"
        diagnostics.at[0, "trade_permitted"] = True
        gated = apply_decision_safety_gates(diagnostics).iloc[0]
        self.assertEqual(gated["setup_type"], "AVOID")
        self.assertEqual(gated["final_decision"], "AVOID")
        self.assertIn("Setup gate blocked", str(gated["decision_reason"]))

    def test_setup_threshold_downgrades_buy_without_veto(self) -> None:
        row = _base_row()
        row["setup_type"] = "trend continuation"
        setup = apply_setup_decision_layer(pd.DataFrame([row]))
        setup.at[0, "final_decision"] = "ENTER"
        setup.at[0, "trade_permitted"] = True
        setup.at[0, "setup_strength"] = 50.0
        gated = apply_decision_safety_gates(setup).iloc[0]
        self.assertEqual(gated["final_decision"], "WATCH")
        self.assertIn("Setup strength below", str(gated["decision_reason"]))


if __name__ == "__main__":
    unittest.main()
