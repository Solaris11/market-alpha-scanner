from __future__ import annotations

import json
import os
import unittest
from datetime import datetime, timezone
from typing import Any

from scanner.event_llm import build_event_llm_request_payload, event_llm_timeout_seconds, validate_event_llm_assessment


class EventLlmGroundingTests(unittest.TestCase):
    def test_openai_payload_uses_model_without_temperature_or_secret_leakage(self) -> None:
        previous = os.environ.get("OPENAI_API_KEY")
        try:
            os.environ["OPENAI_API_KEY"] = "test-secret-that-must-not-enter-payload"
            payload = build_event_llm_request_payload(
                model="gpt-5.5",
                source="Bureau of Labor Statistics",
                title="BLS reports inflation pressure remains elevated",
                summary="The release discusses consumer price index pressure.",
                source_url="https://www.bls.gov/news.release/cpi.htm",
                published_at=datetime(2026, 5, 8, tzinfo=timezone.utc),
            )
            serialized = json.dumps(payload)

            self.assertEqual(payload["model"], "gpt-5.5")
            self.assertNotIn("temperature", payload)
            self.assertNotIn("OPENAI_API_KEY", serialized)
            self.assertNotIn("test-secret-that-must-not-enter-payload", serialized)
            self.assertIn("json_schema", serialized)
        finally:
            if previous is None:
                os.environ.pop("OPENAI_API_KEY", None)
            else:
                os.environ["OPENAI_API_KEY"] = previous

    def test_timeout_env_is_bounded(self) -> None:
        previous = os.environ.get("TRADEVETO_EVENT_LLM_TIMEOUT_SECONDS")
        try:
            os.environ["TRADEVETO_EVENT_LLM_TIMEOUT_SECONDS"] = "0.1"
            self.assertEqual(event_llm_timeout_seconds(), 2.0)
            os.environ["TRADEVETO_EVENT_LLM_TIMEOUT_SECONDS"] = "999"
            self.assertEqual(event_llm_timeout_seconds(), 20.0)
            os.environ["TRADEVETO_EVENT_LLM_TIMEOUT_SECONDS"] = "8"
            self.assertEqual(event_llm_timeout_seconds(), 8.0)
        finally:
            if previous is None:
                os.environ.pop("TRADEVETO_EVENT_LLM_TIMEOUT_SECONDS", None)
            else:
                os.environ["TRADEVETO_EVENT_LLM_TIMEOUT_SECONDS"] = previous

    def test_validated_assessment_accepts_grounded_event_output(self) -> None:
        raw: dict[str, Any] = {
            "asset_classes": ["equity"],
            "category": "macro",
            "confidence": 0.84,
            "conviction_bias": -1.0,
            "direction": "negative",
            "event_type": "inflation",
            "evidence_phrases": ["inflation pressure remains elevated"],
            "explanation": "Inflation pressure remains elevated in the provided source text.",
            "fragility_bias": 2.2,
            "impact_tags": ["inflation_pressure"],
            "pressure_score": 72,
            "reason_codes": ["EVENT_INFLATION_PRESSURE"],
            "regime_tags": ["macro_pressure"],
            "sectors": ["technology"],
            "shock_bias": 1.4,
        }

        assessment = validate_event_llm_assessment(raw, "BLS reports inflation pressure remains elevated")

        self.assertIsNotNone(assessment)
        if assessment is None:
            self.fail("assessment should be grounded")
        self.assertEqual(assessment["event_type"], "inflation")
        self.assertEqual(assessment["reason_codes"], ["EVENT_INFLATION_PRESSURE"])

    def test_validated_assessment_rejects_unsupported_evidence_and_forbidden_language(self) -> None:
        raw: dict[str, Any] = {
            "asset_classes": ["equity"],
            "category": "macro",
            "confidence": 0.91,
            "conviction_bias": 2.0,
            "direction": "positive",
            "event_type": "fed_rates",
            "evidence_phrases": ["Fed announced a surprise cut"],
            "explanation": "Buy now because this will definitely work.",
            "fragility_bias": 0.0,
            "impact_tags": ["liquidity_supportive"],
            "pressure_score": 35,
            "reason_codes": ["EVENT_DOVISH_RATE_SURPRISE"],
            "regime_tags": ["risk_on"],
            "sectors": ["technology"],
            "shock_bias": 1.0,
        }

        self.assertIsNone(validate_event_llm_assessment(raw, "BLS reports inflation pressure remains elevated"))


if __name__ == "__main__":
    unittest.main()
