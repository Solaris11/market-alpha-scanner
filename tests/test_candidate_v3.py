from __future__ import annotations

import sys
import types
import unittest

import pandas as pd

if "yfinance" not in sys.modules:  # pragma: no cover - import shim
    try:
        import yfinance  # noqa: F401
    except ModuleNotFoundError:
        sys.modules["yfinance"] = types.ModuleType("yfinance")

from scanner.candidate_v3 import (
    V3_COLUMNS,
    V3Config,
    apply_candidate_v3,
    candidate_v3_summary,
    evaluate_candidate_v3,
    v3_setup_type,
)


def _row(**overrides: object) -> pd.Series:
    """A row that clears the band-core entry path, so each test can break
    exactly one thing and see the decision move."""
    base: dict[str, object] = {
        "symbol": "TEST",
        "composite_action": "BUY",
        "entry_status": "BUY ZONE",
        "setup_detail": "pullback to rising AVWAP",
        "setup_type": "AVOID",           # the live verdict; v3 must not read it
        "final_score": 62.0,
        "confidence_score": 80.0,
        "trend_score": 74.0,
        "momentum_score": 55.0,
        "avwap_score": 66.0,
        "breakout_score": 30.0,
        "relative_volume_score": 20.0,
        "balanced_risk_reward_low": 2.0,
        "risk_reward": 0.7,
        "price": 100.0,
        "buy_zone": "97.00 - 99.50",
        "stop_loss": "94.00",
        "conservative_target": "104.00",
        "balanced_target": "108.00",
        "aggressive_target": "115.00",
        "vetoes": [],
        "last_bar_partial": "true",
    }
    base.update(overrides)
    return pd.Series(base)


class SetupShapeTests(unittest.TestCase):
    def test_shape_is_never_a_verdict(self) -> None:
        self.assertEqual(v3_setup_type(_row()), "PULLBACK")
        self.assertEqual(v3_setup_type(_row(setup_detail="breakout over the range high")), "BREAKOUT")
        self.assertEqual(
            v3_setup_type(_row(setup_detail="", avwap_score=10.0, trend_score=80.0, momentum_score=70.0)),
            "CONTINUATION",
        )
        self.assertEqual(
            v3_setup_type(_row(setup_detail="", avwap_score=10.0, trend_score=20.0, momentum_score=20.0)),
            "UNCLASSIFIED",
        )

    def test_breakout_shape_uses_the_completed_bar(self) -> None:
        row = _row(setup_detail="", breakout_score=40.0, breakout_score_completed=88.0)
        self.assertEqual(v3_setup_type(row), "BREAKOUT")


