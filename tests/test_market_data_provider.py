from __future__ import annotations

import unittest
from datetime import datetime, timezone

import pandas as pd

from scanner.diagnostics import data_quality_flags, vetoes_for_row
from scanner.engine import attach_price_data_quality
from scanner.market_data import (
    AlpacaProvider,
    ProviderMetadata,
    ProviderResponse,
    ProviderRouter,
    YFinanceProvider,
    alpaca_bars_to_frame,
    alpaca_symbol_for,
)


def _frame() -> pd.DataFrame:
    frame = pd.DataFrame(
        [
            {"Open": 99.0, "High": 101.0, "Low": 98.5, "Close": 100.0, "Adj Close": 100.0, "Volume": 1_000_000.0},
            {"Open": 100.0, "High": 103.0, "Low": 99.0, "Close": 102.0, "Adj Close": 102.0, "Volume": 1_200_000.0},
        ],
        index=pd.DatetimeIndex([pd.Timestamp("2026-05-04T00:00:00Z"), pd.Timestamp("2026-05-05T00:00:00Z")], name="Date"),
    )
    return frame


class FakeAlpacaProvider(AlpacaProvider):
    def __init__(self, response: ProviderResponse) -> None:
        super().__init__(api_key="configured", secret_key="configured")
        self.response = response

    def get_daily_bars_many(self, symbols: list[str], start: str | None = None, end: str | None = None) -> ProviderResponse:
        _ = (symbols, start, end)
        return self.response


class FakeYFinanceProvider(YFinanceProvider):
    def __init__(self, response: ProviderResponse) -> None:
        self.response = response

    def get_daily_bars_many(self, symbols: list[str], *, period: str = "2y", start: str | None = None, end: str | None = None) -> ProviderResponse:
        _ = (symbols, period, start, end)
        return self.response


