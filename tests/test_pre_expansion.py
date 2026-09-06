from __future__ import annotations

import unittest

import numpy as np
import pandas as pd

from scanner.pre_expansion import (
    ALREADY_EXPANDED_EXTENSION,
    EXPANDED_SCORE_CAP,
    MIN_BARS,
    apply_pre_expansion,
    compute_pre_expansion,
)


def _bars(closes: list[float], volumes: list[float] | None = None, spread: float = 0.01) -> pd.DataFrame:
    """OHLCV from a close path, with each bar's range proportional to `spread`."""
    volume_series = volumes if volumes is not None else [1_000_000.0] * len(closes)
    index = pd.date_range("2025-01-01", periods=len(closes), freq="D")
    return pd.DataFrame(
        {
            "open": [value * (1 - spread / 4) for value in closes],
            "high": [value * (1 + spread) for value in closes],
            "low": [value * (1 - spread) for value in closes],
            "close": closes,
            "volume": volume_series,
        },
        index=index,
    )


def _noisy_base(length: int, level: float = 100.0, amplitude: float = 6.0, seed: int = 7) -> list[float]:
    """A wide, choppy range: the thing a tightening base is measured against."""
    rng = np.random.default_rng(seed)
    return [level + rng.uniform(-amplitude, amplitude) for _ in range(length)]


def _tightening_base(length: int, level: float = 100.0, seed: int = 3) -> list[float]:
    """Amplitude decaying toward the end, price holding the upper half."""
    rng = np.random.default_rng(seed)
    closes = []
    for index in range(length):
        decay = 1.0 - (index / max(1, length - 1)) * 0.92
        closes.append(level + rng.uniform(-6.0, 6.0) * decay + 1.6 * (index / max(1, length - 1)))
    return closes


class DataSufficiencyTests(unittest.TestCase):
    """An unmeasurable setup must say so. A zero would be indistinguishable
    from 'measured, and bad' -- this codebase has already shipped one bug of
    exactly that shape."""

    def test_too_few_bars_is_unavailable_not_zero(self) -> None:
        result = compute_pre_expansion(_bars([100.0] * (MIN_BARS - 1)))
        self.assertFalse(result.available)
        self.assertIsNone(result.score)
        self.assertNotEqual(result.score, 0)
        self.assertIn("usable bars", result.detail)

    def test_missing_columns_is_unavailable(self) -> None:
        frame = pd.DataFrame({"close": [1.0] * 100})
        result = compute_pre_expansion(frame)
        self.assertFalse(result.available)
        self.assertIn("missing OHLCV", result.detail)

    def test_short_history_scores_but_flags_reduced_confidence(self) -> None:
        result = compute_pre_expansion(_bars(_tightening_base(60)))
        self.assertTrue(result.available)
        self.assertTrue(result.reduced_confidence)
        self.assertIn("REDUCED_HISTORY", result.reason_codes)

    def test_long_history_is_full_confidence(self) -> None:
        result = compute_pre_expansion(_bars(_tightening_base(200)))
        self.assertTrue(result.available)
        self.assertFalse(result.reduced_confidence)


class AlreadyExpandedTests(unittest.TestCase):
    """The point of the module. A base that has broken is not a setup."""

    def test_a_completed_breakout_is_flagged_and_capped(self) -> None:
        closes = _noisy_base(150) + [118.0, 122.0, 126.0, 129.0, 131.0]
        result = compute_pre_expansion(_bars(closes))
        self.assertTrue(result.available)
        self.assertTrue(result.already_expanded)
        self.assertIn("ALREADY_EXPANDED", result.reason_codes)
        self.assertLessEqual(result.score, EXPANDED_SCORE_CAP)

    def test_the_cap_beats_otherwise_good_components(self) -> None:
        """Compression looked textbook right up until it broke. That must not
        be enough to score well after the break."""
        closes = _tightening_base(150) + [112.0, 118.0, 124.0, 128.0, 132.0]
        result = compute_pre_expansion(_bars(closes))
        self.assertTrue(result.already_expanded)
        self.assertLessEqual(result.score, EXPANDED_SCORE_CAP)

    def test_price_just_under_the_pivot_is_not_flagged(self) -> None:
        closes = _noisy_base(150, amplitude=4.0)
        pivot = max(closes[:-5])
        closes = closes + [pivot * 0.995] * 5
        result = compute_pre_expansion(_bars(closes))
        self.assertFalse(result.already_expanded)

    def test_the_extension_threshold_is_where_it_says_it_is(self) -> None:
        base = [100.0 + (index % 5) * 0.4 for index in range(150)]
        pivot = max(_bars(base).iloc[-60:-5]["high"])
        below = pivot * (1 + ALREADY_EXPANDED_EXTENSION - 0.01)
        above = pivot * (1 + ALREADY_EXPANDED_EXTENSION + 0.01)
        self.assertFalse(compute_pre_expansion(_bars(base + [below] * 3)).already_expanded)
        self.assertTrue(compute_pre_expansion(_bars(base + [above] * 3)).already_expanded)


