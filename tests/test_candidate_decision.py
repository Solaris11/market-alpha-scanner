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

from scanner.analysis import ENTRY_STATUS_PRIORITY
from scanner.candidate_decision import (
    LATE_ENTRY_STATUSES,
    MIN_PRE_EXPANSION,
    MIN_RISK_REWARD,
    CandidateConfig,
    apply_candidate_decision,
    candidate_config,
    candidate_summary,
    evaluate_candidate_decision,
)
from scanner.diagnostics import apply_scoring_diagnostics
from scanner.engine import apply_decision_safety_gates
from scanner.final_decision import ENTER_ENTRY_STATUSES, evaluate_final_trade_decision

#: Every entry_status the scanner can write, read from the producer's own
#: priority table plus the one branch that bypasses it.
REAL_ENTRY_STATUSES = frozenset(ENTRY_STATUS_PRIORITY) | {"WAIT PULLBACK"}


CURRENT = CandidateConfig(mode="current")
CANDIDATE = CandidateConfig(mode="candidate")


def _row(**overrides: object) -> dict[str, object]:
    """A row that clears every candidate gate, so each test moves one thing.

    Deliberately scored at 62 -- inside the 55-70 band, and *below* the live
    engine's 80 floor. That difference is the whole point of the band: the
    live engine cannot express "good enough to act, early enough to matter".
    """
    row: dict[str, object] = {
        "symbol": "AAPL",
        "asset_type": "EQUITY",
        "price": 190.0,
        "final_score": 62.0,
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
        "setup_detail": "pullback to AVWAP",
        "setup_strength": 80.0,
        "confidence_score": 88.0,
        "market_regime": "NEUTRAL",
        "vetoes": [],
        "final_decision": "ENTER",
        "buy_zone": "$185.00-$188.00",
        "stop_loss": "$178.00",
        "take_profit_zone": "$205.00-$212.00",
        "pre_expansion_score": 71.0,
        "pre_expansion_already_expanded": False,
        "data_timestamp": datetime.now(timezone.utc).isoformat(),
        "history_days": 365,
        "data_provider": "yfinance",
        "provider_error": "",
    }
    row.update(overrides)
    return row


def _decide(**overrides: object):
    return evaluate_candidate_decision(pd.Series(_row(**overrides)), CANDIDATE)


def _engine_decisions(rows: list[dict[str, object]]) -> pd.DataFrame:
    """Run rows through the real live decision path and return the finished frame."""
    staged = []
    for row in rows:
        stage_a = evaluate_final_trade_decision(pd.Series(row))
        staged.append({**row, **stage_a})
    return apply_decision_safety_gates(apply_scoring_diagnostics(pd.DataFrame(staged)))


class DefaultModeChangesNothingTests(unittest.TestCase):
    """The deployment safety argument, stated as a test.

    The candidate engine ships wired into the pipeline but selected by nobody.
    If `current` mode could alter a live column, then deploying the code would
    itself be the rollout -- and there would be no way to gather the evidence
    that is supposed to precede it.
    """

    def test_current_mode_leaves_every_engine_column_byte_identical(self) -> None:
        rows = [
            _row(final_score=92.0),
            _row(final_score=62.0),
            _row(final_score=62.0, setup_type="AVOID"),
            _row(final_score=68.0, recommendation_quality="WAIT_PULLBACK"),
            _row(final_score=45.0, composite_action="SELL"),
            _row(final_score=62.0, pre_expansion_already_expanded=True),
        ]
        before = _engine_decisions(rows)
        after = apply_candidate_decision(before, CURRENT)

        for column in before.columns:
            self.assertTrue(
                before[column].astype(str).equals(after[column].astype(str)),
                f"current mode altered the engine column {column!r}",
            )

    def test_current_mode_still_records_the_full_candidate_reasoning(self) -> None:
        before = _engine_decisions([_row()])
        after = apply_candidate_decision(before, CURRENT)

        # This is what makes the comparison measurable before it is trusted.
        self.assertEqual(after.loc[0, "candidate_decision"], "ENTER")
        self.assertEqual(after.loc[0, "final_decision"], before.loc[0, "final_decision"])
        self.assertTrue(after.loc[0, "candidate_why"])

    def test_candidate_mode_is_the_only_thing_that_moves_final_decision(self) -> None:
        before = _engine_decisions([_row()])
        live = before.loc[0, "final_decision"]
        after = apply_candidate_decision(before, CANDIDATE)

        # The fixture is scored 62, below the live 80 floor, so the live engine
        # declines it and the candidate does not. If these agreed the test
        # would prove nothing.
        self.assertNotEqual(live, "ENTER")
        self.assertEqual(after.loc[0, "final_decision"], "ENTER")
        self.assertEqual(after.loc[0, "decision_reason"], after.loc[0, "candidate_why"])

    def test_an_unrecognised_mode_falls_back_to_current(self) -> None:
        self.assertFalse(candidate_config({"SCANNER_DECISION_MODE": "aggressive"}).is_candidate)
        self.assertFalse(candidate_config({}).is_candidate)
        self.assertTrue(candidate_config({"SCANNER_DECISION_MODE": "CANDIDATE"}).is_candidate)

    def test_an_inverted_band_is_repaired_rather_than_obeyed(self) -> None:
        config = candidate_config({"SCANNER_ENTRY_BAND_LOW": "70", "SCANNER_ENTRY_BAND_HIGH": "55"})
        self.assertEqual((config.band_low, config.band_high), (55.0, 70.0))


