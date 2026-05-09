from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime
from typing import Final, TypedDict

from .utils import clamp_score, safe_float, safe_str


class EventLlmAssessment(TypedDict):
    asset_classes: list[str]
    category: str
    confidence: float
    conviction_bias: float
    direction: str
    event_type: str
    evidence_phrases: list[str]
    explanation: str
    fragility_bias: float
    impact_tags: list[str]
    pressure_score: float
    reason_codes: list[str]
    regime_tags: list[str]
    sectors: list[str]
    shock_bias: float


OPENAI_RESPONSES_URL: Final[str] = "https://api.openai.com/v1/responses"
MAX_LLM_TEXT_CHARS: Final[int] = 3500
ALLOWED_DIRECTIONS: Final[frozenset[str]] = frozenset({"positive", "negative", "mixed", "neutral", "risk_elevating", "risk_reducing"})
ALLOWED_CATEGORIES: Final[frozenset[str]] = frozenset({"macro", "market", "company", "geopolitical", "commodity", "regulatory"})
ALLOWED_REASON_CODES: Final[frozenset[str]] = frozenset(
    {
        "EVENT_AI_SEMICONDUCTOR_THEME",
        "EVENT_COOLING_INFLATION_SURPRISE",
        "EVENT_CRYPTO_CONTEXT",
        "EVENT_DEFENSIVE_ROTATION",
        "EVENT_DOVISH_RATE_SURPRISE",
        "EVENT_EARNINGS_NEGATIVE",
        "EVENT_EARNINGS_NEGATIVE_SURPRISE",
        "EVENT_EARNINGS_POSITIVE",
        "EVENT_EARNINGS_POSITIVE_SURPRISE",
        "EVENT_EARNINGS_SENSITIVITY",
        "EVENT_EMPLOYMENT_PRESSURE",
        "EVENT_FAILED_PEACE_TALKS",
        "EVENT_FED_RATES",
        "EVENT_GEOPOLITICAL_DEESCALATION",
        "EVENT_GEOPOLITICAL_ESCALATION",
        "EVENT_GOLD_SAFE_HAVEN",
        "EVENT_HAWKISH_RATE_SURPRISE",
        "EVENT_HOT_INFLATION_SURPRISE",
        "EVENT_INFLATION_PRESSURE",
        "EVENT_INVESTMENT_CATALYST",
        "EVENT_INVESTMENT_NEGATIVE",
        "EVENT_INVESTMENT_POSITIVE",
        "EVENT_LIQUIDITY_SUPPORTIVE",
        "EVENT_LIQUIDITY_TIGHTENING",
        "EVENT_MERGER_ACQUISITION",
        "EVENT_MNA_NEGATIVE",
        "EVENT_MNA_POSITIVE",
        "EVENT_OIL_SUPPLY_SHOCK",
        "EVENT_PRODUCT_CATALYST_NEGATIVE",
        "EVENT_PRODUCT_CATALYST_POSITIVE",
        "EVENT_PRODUCT_LAUNCH",
        "EVENT_RECESSION_PRESSURE",
        "EVENT_REGULATORY_POSITIVE",
        "EVENT_REGULATORY_RISK",
        "EVENT_STRONG_LABOR_RATE_PRESSURE",
        "EVENT_UNEMPLOYMENT_SURPRISE",
        "EVENT_VOLATILITY_PRESSURE",
    }
)


def analyze_verified_event_with_llm(
    *,
    source: str,
    title: str,
    summary: str,
    source_url: str,
    published_at: datetime,
) -> EventLlmAssessment | None:
    if not _llm_enabled():
        return None
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("TRADEVETO_EVENT_LLM_MODEL", "").strip()
    if not api_key or not model:
        return None

    source_text = _source_text(title, summary)
    payload = _request_payload(
        model=model,
        source=source,
        title=title,
        summary=summary,
        source_url=source_url,
        published_at=published_at,
    )
    request = urllib.request.Request(
        OPENAI_RESPONSES_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "TradeVetoEventIntelligence/1.0 (+https://tradeveto.com)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=_timeout_seconds()) as response:
            body = response.read(1_000_000)
    except (urllib.error.URLError, TimeoutError, OSError):
        return None

    try:
        response_payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    output_text = _extract_output_text(response_payload)
    if not output_text:
        return None
    try:
        raw_assessment = json.loads(output_text)
    except json.JSONDecodeError:
        return None
    if not isinstance(raw_assessment, dict):
        return None
    return _validated_assessment({str(key): value for key, value in raw_assessment.items()}, source_text)


def _request_payload(
    *,
    model: str,
    source: str,
    title: str,
    summary: str,
    source_url: str,
    published_at: datetime,
) -> dict[str, object]:
    source_text = _source_text(title, summary)
    return {
        "model": model,
        "input": [
            {
                "role": "system",
                "content": (
                    "You classify verified market events for a risk-aware research platform. "
                    "Use only the supplied source title and summary. Do not infer facts not present. "
                    "If direction is unclear, return neutral or mixed. Every non-neutral assessment must include "
                    "evidence_phrases copied from the supplied text. Use only the allowed reason_codes from the schema. "
                    "Scores are 0-100 for pressure_score and small bounded values for conviction, fragility, and shock."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "source": source,
                        "source_url": source_url,
                        "published_at": published_at.isoformat(),
                        "text": source_text[:MAX_LLM_TEXT_CHARS],
                    },
                    ensure_ascii=True,
                ),
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "verified_event_assessment",
                "strict": True,
                "schema": _assessment_schema(),
            }
        },
        "store": False,
        "temperature": 0.1,
    }