class SetupQualityTests(unittest.TestCase):
    def test_a_tightening_base_outscores_a_choppy_one(self) -> None:
        tight = compute_pre_expansion(_bars(_tightening_base(180), spread=0.004))
        choppy = compute_pre_expansion(_bars(_noisy_base(180), spread=0.03))
        self.assertTrue(tight.available and choppy.available)
        self.assertGreater(
            tight.score,
            choppy.score,
            f"tight {tight.score} should beat choppy {choppy.score}",
        )

    def test_compression_is_detected_and_named(self) -> None:
        closes = _noisy_base(120, amplitude=8.0) + [100.0 + (index % 3) * 0.15 for index in range(40)]
        result = compute_pre_expansion(_bars(closes, spread=0.002))
        self.assertIn("BANDS_COMPRESSED", result.reason_codes)
        self.assertGreater(result.components.get("compression", 0), 60)

    def test_volume_accumulation_raises_the_score(self) -> None:
        closes = _tightening_base(160)
        heavy_on_up_days = []
        for index, value in enumerate(closes):
            rising = index > 0 and value > closes[index - 1]
            heavy_on_up_days.append(2_600_000.0 if rising else 700_000.0)
        flat = [1_000_000.0] * len(closes)

        accumulating = compute_pre_expansion(_bars(closes, heavy_on_up_days))
        neutral = compute_pre_expansion(_bars(closes, flat))
        self.assertGreater(accumulating.components["volume_accumulation"], neutral.components["volume_accumulation"])
        self.assertIn("VOLUME_ACCUMULATION", accumulating.reason_codes)
        self.assertGreater(accumulating.score, neutral.score)

    def test_relative_strength_needs_a_benchmark_and_says_so(self) -> None:
        closes = _tightening_base(160)
        without = compute_pre_expansion(_bars(closes))
        self.assertNotIn("relative_strength", without.components)

        # Outperforming a flat benchmark.
        benchmark = pd.Series([100.0] * 160)
        with_benchmark = compute_pre_expansion(_bars([value * 1.0 for value in closes]), benchmark)
        self.assertIn("relative_strength", with_benchmark.components)

    def test_outperformance_is_recognised(self) -> None:
        closes = _tightening_base(160)
        falling_benchmark = pd.Series(np.linspace(110.0, 96.0, 160))
        result = compute_pre_expansion(_bars(closes), falling_benchmark)
        self.assertIn("OUTPERFORMING_BENCHMARK", result.reason_codes)

    # Found by reading the numbers rather than the assertions: with a `<=`
    # percentile a constant series ranks every member at 1.0, so a symbol whose
    # volatility never changes scored as maximally *un*compressed.
    def test_a_constant_history_is_neutral_on_compression_not_zero(self) -> None:
        result = compute_pre_expansion(_bars([100.0] * 200))
        self.assertTrue(result.available)
        self.assertAlmostEqual(result.components["compression"], 50.0, delta=1.0)

    def test_score_stays_inside_bounds(self) -> None:
        for closes in (_tightening_base(200), _noisy_base(200), [100.0] * 200):
            result = compute_pre_expansion(_bars(closes))
            if result.available:
                self.assertGreaterEqual(result.score, 0.0)
                self.assertLessEqual(result.score, 100.0)

    # Look-ahead is the failure mode that would make every backtest lie.
    def test_the_score_does_not_change_when_later_bars_are_appended(self) -> None:
        closes = _tightening_base(180)
        as_of = compute_pre_expansion(_bars(closes))
        with_future = compute_pre_expansion(_bars(closes + [140.0, 150.0, 160.0]))
        recomputed_at_the_same_bar = compute_pre_expansion(_bars((closes + [140.0, 150.0, 160.0])[: len(closes)]))
        self.assertEqual(as_of.score, recomputed_at_the_same_bar.score)
        self.assertNotEqual(as_of.score, with_future.score)


class FrameApplicationTests(unittest.TestCase):
    def test_apply_adds_only_pre_expansion_columns(self) -> None:
        frame = pd.DataFrame([{"symbol": "AMD", "final_decision": "WATCH", "final_score": 61.0}])
        price_map = {"AMD": _bars(_tightening_base(150))}
        result = apply_pre_expansion(frame, price_map)

        for column in frame.columns:
            pd.testing.assert_series_equal(result[column], frame[column], check_names=False)
        added = set(result.columns) - set(frame.columns)
        self.assertTrue(all(name.startswith("pre_expansion_") for name in added), added)
        self.assertTrue(bool(result.iloc[0]["pre_expansion_available"]))

    def test_a_symbol_with_no_history_is_honest_about_it(self) -> None:
        frame = pd.DataFrame([{"symbol": "NOHIST", "final_decision": "WATCH"}])
        result = apply_pre_expansion(frame, {})
        self.assertFalse(bool(result.iloc[0]["pre_expansion_available"]))
        self.assertIsNone(result.iloc[0]["pre_expansion_score"])
        self.assertIn("no price history", result.iloc[0]["pre_expansion_detail"])

    def test_empty_frame_is_handled(self) -> None:
        self.assertTrue(apply_pre_expansion(pd.DataFrame(), {}).empty)


if __name__ == "__main__":
    unittest.main()
