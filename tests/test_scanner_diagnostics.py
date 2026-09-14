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
from scanner.utils import safe_float


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

    def test_macro_context_adjustments_preserve_base_score_and_reason_codes(self) -> None:
        rows = [
            {**_base_row(), "symbol": "SPY", "final_score": 30.0, "technical_score": 44.0, "sector": "ETF"},
            {**_base_row(), "symbol": "QQQ", "final_score": 28.0, "technical_score": 42.0, "sector": "ETF"},
            {**_base_row(), "symbol": "IWM", "final_score": 24.0, "technical_score": 40.0, "sector": "ETF"},
            {**_base_row(), "symbol": "VXX", "final_score": 88.0, "technical_score": 70.0, "sector": "Volatility"},
            {**_base_row(), "symbol": "UUP", "final_score": 76.0, "technical_score": 68.0, "sector": "Currency"},
            {**_base_row(), "symbol": "NVDA", "final_score": 82.0, "technical_score": 86.0, "sector": "Technology", "macro_score": 62.0},
        ]
        adjusted = apply_regime_adjustments(pd.DataFrame(rows), {"regime": "RISK_OFF"}).set_index("symbol")
        nvda = adjusted.loc["NVDA"]

        self.assertEqual(safe_float(nvda.get("base_score"), 0.0), 82.0)
        self.assertEqual(safe_float(nvda.get("final_score_base"), 0.0), 82.0)
        self.assertLess(safe_float(nvda.get("final_score"), 0.0), 82.0)
        self.assertGreaterEqual(safe_float(nvda.get("macro_context_adjustment_total"), 0.0), -18.0)
        self.assertLessEqual(safe_float(nvda.get("macro_context_adjustment_total"), 0.0), 10.0)
        self.assertIn("MACRO_CONFLICT", nvda["macro_context_reason_codes"])
        self.assertIn("VOLATILITY_PRESSURE", nvda["macro_context_reason_codes"])
        self.assertIn("LIQUIDITY_TIGHTENING", nvda["macro_context_reason_codes"])
        self.assertIn("macro_context_summary", nvda.index)

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


class MarketCalendarFreshnessTests(unittest.TestCase):
    """Observation-only: these fields gate nothing yet. They exist so the
    calendar-clock STALE_DATA flag can be compared against a market-aware one
    on production rows before either changes a decision."""

    def test_friday_bar_is_fresh_all_weekend_and_monday_pre_open(self) -> None:
        from scanner.diagnostics import _is_stale_by_market_calendar, missed_closed_sessions

        friday_bar = "2026-09-11T00:00:00+00:00"
        for now in (
            datetime(2026, 9, 12, 12, 0, tzinfo=timezone.utc),   # Saturday noon
            datetime(2026, 9, 13, 23, 0, tzinfo=timezone.utc),   # Sunday night
            datetime(2026, 9, 14, 12, 1, tzinfo=timezone.utc),   # Monday pre-open (today's failing case)
            datetime(2026, 9, 14, 20, 59, tzinfo=timezone.utc),  # Monday, session still open
        ):
            missed = missed_closed_sessions(friday_bar, now=now)
            self.assertEqual(missed, 0, now)
            self.assertFalse(_is_stale_by_market_calendar(friday_bar, missed, now=now), now)

    def test_one_missed_close_is_tolerated_two_are_not(self) -> None:
        from scanner.diagnostics import _is_stale_by_market_calendar, missed_closed_sessions

        friday_bar = "2026-09-11T00:00:00+00:00"
        tuesday_pre_open = datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc)
        self.assertEqual(missed_closed_sessions(friday_bar, now=tuesday_pre_open), 1)  # Monday closed, e.g. a holiday
        self.assertFalse(_is_stale_by_market_calendar(friday_bar, 1, now=tuesday_pre_open))
        wednesday_pre_open = datetime(2026, 9, 16, 12, 0, tzinfo=timezone.utc)
        self.assertEqual(missed_closed_sessions(friday_bar, now=wednesday_pre_open), 2)
        self.assertTrue(_is_stale_by_market_calendar(friday_bar, 2, now=wednesday_pre_open))

    def test_calendar_day_cap_catches_non_weekday_markets(self) -> None:
        from scanner.diagnostics import _is_stale_by_market_calendar

        old_bar = "2026-09-05T00:00:00+00:00"  # a Saturday bar, e.g. crypto
        now = datetime(2026, 9, 11, 12, 0, tzinfo=timezone.utc)
        self.assertTrue(_is_stale_by_market_calendar(old_bar, 1, now=now))

    def test_unparseable_timestamp_is_not_flagged(self) -> None:
        from scanner.diagnostics import _is_stale_by_market_calendar, missed_closed_sessions

        self.assertIsNone(missed_closed_sessions("not a date"))
        self.assertFalse(_is_stale_by_market_calendar("not a date", None))

    def test_flags_are_persisted_and_gate_nothing(self) -> None:
        row = _base_row()
        row["data_timestamp"] = "2026-09-11T00:00:00+00:00"
        frame = apply_scoring_diagnostics(pd.DataFrame([row]))
        self.assertIn("stale_by_market_calendar", frame.columns)
        self.assertIn("missed_sessions", frame.columns)
        flags = data_quality_flags(row)
        # The legacy calendar-clock flag still drives the veto list; the new
        # flag is recorded beside it and changes neither vetoes nor the score.
        vetoes = vetoes_for_row(row, flags)
        self.assertEqual("STALE_DATA" in vetoes, bool(flags["stale_data"]))
        stale_free = dict(flags)
        stale_free["stale_by_market_calendar"] = not flags["stale_by_market_calendar"]
        self.assertEqual(vetoes_for_row(row, stale_free), vetoes)