class ChaseRejectionTests(unittest.TestCase):
    """Fault 4: the live engine sees expansion only after it has happened.

    The owner's complaint in one sentence -- the scanner catches the move late
    and then calls it overextended, which reads as "no signal" rather than
    "you are late". These tests fix the meaning, not just the verdict.
    """

    def test_an_already_expanded_move_is_never_an_enter(self) -> None:
        decision = _decide(pre_expansion_already_expanded=True)
        self.assertNotEqual(decision.decision, "ENTER")
        self.assertIn("ALREADY_EXPANDED", decision.reason_codes)

    def test_an_expanded_move_with_a_pullback_level_says_wait_not_avoid(self) -> None:
        decision = _decide(pre_expansion_already_expanded=True, entry_status="OVEREXTENDED")
        self.assertEqual(decision.decision, "WAIT_PULLBACK")
        # The trader needs to know it is a chase, not that there is no signal.
        self.assertIn("chase", decision.why.lower())
        self.assertTrue(decision.entry_zone)

    def test_an_expanded_move_with_no_pullback_level_says_watch_honestly(self) -> None:
        decision = _decide(
            pre_expansion_already_expanded=True,
            entry_status="OVEREXTENDED",
            buy_zone="",
            entry_zone="",
            suggested_entry="",
        )
        self.assertEqual(decision.decision, "WATCH")
        self.assertIn("NO_PULLBACK_LEVEL", decision.reason_codes)

    def test_expansion_outranks_a_perfect_score(self) -> None:
        # Everything else is ideal. It still does not become an ENTER, because
        # a good setup that has already moved is a worse trade, not a better one.
        decision = _decide(
            pre_expansion_already_expanded=True,
            final_score=68.0,
            confidence_score=95.0,
            risk_reward=3.0,
            pre_expansion_score=95.0,
        )
        self.assertNotEqual(decision.decision, "ENTER")

    def test_an_extended_setup_detail_is_not_classified_as_a_breakout(self) -> None:
        # "extended / watch pullback" is what the scorer writes when RSI >= 75.
        # Reading it as a breakout shape would re-import the fault upstream.
        self.assertEqual(
            _decide(setup_type="AVOID", setup_detail="extended / watch pullback").setup_class,
            "PULLBACK",
        )