class MarketDataProviderTests(unittest.TestCase):
    def test_alpaca_bars_are_normalized(self) -> None:
        frame = alpaca_bars_to_frame(
            [
                {"t": "2026-05-04T00:00:00Z", "o": 10, "h": 11, "l": 9, "c": 10.5, "v": 12345},
                {"t": "2026-05-05T00:00:00Z", "o": 10.5, "h": 12, "l": 10, "c": 11.5, "v": 23456},
            ]
        )
        self.assertEqual(list(frame.columns), ["Open", "High", "Low", "Close", "Adj Close", "Volume"])
        self.assertEqual(float(frame["Close"].iloc[-1]), 11.5)
        self.assertEqual(float(frame["Volume"].iloc[-1]), 23456.0)

    def test_unsupported_symbol_falls_back_to_yfinance(self) -> None:
        yfinance_frame = _frame()
        fallback = ProviderResponse(
            frames={"BTC-USD": yfinance_frame},
            metadata={
                "BTC-USD": ProviderMetadata(
                    data_provider="yfinance",
                    data_provider_primary="yfinance",
                    data_provider_fallback_used=False,
                    fallback_reason="",
                    alpaca_request_id="",
                    provider_latency_ms=25.0,
                    provider_error="",
                )
            },
            errors={},
        )
        router = ProviderRouter(
            primary="alpaca",
            fallback="yfinance",
            alpaca=FakeAlpacaProvider(ProviderResponse(frames={}, metadata={}, errors={"BTC-USD": "alpaca_unsupported_symbol"})),
            yfinance_provider=FakeYFinanceProvider(fallback),
        )

        frames = router.get_daily_bars_many(["BTC-USD"], period="2y")

        self.assertIn("BTC-USD", frames)
        metadata = frames["BTC-USD"].attrs["provider_metadata"]
        self.assertEqual(metadata["data_provider"], "yfinance")
        self.assertEqual(metadata["data_provider_primary"], "alpaca")
        self.assertTrue(metadata["data_provider_fallback_used"])
        self.assertEqual(metadata["fallback_reason"], "alpaca_unsupported_symbol")

    def test_alpaca_success_metadata_is_preserved(self) -> None:
        frame = _frame()
        metadata = ProviderMetadata(
            data_provider="alpaca",
            data_provider_primary="alpaca",
            data_provider_fallback_used=False,
            fallback_reason="",
            alpaca_request_id="req-123",
            provider_latency_ms=31.5,
            provider_error="",
        )
        frame.attrs["provider_metadata"] = metadata.to_dict()
        router = ProviderRouter(
            primary="alpaca",
            fallback="yfinance",
            alpaca=FakeAlpacaProvider(ProviderResponse(frames={"AAPL": frame}, metadata={"AAPL": metadata}, errors={})),
            yfinance_provider=FakeYFinanceProvider(ProviderResponse(frames={}, metadata={}, errors={})),
        )

        frames = router.get_daily_bars_many(["AAPL"], period="2y")

        self.assertEqual(frames["AAPL"].attrs["provider_metadata"]["data_provider"], "alpaca")
        self.assertEqual(frames["AAPL"].attrs["provider_metadata"]["alpaca_request_id"], "req-123")

    def test_provider_metadata_is_attached_to_scanner_payload_columns(self) -> None:
        frame = _frame()
        frame.attrs["provider_metadata"] = ProviderMetadata(
            data_provider="alpaca",
            data_provider_primary="alpaca",
            data_provider_fallback_used=False,
            fallback_reason="",
            alpaca_request_id="request-id",
            provider_latency_ms=42.0,
            provider_error="",
        ).to_dict()
        ranked = pd.DataFrame([{"symbol": "AAPL", "price": 102.0}])

        attached = attach_price_data_quality(ranked, {"AAPL": frame}).iloc[0]

        self.assertEqual(attached["data_provider"], "alpaca")
        self.assertEqual(attached["data_provider_primary"], "alpaca")
        self.assertEqual(attached["alpaca_request_id"], "request-id")
        self.assertEqual(attached["provider_latency_ms"], 42.0)
        self.assertFalse(bool(attached["data_provider_fallback_used"]))

    def test_symbol_coverage_rules_keep_crypto_on_fallback(self) -> None:
        self.assertIsNone(alpaca_symbol_for("BTC-USD"))
        self.assertEqual(alpaca_symbol_for("GLD"), "GLD")
        self.assertEqual(alpaca_symbol_for("USO"), "USO")
        self.assertEqual(alpaca_symbol_for("SPY"), "SPY")
        self.assertEqual(alpaca_symbol_for("QQQ"), "QQQ")
        self.assertEqual(alpaca_symbol_for("IBIT"), "IBIT")
        self.assertEqual(alpaca_symbol_for("TSM"), "TSM")
        self.assertEqual(alpaca_symbol_for("ASML"), "ASML")

    def test_fallback_reduces_data_quality_without_provider_error_veto(self) -> None:
        now_text = datetime.now(timezone.utc).isoformat()
        base_row = {
            "price": 100.0,
            "final_score": 75.0,
            "technical_score": 75.0,
            "trend_score": 75.0,
            "momentum_score": 70.0,
            "breakout_score": 65.0,
            "relative_volume_score": 65.0,
            "macro_score": 65.0,
            "risk_reward": 2.0,
            "atr_pct": 3.0,
            "annualized_volatility": 0.25,
            "history_days": 260,
            "data_timestamp": now_text,
            "data_provider_fallback_used": True,
            "provider_error": "",
        }

        quality = data_quality_flags(base_row)
        vetoes = vetoes_for_row(base_row, quality)

        self.assertEqual(quality["data_quality_score"], 95.0)
        self.assertNotIn("PROVIDER_ERROR", vetoes)

    def test_provider_error_creates_low_confidence_data_veto(self) -> None:
        now_text = datetime.now(timezone.utc).isoformat()
        row = {
            "price": 100.0,
            "final_score": 75.0,
            "technical_score": 75.0,
            "trend_score": 75.0,
            "momentum_score": 70.0,
            "breakout_score": 65.0,
            "relative_volume_score": 65.0,
            "macro_score": 65.0,
            "risk_reward": 2.0,
            "atr_pct": 3.0,
            "annualized_volatility": 0.25,
            "history_days": 260,
            "data_timestamp": now_text,
            "provider_error": "alpaca_auth_failed;yfinance_missing_data",
        }

        quality = data_quality_flags(row)
        vetoes = vetoes_for_row(row, quality)

        self.assertTrue(quality["low_confidence_data"])
        self.assertIn("LOW_CONFIDENCE_DATA", vetoes)
        self.assertIn("PROVIDER_ERROR", vetoes)


if __name__ == "__main__":
    unittest.main()