def _assessment_schema() -> dict[str, object]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "event_type": {"type": "string"},
            "category": {"type": "string", "enum": sorted(ALLOWED_CATEGORIES)},
            "direction": {"type": "string", "enum": sorted(ALLOWED_DIRECTIONS)},
            "pressure_score": {"type": "number", "description": "Event pressure on a 0-100 scale.", "minimum": 0, "maximum": 100},
            "conviction_bias": {"type": "number", "description": "Bounded setup conviction effect from -3 to +3.", "minimum": -3, "maximum": 3},
            "fragility_bias": {"type": "number", "description": "Bounded setup fragility effect from -1.5 to +4.", "minimum": -1.5, "maximum": 4},
            "shock_bias": {"type": "number", "description": "Bounded volatility/shock effect from 0 to +4.", "minimum": 0, "maximum": 4},
            "reason_codes": {"type": "array", "items": {"type": "string", "enum": sorted(ALLOWED_REASON_CODES)}, "minItems": 1, "maxItems": 5},
            "impact_tags": {"type": "array", "items": {"type": "string"}, "maxItems": 6},
            "sectors": {"type": "array", "items": {"type": "string"}, "maxItems": 6},
            "asset_classes": {"type": "array", "items": {"type": "string"}, "maxItems": 4},
            "regime_tags": {"type": "array", "items": {"type": "string"}, "maxItems": 5},
            "evidence_phrases": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 4},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "explanation": {"type": "string"},
        },
        "required": [
            "event_type",
            "category",
            "direction",
            "pressure_score",
            "conviction_bias",
            "fragility_bias",
            "shock_bias",
            "reason_codes",
            "impact_tags",
            "sectors",
            "asset_classes",
            "regime_tags",
            "evidence_phrases",
            "confidence",
            "explanation",
        ],
    }


def _validated_assessment(raw: dict[str, object], source_text: str) -> EventLlmAssessment | None:
    category = safe_str(raw.get("category"), "").strip().lower()
    direction = safe_str(raw.get("direction"), "").strip().lower()
    if category not in ALLOWED_CATEGORIES or direction not in ALLOWED_DIRECTIONS:
        return None

    evidence = _string_list(raw.get("evidence_phrases"), limit=4)
    if not evidence or not _evidence_supported(evidence, source_text):
        return None

    reason_codes = [code for code in _string_list(raw.get("reason_codes"), limit=5) if code in ALLOWED_REASON_CODES]
    if not reason_codes:
        return None

    confidence = safe_float(raw.get("confidence"), 0.0)
    if confidence < 0.45:
        return None

    return {
        "asset_classes": _string_list(raw.get("asset_classes"), limit=4),
        "category": category,
        "confidence": round(clamp_score(confidence, 0.0, 1.0), 3),
        "conviction_bias": round(clamp_score(safe_float(raw.get("conviction_bias"), 0.0), -3.0, 3.0), 2),
        "direction": direction,
        "event_type": _event_type(raw.get("event_type")),
        "evidence_phrases": evidence,
        "explanation": safe_str(raw.get("explanation"), "")[:260],
        "fragility_bias": round(clamp_score(safe_float(raw.get("fragility_bias"), 0.0), -1.5, 4.0), 2),
        "impact_tags": _string_list(raw.get("impact_tags"), limit=6),
        "pressure_score": round(clamp_score(safe_float(raw.get("pressure_score"), 50.0)), 2),
        "reason_codes": reason_codes,
        "regime_tags": _string_list(raw.get("regime_tags"), limit=5),
        "sectors": _string_list(raw.get("sectors"), limit=6),
        "shock_bias": round(clamp_score(safe_float(raw.get("shock_bias"), 0.0), 0.0, 4.0), 2),
    }


def _extract_output_text(payload: object) -> str:
    if not isinstance(payload, dict):
        return ""
    direct = payload.get("output_text")
    if isinstance(direct, str):
        return direct
    output = payload.get("output")
    if not isinstance(output, list):
        return ""
    chunks: list[str] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        for content_item in content:
            if not isinstance(content_item, dict):
                continue
            text = content_item.get("text")
            if isinstance(text, str):
                chunks.append(text)
    return "\n".join(chunks).strip()


def _source_text(title: str, summary: str) -> str:
    return " ".join(part.strip() for part in (title, summary) if part.strip())


def _evidence_supported(evidence: list[str], source_text: str) -> bool:
    normalized = source_text.lower()
    return any(phrase.lower().strip() in normalized for phrase in evidence if phrase.strip())


def _event_type(value: object) -> str:
    normalized = safe_str(value, "verified_event_llm").strip().lower().replace(" ", "_").replace("-", "_")
    return normalized[:64] or "verified_event_llm"


def _string_list(value: object, *, limit: int) -> list[str]:
    raw_items: list[object]
    if isinstance(value, list):
        raw_items = value
    else:
        raw_items = [value]
    items: list[str] = []
    for item in raw_items:
        text = safe_str(item, "").strip()
        if text:
            items.append(text[:120])
        if len(items) >= limit:
            break
    return items


def _llm_enabled() -> bool:
    return os.getenv("TRADEVETO_EVENT_LLM_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}


def _timeout_seconds() -> float:
    raw = os.getenv("TRADEVETO_EVENT_LLM_TIMEOUT_SECONDS", "").strip()
    try:
        value = float(raw) if raw else 8.0
    except ValueError:
        value = 8.0
    return max(2.0, min(value, 20.0))