class HonestAbstentionTests(unittest.TestCase):
    """Insufficient evidence must produce WATCH, never ENTER.

    A candidate that says ENTER more often is a worse engine. These tests are
    the ones that would fail first if the module drifted toward aggression.
    """

    def test_unmeasurable_pre_expansion_abstains_rather_than_admits(self) -> None:
        decision = _decide(pre_expansion_score=None)
        self.assertEqual(decision.decision, "WATCH")
        self.assertIn("PRE_EXPANSION_UNAVAILABLE", decision.reason_codes)

    def test_a_nan_pre_expansion_score_is_treated_as_unmeasured_not_as_zero(self) -> None:
        # np.nan reaching a `< 45` comparison would be False, silently
        # promoting an unmeasurable row to a pass. It must abstain instead.
        decision = _decide(pre_expansion_score=float("nan"))
        self.assertEqual(decision.decision, "WATCH")
        self.assertIn("PRE_EXPANSION_UNAVAILABLE", decision.reason_codes)

    def test_no_setup_forming_is_a_watch_with_the_number_in_the_reason(self) -> None:
        decision = _decide(pre_expansion_score=MIN_PRE_EXPANSION - 1.0)
        self.assertEqual(decision.decision, "WATCH")
        self.assertIn("NO_SETUP_FORMING", decision.reason_codes)
        self.assertIn("44", decision.why)

    def test_a_missing_final_score_never_becomes_an_enter(self) -> None:
        self.assertEqual(_decide(final_score=None).decision, "WATCH")

    def test_a_sell_signal_is_an_exit_not_a_setup(self) -> None:
        decision = _decide(composite_action="SELL")
        self.assertEqual(decision.decision, "EXIT")

    def test_price_outside_an_enterable_location_is_a_watch(self) -> None:
        decision = _decide(entry_status="REVIEW")
        self.assertEqual(decision.decision, "WATCH")
        self.assertIn("ENTRY_LOCATION", decision.reason_codes)


class RiskRewardTests(unittest.TestCase):
    """The live engine carries min_risk_reward per setup and never applies it.

    `SETUP_THRESHOLDS` defines 1.10 / 1.50 / 1.30 and the decision stage reads
    none of them. Enforcing them is a constraint the candidate adds, not a
    relaxation it takes.
    """

    def test_risk_reward_below_the_pullback_floor_is_an_avoid(self) -> None:
        decision = _decide(setup_type="PULLBACK", risk_reward=1.0)
        self.assertEqual(decision.decision, "AVOID")
        self.assertIn("POOR_RISK_REWARD", decision.reason_codes)

    def test_the_breakout_floor_is_stricter_than_the_pullback_floor(self) -> None:
        # 1.4 passes as a pullback and fails as a breakout. Same number, two
        # answers, because the shapes carry different risk.
        shared = {"risk_reward": 1.4, "final_score": 62.0}
        pullback = _decide(setup_type="PULLBACK", setup_detail="pullback to AVWAP", **shared)
        breakout = _decide(setup_type="BREAKOUT", setup_detail="breakout continuation", **shared)
        self.assertEqual(pullback.decision, "ENTER")
        self.assertEqual(breakout.decision, "AVOID")
        self.assertGreater(MIN_RISK_REWARD["BREAKOUT"], MIN_RISK_REWARD["PULLBACK"])

    def test_the_reason_names_the_floor_it_failed_against(self) -> None:
        why = _decide(setup_type="BREAKOUT", setup_detail="breakout continuation", risk_reward=1.2).why
        self.assertIn("1.20", why)
        self.assertIn("1.50", why)


class EntryBandTests(unittest.TestCase):
    """A band is a range. A floor that starts lower is just a lower floor."""

    def test_a_score_above_the_band_is_declined_as_late(self) -> None:
        decision = _decide(final_score=92.0)
        self.assertNotEqual(decision.decision, "ENTER")
        self.assertIn("ABOVE_ENTRY_BAND", decision.reason_codes)
        self.assertIn("late", decision.why.lower())

    def test_a_score_below_the_band_is_declined_as_early(self) -> None:
        decision = _decide(final_score=40.0)
        self.assertEqual(decision.decision, "WATCH")
        self.assertIn("BELOW_ENTRY_BAND", decision.reason_codes)

    def test_the_band_edges_are_inclusive_on_both_sides(self) -> None:
        self.assertEqual(_decide(final_score=55.0).decision, "ENTER")
        self.assertEqual(_decide(final_score=70.0).decision, "ENTER")
        self.assertNotEqual(_decide(final_score=70.01).decision, "ENTER")
        self.assertNotEqual(_decide(final_score=54.99).decision, "ENTER")

    def test_a_high_score_with_a_pullback_level_still_tells_the_trader_where(self) -> None:
        decision = _decide(final_score=92.0, entry_status="OVEREXTENDED")
        self.assertEqual(decision.decision, "WAIT_PULLBACK")