class EnterPathTests(unittest.TestCase):
    def test_band_core_enters_where_the_live_engine_avoids(self) -> None:
        result = evaluate_candidate_v3(_row())
        self.assertEqual(result["candidate_v3_decision"], "ENTER")
        self.assertEqual(result["candidate_v3_path"], "CORE")
        self.assertEqual(result["candidate_v3_setup_type"], "PULLBACK")
        self.assertIn("BAND_CORE", result["candidate_v3_reason_codes"])
        self.assertEqual(result["candidate_v3_entry_low"], 97.0)
        self.assertEqual(result["candidate_v3_entry_high"], 99.5)
        self.assertEqual(result["candidate_v3_stop"], 94.0)
        self.assertEqual(result["candidate_v3_target_2"], 108.0)
        self.assertEqual(result["candidate_v3_rr"], 2.0)
        self.assertEqual(result["candidate_v3_invalidation"], "94.00")

    def test_score_above_the_band_is_not_an_entry(self) -> None:
        result = evaluate_candidate_v3(_row(final_score=88.0))
        self.assertEqual(result["candidate_v3_decision"], "WATCH")
        self.assertIn("ABOVE_ENTRY_BAND", result["candidate_v3_reason_codes"])

    def test_score_floor_of_the_live_engine_is_not_reintroduced(self) -> None:
        # 62 would fail the live engine's >= 80 floor; v3 enters on it.
        self.assertEqual(evaluate_candidate_v3(_row(final_score=62.0))["candidate_v3_decision"], "ENTER")

    def test_confidence_below_the_core_floor_watches(self) -> None:
        result = evaluate_candidate_v3(_row(confidence_score=68.0))
        self.assertEqual(result["candidate_v3_decision"], "WATCH")
        self.assertIn("LOW_CONFIDENCE", result["candidate_v3_reason_codes"])

    def test_balanced_rr_below_the_floor_watches(self) -> None:
        result = evaluate_candidate_v3(_row(balanced_risk_reward_low=1.1))
        self.assertEqual(result["candidate_v3_decision"], "WATCH")
        self.assertIn("RR_BELOW_FLOOR", result["candidate_v3_reason_codes"])

    def test_breakout_path_ignores_the_partial_current_bar(self) -> None:
        row = _row(
            setup_detail="breakout",
            final_score=84.0,              # outside the band: the core path cannot fire
            confidence_score=40.0,         # and confidence is far below the core floor
            breakout_score=45.0,
            breakout_score_completed=80.0,
            relative_volume_score=22.0,    # partial bar, as during any intraday scan
            relative_volume_score_completed=61.0,
            momentum_score=64.0,
        )
        result = evaluate_candidate_v3(row)
        self.assertEqual(result["candidate_v3_decision"], "ENTER")
        self.assertEqual(result["candidate_v3_path"], "BREAKOUT")
        self.assertIn("BREAKOUT_CONFIRMED", result["candidate_v3_reason_codes"])
        self.assertIn("VOLUME_COMPLETED_BAR", result["candidate_v3_reason_codes"])

    def test_breakout_without_volume_is_not_an_entry(self) -> None:
        row = _row(
            setup_detail="breakout",
            final_score=84.0,
            confidence_score=40.0,
            breakout_score_completed=80.0,
            relative_volume_score_completed=30.0,
            momentum_score=64.0,
        )
        result = evaluate_candidate_v3(row)
        self.assertEqual(result["candidate_v3_decision"], "WATCH")

    def test_every_enter_is_where_complete(self) -> None:
        for missing in ("buy_zone", "stop_loss"):
            result = evaluate_candidate_v3(_row(**{missing: ""}))
            self.assertEqual(result["candidate_v3_decision"], "WATCH", missing)
            self.assertIn("WHERE_INCOMPLETE", result["candidate_v3_reason_codes"], missing)

    def test_stop_above_the_entry_zone_is_not_where_complete(self) -> None:
        result = evaluate_candidate_v3(_row(stop_loss="99.00"))
        self.assertEqual(result["candidate_v3_decision"], "WATCH")
        self.assertIn("WHERE_INCOMPLETE", result["candidate_v3_reason_codes"])


class LevelParsingTests(unittest.TestCase):
    """Production writes ranges as "318.58-323.99" with no spaces. A signed
    number pattern reads that hyphen as a minus and hands the entry zone a
    negative top, which is exactly how the first v3 deploy produced zero
    actionable rows on a live run."""

    def test_hyphenated_range_parses_as_two_positive_levels(self) -> None:
        result = evaluate_candidate_v3(_row(
            price=321.0,
            buy_zone="318.58-323.99",
            stop_loss="307.69",
            conservative_target="340.00",
            balanced_target="363.56-374.74",
            aggressive_target="390.00",
        ))
        self.assertEqual(result["candidate_v3_entry_low"], 318.58)
        self.assertEqual(result["candidate_v3_entry_high"], 323.99)
        self.assertEqual(result["candidate_v3_stop"], 307.69)
        self.assertEqual(result["candidate_v3_target_2"], 363.56)
        self.assertEqual(result["candidate_v3_decision"], "ENTER")

    def test_currency_and_spacing_variants_parse(self) -> None:
        for zone in ("$97.00 - $99.50", "97.00 to 99.50", "97.00-99.50"):
            result = evaluate_candidate_v3(_row(buy_zone=zone))
            self.assertEqual(result["candidate_v3_entry_low"], 97.0, zone)
            self.assertEqual(result["candidate_v3_entry_high"], 99.5, zone)

    def test_non_positive_levels_are_not_where_complete(self) -> None:
        result = evaluate_candidate_v3(_row(buy_zone="0 - 0"))
        self.assertEqual(result["candidate_v3_decision"], "WATCH")
        self.assertIn("WHERE_INCOMPLETE", result["candidate_v3_reason_codes"])


