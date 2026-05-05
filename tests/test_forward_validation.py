from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import pandas as pd

from scanner.analysis import compute_forward_returns, expectancy_metrics, sample_size_label, summarize_group_performance


def _snapshot_row(timestamp: str, price: float, symbol: str = "NVDA") -> dict[str, object]:
    return {
        "timestamp_utc": timestamp,
        "symbol": symbol,
        "company_name": "NVIDIA",
        "asset_type": "EQUITY",
        "sector": "Technology",
        "price": price,
        "final_score": 82.0,
        "confidence_score": 76.0,
        "data_quality_score": 94.0,
        "rating": "TOP",
        "action": "BUY",
        "final_decision": "WATCH",
        "setup_type": "PULLBACK",
        "entry_status": "GOOD ENTRY",
        "market_regime": "NEUTRAL",
        "recommendation_quality": "TRADE_READY",
        "trade_quality": "good",
    }


class ForwardValidationTests(unittest.TestCase):
    def test_sample_size_classification(self) -> None:
        self.assertEqual(sample_size_label(0), "LOW")
        self.assertEqual(sample_size_label(29), "LOW")
        self.assertEqual(sample_size_label(30), "MEDIUM")
        self.assertEqual(sample_size_label(100), "MEDIUM")
        self.assertEqual(sample_size_label(101), "HIGH")

    def test_expectancy_calculation(self) -> None:
        metrics = expectancy_metrics(pd.Series([0.10, 0.05, -0.04, -0.02]))
        self.assertAlmostEqual(metrics["hit_rate"], 0.5)
        self.assertAlmostEqual(metrics["loss_rate"], 0.5)
        self.assertAlmostEqual(metrics["avg_win"], 0.075)
        self.assertAlmostEqual(metrics["avg_loss"], 0.03)
        self.assertAlmostEqual(metrics["expectancy"], 0.0225)

    def test_forward_returns_include_requested_horizons_and_signal_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            history_dir = Path(tmp_dir) / "history"
            history_dir.mkdir()
            rows = [
                _snapshot_row("2026-05-01T00:00:00+00:00", 100.0),
                _snapshot_row("2026-05-02T00:00:00+00:00", 101.0),
                _snapshot_row("2026-05-04T00:00:00+00:00", 104.0),
                _snapshot_row("2026-05-06T00:00:00+00:00", 105.0),
                _snapshot_row("2026-05-11T00:00:00+00:00", 110.0),
                _snapshot_row("2026-05-21T00:00:00+00:00", 120.0),
            ]
            for index, row in enumerate(rows):
                pd.DataFrame([row]).to_csv(history_dir / f"scan_202605{index + 1:02d}_000000.csv", index=False)

            forward = compute_forward_returns(str(history_dir), analysis_raw=True)
            horizons = set(forward["horizon"].dropna().astype(str).tolist())
            for horizon in ("1D", "3D", "5D", "10D", "20D"):
                self.assertIn(horizon, horizons)

            first = forward.iloc[0]
            self.assertEqual(first["final_decision"], "WATCH")
            self.assertEqual(first["setup_type"], "PULLBACK")
            self.assertAlmostEqual(float(first["confidence_score"]), 76.0)
            self.assertAlmostEqual(float(first["data_quality_score"]), 94.0)
            self.assertTrue(str(first["signal_created_at"]).startswith("2026-05-01"))

    def test_summary_includes_expectancy_and_sample_confidence(self) -> None:
        forward = pd.DataFrame(
            [
                {"horizon": "5D", "setup_type": "PULLBACK", "forward_return": 0.08, "max_drawdown_after_signal": -0.02, "max_gain_after_signal": 0.10},
                {"horizon": "5D", "setup_type": "PULLBACK", "forward_return": -0.04, "max_drawdown_after_signal": -0.07, "max_gain_after_signal": 0.01},
            ]
        )
        summary = summarize_group_performance(forward, "setup_type")
        row = summary.iloc[0]
        self.assertEqual(row["sample_size"], "LOW")
        self.assertEqual(row["sample_confidence"], "LOW")
        self.assertIn("expectancy", summary.columns)
        self.assertAlmostEqual(float(row["expectancy"]), 0.02)


if __name__ == "__main__":
    unittest.main()