class VetoSeverityTests(unittest.TestCase):
    """Fault 3: `trade_permitted` requires an empty veto list.

    So HIGH_VOLATILITY blocks entry exactly as hard as a stale price feed, and
    a market-wide regime flag would block every symbol on the same day. The
    candidate prices advisories instead of obeying them.
    """

    def test_a_severe_veto_still_blocks_absolutely(self) -> None:
        decision = _decide(vetoes=["STALE_DATA"])
        self.assertEqual(decision.decision, "AVOID")
        self.assertIn("SEVERE_VETO", decision.reason_codes)

    def test_an_advisory_veto_costs_confidence_instead_of_blocking(self) -> None:
        decision = _decide(vetoes=["HIGH_VOLATILITY"], confidence_score=88.0)
        self.assertEqual(decision.decision, "ENTER")
        self.assertEqual(decision.confidence_penalty, 6.0)
        self.assertEqual(decision.advisory_vetoes, ["HIGH_VOLATILITY"])
        self.assertIn("ADVISORY_HIGH_VOLATILITY", decision.reason_codes)

    def test_enough_advisories_do_eventually_block(self) -> None:
        # The point is that they are priced, not that they are free. Four
        # advisories cost 24 points, which drops 88 below the 70 needed to act.
        decision = _decide(
            vetoes=["HIGH_VOLATILITY", "OVEREXTENDED_ENTRY", "RISK_OFF_MARKET", "BEAR_MARKET"],
            confidence_score=88.0,
        )
        self.assertEqual(decision.decision, "WATCH")
        self.assertIn("LOW_CONFIDENCE", decision.reason_codes)
        self.assertEqual(decision.confidence_penalty, 24.0)

    def test_severity_is_decided_by_the_code_not_by_list_length(self) -> None:
        # One severe veto outranks any number of advisories.
        decision = _decide(vetoes=["HIGH_VOLATILITY", "STALE_DATA", "BEAR_MARKET"])
        self.assertEqual(decision.decision, "AVOID")
        self.assertEqual(decision.severe_vetoes, ["STALE_DATA"])


class SetupClassIsAShapeNotAVerdictTests(unittest.TestCase):
    """Fault 1 and 2: AVOID is a verdict living in a classification field.

    It arrives through the catch-all else branch, so it is the *default*
    outcome; then `setup_strength` is capped at 49 against an unreachable
    threshold of 101, so the verdict is counted a second time.
    """

    def test_avoid_is_not_a_shape_and_carries_no_penalty_of_its_own(self) -> None:
        decision = _decide(setup_type="AVOID", setup_detail="pullback to AVWAP")
        self.assertEqual(decision.setup_class, "PULLBACK")
        self.assertEqual(decision.decision, "ENTER")

    def test_a_capped_setup_strength_does_not_re_enter_as_a_second_penalty(self) -> None:
        # 49.0 is the cap `setup_strength_for_type` applies to every AVOID row.
        # The live engine then compares it against 101 and can never pass.
        decision = _decide(setup_type="AVOID", setup_detail="trend continuation", setup_strength=49.0)
        self.assertEqual(decision.setup_class, "CONTINUATION")
        self.assertEqual(decision.decision, "ENTER")

    def test_an_unrecognised_shape_is_none_rather_than_a_rejection(self) -> None:
        decision = _decide(setup_type="AVOID", setup_detail="mixed setup")
        self.assertEqual(decision.setup_class, "NONE")
        # NONE is a shape with a floor of its own, not an automatic decline.
        self.assertEqual(decision.decision, "ENTER")

    def test_breakout_continuation_is_read_as_a_breakout(self) -> None:
        # Order matters: the string contains both words, and the risk floors
        # differ, so reading it as a continuation would under-protect it.
        self.assertEqual(_decide(setup_type="", setup_detail="breakout continuation").setup_class, "BREAKOUT")

    def test_a_declared_shape_is_trusted_over_the_free_text(self) -> None:
        self.assertEqual(_decide(setup_type="PULLBACK", setup_detail="breakout continuation").setup_class, "PULLBACK")

    def test_quality_avoid_is_still_respected_because_it_is_evidence(self) -> None:
        # Removing the double-count is not the same as removing the judgement.
        decision = _decide(recommendation_quality="AVOID")
        self.assertEqual(decision.decision, "AVOID")
        self.assertIn("LOW_QUALITY", decision.reason_codes)