class WaitPullbackTests(unittest.TestCase):
    def test_overextended_good_setup_waits_instead_of_avoiding(self) -> None:
        result = evaluate_candidate_v3(_row(entry_status="OVEREXTENDED"))
        self.assertEqual(result["candidate_v3_decision"], "WAIT_PULLBACK")
        self.assertIn("LATE_ENTRY", result["candidate_v3_reason_codes"])
        self.assertIn("97.00-99.50", result["candidate_v3_why_wait"])
        self.assertIn("94.00", result["candidate_v3_confirmation"])
        self.assertEqual(result["candidate_v3_invalidation"], "94.00")

    def test_wait_needs_a_real_zone(self) -> None:
        result = evaluate_candidate_v3(_row(entry_status="OVEREXTENDED", buy_zone=""))
        self.assertEqual(result["candidate_v3_decision"], "WATCH")
        self.assertIn("WHERE_INCOMPLETE", result["candidate_v3_reason_codes"])

    def test_wait_needs_a_reward_worth_the_wait(self) -> None:
        result = evaluate_candidate_v3(_row(entry_status="OVEREXTENDED", balanced_risk_reward_low=0.8, risk_reward=0.8))
        self.assertEqual(result["candidate_v3_decision"], "WATCH")
        self.assertIn("RR_BELOW_FLOOR", result["candidate_v3_reason_codes"])


class VetoSeverityTests(unittest.TestCase):
    def test_severe_vetoes_still_block(self) -> None:
        for code in ("STALE_DATA", "PROVIDER_ERROR", "EXTREME_VOLATILITY", "STOP_RISK"):
            result = evaluate_candidate_v3(_row(vetoes=[code]))
            self.assertEqual(result["candidate_v3_decision"], "AVOID", code)
            self.assertIn(f"SEVERE_{code}", result["candidate_v3_reason_codes"], code)

    def test_advisory_vetoes_cost_confidence_and_do_not_block(self) -> None:
        result = evaluate_candidate_v3(_row(confidence_score=85.0, vetoes=["HIGH_VOLATILITY", "OVEREXTENDED_ENTRY"]))  # noqa: E501
        self.assertEqual(result["candidate_v3_decision"], "ENTER")
        self.assertEqual(result["candidate_v3_confidence"], 77.0)
        self.assertIn("ADVISORY_HIGH_VOLATILITY", result["candidate_v3_reason_codes"])

    def test_advisory_penalty_never_costs_an_entry(self) -> None:
        # The replay grid measured raw confidence, so the gate reads the raw
        # score; the advisory cost shows up in the reported number and in rank.
        result = evaluate_candidate_v3(_row(confidence_score=76.0, vetoes=["HIGH_VOLATILITY"]))
        self.assertEqual(result["candidate_v3_decision"], "ENTER")
        self.assertEqual(result["candidate_v3_confidence"], 72.0)
        self.assertIn("ADVISORY_HIGH_VOLATILITY", result["candidate_v3_reason_codes"])

    def test_raw_confidence_below_the_floor_still_watches(self) -> None:
        result = evaluate_candidate_v3(_row(confidence_score=74.0, vetoes=["HIGH_VOLATILITY"]))
        self.assertEqual(result["candidate_v3_decision"], "WATCH")
        self.assertIn("LOW_CONFIDENCE", result["candidate_v3_reason_codes"])

    def test_poor_risk_reward_is_re_decided_on_the_balanced_target(self) -> None:
        good = evaluate_candidate_v3(_row(vetoes=["POOR_RISK_REWARD"], balanced_risk_reward_low=2.0))
        self.assertEqual(good["candidate_v3_decision"], "ENTER")
        self.assertIn("ADVISORY_POOR_RISK_REWARD_NEAREST_RESISTANCE", good["candidate_v3_reason_codes"])
        bad = evaluate_candidate_v3(_row(vetoes=["POOR_RISK_REWARD"], balanced_risk_reward_low=0.9, risk_reward=0.6))
        self.assertEqual(bad["candidate_v3_decision"], "AVOID")
        self.assertIn("SEVERE_POOR_RISK_REWARD", bad["candidate_v3_reason_codes"])