class EntryLocationTests(unittest.TestCase):
    """"Not enterable" is two situations, and the live engine renders both as silence.

    These fixtures use the vocabulary the producers actually emit. An earlier
    draft of this file invented "ABOVE ENTRY" and "EXTENDED"; both are strings
    no scanner has ever written, and every assertion against them was
    vacuously green. That is the same class of mistake as a test fixture
    holding a percentage where the producer emits a fraction.
    """

    def test_the_fixture_vocabulary_is_the_vocabulary_the_producers_emit(self) -> None:
        produced = set(REAL_ENTRY_STATUSES)
        self.assertTrue(
            LATE_ENTRY_STATUSES.issubset(produced),
            f"LATE_ENTRY_STATUSES names a status nothing produces: {LATE_ENTRY_STATUSES - produced}",
        )
        self.assertTrue(set(ENTER_ENTRY_STATUSES).issubset(produced))

    def test_a_move_past_its_zone_is_told_where_not_told_nothing(self) -> None:
        for status in sorted(LATE_ENTRY_STATUSES):
            with self.subTest(status=status):
                decision = _decide(entry_status=status)
                self.assertEqual(decision.decision, "WAIT_PULLBACK")
                self.assertIn("LATE_ENTRY", decision.reason_codes)
                self.assertTrue(decision.entry_zone)

    def test_an_unknown_location_stays_a_watch_because_there_is_no_level(self) -> None:
        # REVIEW means the scorer could not place price against the zone.
        # Inventing a pullback level here would be a guess wearing a number.
        decision = _decide(entry_status="REVIEW")
        self.assertEqual(decision.decision, "WATCH")
        self.assertNotIn("LATE_ENTRY", decision.reason_codes)

    def test_stop_risk_is_not_a_pullback_invitation(self) -> None:
        # STOP RISK means the invalidation sits too close, which no amount of
        # waiting fixes. Calling it WAIT_PULLBACK would be a false promise.
        decision = _decide(entry_status="STOP RISK")
        self.assertEqual(decision.decision, "WATCH")

    def test_a_late_entry_with_no_level_does_not_promise_one(self) -> None:
        decision = _decide(entry_status="OVEREXTENDED", buy_zone="", entry_zone="", suggested_entry="")
        self.assertEqual(decision.decision, "WATCH")


class ExplainabilityTests(unittest.TestCase):
    """Rubric criterion: a verdict a trader cannot act on is not a verdict."""

    def test_every_verdict_carries_a_why_and_the_levels_it_depends_on(self) -> None:
        for overrides in (
            {},
            {"final_score": 92.0},
            {"final_score": 40.0},
            {"pre_expansion_already_expanded": True},
            {"risk_reward": 1.0},
            {"vetoes": ["STALE_DATA"]},
            {"composite_action": "SELL"},
            {"pre_expansion_score": None},
        ):
            with self.subTest(overrides=overrides):
                decision = _decide(**overrides)
                self.assertTrue(decision.why.strip(), "empty explanation")
                self.assertTrue(decision.reason_codes, "no reason codes")
                # The stop travels with every verdict, so a WAIT that later
                # becomes an ENTER does not need a second lookup.
                self.assertTrue(decision.stop_loss)

    def test_an_enter_states_the_score_the_band_and_the_risk_reward(self) -> None:
        why = _decide().why
        for fragment in ("62", "55", "70", "1.80", "pullback"):
            self.assertIn(fragment, why)


class SummaryTests(unittest.TestCase):
    def test_the_summary_counts_chases_admitted_which_should_always_be_zero(self) -> None:
        frame = apply_candidate_decision(
            _engine_decisions(
                [
                    _row(),
                    _row(pre_expansion_already_expanded=True),
                    _row(final_score=92.0),
                    _row(composite_action="SELL"),
                ]
            ),
            CURRENT,
        )
        summary = candidate_summary(frame)
        self.assertEqual(summary["rows"], 4)
        self.assertEqual(summary["enter"], 1)
        self.assertEqual(summary["enter_already_expanded"], 0)

    def test_an_empty_frame_reports_zero_rather_than_raising(self) -> None:
        self.assertEqual(candidate_summary(pd.DataFrame()), {"rows": 0})
        empty = pd.DataFrame()
        self.assertTrue(apply_candidate_decision(empty, CANDIDATE).empty)


if __name__ == "__main__":
    unittest.main()