class SellSemanticsTests(unittest.TestCase):
    def test_sell_on_an_unheld_symbol_is_no_entry_not_exit(self) -> None:
        result = evaluate_candidate_v3(_row(composite_action="STRONG SELL"))
        self.assertEqual(result["candidate_v3_decision"], "NO_ENTRY")
        self.assertIn("SELL_SIGNAL", result["candidate_v3_reason_codes"])
        self.assertIn("open position", result["candidate_v3_why"])

    def test_non_buy_non_sell_is_watch(self) -> None:
        self.assertEqual(evaluate_candidate_v3(_row(composite_action="WAIT / HOLD"))["candidate_v3_decision"], "WATCH")


class FrameTests(unittest.TestCase):
    def _frame(self) -> pd.DataFrame:
        breakout = _row(
            symbol="BRK", setup_detail="breakout", final_score=84.0, confidence_score=45.0,
            breakout_score_completed=85.0, relative_volume_score_completed=70.0, momentum_score=70.0,
        )
        core = _row(symbol="CORE")
        late = _row(symbol="LATE", entry_status="OVEREXTENDED")
        sell = _row(symbol="SELL", composite_action="SELL")
        blocked = _row(symbol="STALE", vetoes=["STALE_DATA"])
        return pd.DataFrame([row.to_dict() for row in (core, breakout, late, sell, blocked)])

    def test_columns_are_added_and_live_columns_untouched(self) -> None:
        frame = self._frame()
        frame["final_decision"] = "AVOID"
        out = apply_candidate_v3(frame)
        for column in V3_COLUMNS:
            self.assertIn(column, out.columns)
        self.assertEqual(list(out["final_decision"].unique()), ["AVOID"])
        self.assertNotIn("_v3_quality", out.columns)

    def test_ranking_puts_entries_first_and_breakout_ahead_of_the_band_core(self) -> None:
        out = apply_candidate_v3(self._frame()).set_index("symbol")
        self.assertEqual(out.loc["BRK", "candidate_v3_actionability_rank"], 1)
        self.assertEqual(out.loc["CORE", "candidate_v3_actionability_rank"], 2)
        self.assertEqual(out.loc["LATE", "candidate_v3_actionability_rank"], 3)
        self.assertEqual(out.loc["SELL", "candidate_v3_actionability_rank"], 0)
        self.assertEqual(out.loc["STALE", "candidate_v3_actionability_rank"], 0)
        self.assertIn("Rank 1 of 3", out.loc["BRK", "candidate_v3_capital_rank_reason"])
        self.assertIn("66.8%", out.loc["BRK", "candidate_v3_capital_rank_reason"])

    def test_summary_counts_paths_and_where_completeness(self) -> None:
        summary = candidate_v3_summary(apply_candidate_v3(self._frame()))
        self.assertEqual(summary["rows"], 5)
        self.assertEqual(summary["actionable"], 3)
        self.assertEqual(summary["where_complete"], 3)
        self.assertEqual(summary["enter_breakout"], 1)
        self.assertEqual(summary["enter_core"], 1)
        self.assertEqual(summary["by_decision"]["NO_ENTRY"], 1)
        self.assertEqual(summary["by_decision"]["AVOID"], 1)

    def test_empty_frame_is_returned_unchanged(self) -> None:
        empty = pd.DataFrame()
        self.assertTrue(apply_candidate_v3(empty).empty)
        self.assertEqual(candidate_v3_summary(empty), {"rows": 0})


class ConfigTests(unittest.TestCase):
    def test_thresholds_are_configurable_without_touching_the_rules(self) -> None:
        strict = V3Config(core_confidence_min=95.0)
        self.assertEqual(evaluate_candidate_v3(_row(), strict)["candidate_v3_decision"], "WATCH")
        loose = V3Config(breakout_volume_min=10.0, breakout_momentum_min=10.0, breakout_min=10.0)
        self.assertEqual(evaluate_candidate_v3(_row(), loose)["candidate_v3_path"], "BREAKOUT")


if __name__ == "__main__":
    unittest.main()
