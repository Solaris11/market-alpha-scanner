from __future__ import annotations

import hashlib
import json
import os
import re
import smtplib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any
from urllib import error, parse, request

import pandas as pd


ALERTS_DIRNAME = "alerts"
RULES_FILENAME = "alert_rules.json"
STATE_FILENAME = "alert_state.json"
VALID_ALERT_TYPES = {
    "price_above",
    "price_below",
    "buy_zone_hit",
    "stop_loss_broken",
    "take_profit_hit",
    "score_above",
    "score_below",
    "score_changed_by",
    "rating_changed",
    "action_changed",
    "new_top_candidate",
}
VALID_CHANNELS = {"telegram", "email"}
DEFAULT_DASHBOARD_URL = "http://192.168.0.125:3001"
DEFAULT_RULES: list[dict[str, Any]] = [
    {
        "id": "nvda_buy_zone",
        "symbol": "NVDA",
        "type": "buy_zone_hit",
        "channels": ["telegram"],
        "enabled": True,
        "cooldown_minutes": 720,
        "source": "system",
    },
    {
        "id": "avgo_price_above_430",
        "symbol": "AVGO",
        "type": "price_above",
        "threshold": 430,
        "channels": ["telegram", "email"],
        "enabled": True,
        "cooldown_minutes": 1440,
        "source": "user",
    },
    {
        "id": "stop_broken",
        "symbol": "MSFT",
        "type": "stop_loss_broken",
        "channels": ["telegram"],
        "enabled": True,
        "cooldown_minutes": 1440,
        "source": "system",
    },
    {
        "id": "score_above_75",
        "symbol": "TSM",
        "type": "score_above",
        "threshold": 75,
        "channels": ["telegram"],
        "enabled": True,
        "cooldown_minutes": 1440,
        "source": "user",
    },
]


@dataclass(frozen=True)
class AlertEvaluation:
    triggered: bool
    trigger_value: str
    row: dict[str, Any] | None = None
    reason: str = ""
    baseline_value: str | None = None


@dataclass(frozen=True)
class AlertSummary:
    loaded_rules: int
    triggered_count: int
    sent_count: int
    skipped_count: int
    warnings: list[str]


def rules_path(outdir: Path, override: str | None = None) -> Path:
    if override:
        return Path(override)
    return outdir / ALERTS_DIRNAME / RULES_FILENAME


def state_path(outdir: Path, override: str | None = None) -> Path:
    if override:
        return Path(override)
    return outdir / ALERTS_DIRNAME / STATE_FILENAME


def _atomic_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(f"{path.suffix}.tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(path)


def ensure_default_rules(path: Path) -> None:
    if path.exists():
        return
    _atomic_write_json(path, DEFAULT_RULES)


def load_alert_rules(path: Path, create_default: bool = True) -> list[dict[str, Any]]:
    if create_default:
        ensure_default_rules(path)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[alerts] Failed to read alert rules from {path}: {exc}")
        return []
    if not isinstance(payload, list):
        print(f"[alerts] Alert rules file must contain a JSON array: {path}")
        return []
    return [rule for rule in payload if isinstance(rule, dict)]


def load_alert_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"alerts": {}}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"alerts": {}}
    if not isinstance(payload, dict):
        return {"alerts": {}}
    alerts = payload.get("alerts")
    if not isinstance(alerts, dict):
        payload["alerts"] = {}
    return payload


def save_alert_state(path: Path, state: dict[str, Any]) -> None:
    state["updated_at_utc"] = datetime.now(timezone.utc).isoformat()
    _atomic_write_json(path, state)


def _clean_text(value: object, default: str = "N/A") -> str:
    if value is None:
        return default
    try:
        if pd.isna(value):
            return default
    except TypeError:
        pass
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null", "n/a"}:
        return default
    return text


def _numeric(value: object) -> float | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    if isinstance(value, str):
        value = value.replace("$", "").replace(",", "").strip()
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if pd.notna(parsed) else None


def _format_number(value: object, decimals: int = 2) -> str:
    numeric = _numeric(value)
    if numeric is None:
        return "N/A"
    return f"{numeric:.{decimals}f}"


def _format_currency(value: object) -> str:
    numeric = _numeric(value)
    if numeric is None:
        return "N/A"
    return f"${numeric:.2f}"


def _format_level(value: object) -> str:
    numeric = _numeric(value)
    if numeric is None:
        return "N/A"
    if abs(numeric - round(numeric)) < 0.005:
        return str(int(round(numeric)))
    return f"{numeric:.2f}"


def _format_range(low: object, high: object, collapse_equal: bool = False) -> str:
    low_num = _numeric(low)
    high_num = _numeric(high)
    if low_num is None and high_num is None:
        return "N/A"
    if low_num is not None and high_num is not None:
        lower, upper = sorted((low_num, high_num))
        if collapse_equal and abs(lower - upper) < 0.005:
            return _format_level(lower)
        return f"{_format_level(lower)}–{_format_level(upper)}"
    return _format_level(low_num if low_num is not None else high_num)


def _format_target_value(value: object) -> str:
    text = _clean_text(value, "")
    numbers = _extract_numbers(text)
    if len(numbers) >= 2:
        return _format_range(numbers[0], numbers[1], collapse_equal=True)
    if len(numbers) == 1:
        suffix = "+" if "+" in text else ""
        return f"{_format_level(numbers[0])}{suffix}"
    return text or "N/A"


def _format_rr(value: object) -> str:
    numeric = _numeric(value)
    if numeric is None:
        return "N/A"
    return f"{numeric:.1f}R"


def _average_rr(low: object, high: object) -> str:
    low_num = _numeric(low)
    high_num = _numeric(high)
    if low_num is not None and high_num is not None:
        return _format_rr((low_num + high_num) / 2.0)
    return _format_rr(low_num if low_num is not None else high_num)


def _message_hash(message: str) -> str:
    return hashlib.sha256(message.encode("utf-8")).hexdigest()


def _rule_id(rule: dict[str, Any]) -> str:
    return _clean_text(rule.get("id"), "").strip()


def _rule_symbol(rule: dict[str, Any]) -> str:
    return _clean_text(rule.get("symbol"), "").upper().strip()


def _rule_type(rule: dict[str, Any]) -> str:
    return _clean_text(rule.get("type"), "").lower().strip()


def _rule_channels(rule: dict[str, Any]) -> list[str]:
    channels = rule.get("channels", ["telegram"])
    if isinstance(channels, str):
        channels = [channels]
    if not isinstance(channels, list):
        return []
    return [channel for channel in (_clean_text(item, "").lower() for item in channels) if channel in VALID_CHANNELS]


def _rule_enabled(rule: dict[str, Any]) -> bool:
    return bool(rule.get("enabled", True))


def _rule_source(rule: dict[str, Any]) -> str:
    source = _clean_text(rule.get("source"), "").lower()
    if source in {"system", "scanner", "auto"}:
        return "system"
    return "user"


def _cooldown_minutes(rule: dict[str, Any]) -> int:
    value = _numeric(rule.get("cooldown_minutes"))
    if value is None:
        return 1440
    return max(0, int(value))


def _normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df.copy()
    working = df.copy()
    if "symbol" not in working.columns:
        working["symbol"] = ""
    working["symbol"] = working["symbol"].fillna("").astype(str).str.strip().str.upper()
    return working


def _row_map(df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    for row in df.to_dict(orient="records"):
        symbol = _clean_text(row.get("symbol"), "").upper()
        if symbol:
            rows[symbol] = row
    return rows


def _action_for_row(row: dict[str, Any] | None) -> str:
    if not row:
        return "N/A"
    for column in ("action", "recommended_action", "composite_action", "mid_action", "short_action", "long_action"):
        value = _clean_text(row.get(column), "")
        if value:
            return value
    return "N/A"


def _company_for_row(row: dict[str, Any] | None) -> str:
    if not row:
        return "N/A"
    for column in ("company_name", "long_name", "short_name", "display_name", "security_name", "name"):
        value = _clean_text(row.get(column), "")
        if value and value.upper() != _clean_text(row.get("symbol"), "").upper():
            return value
    return "N/A"


def _extract_numbers(text: object) -> list[float]:
    if text is None:
        return []
    normalized = str(text).replace(",", "").replace("–", "-").replace("—", "-")
    return [float(match) for match in re.findall(r"(?<!\d)-?\d+(?:\.\d+)?", normalized)]


def _range_from_columns(row: dict[str, Any], low_column: str, high_column: str, text_columns: tuple[str, ...]) -> tuple[float | None, float | None]:
    low = _numeric(row.get(low_column))
    high = _numeric(row.get(high_column))
    if low is not None and high is not None:
        return (min(low, high), max(low, high))
    for column in text_columns:
        numbers = _extract_numbers(row.get(column))
        if len(numbers) >= 2:
            return (min(numbers[0], numbers[1]), max(numbers[0], numbers[1]))
        if len(numbers) == 1:
            return (numbers[0], numbers[0])
    if low is not None or high is not None:
        value = low if low is not None else high
        return (value, value)
    return (None, None)


def _price(row: dict[str, Any] | None) -> float | None:
    if not row:
        return None
    return _numeric(row.get("price"))


def _score(row: dict[str, Any] | None) -> float | None:
    if not row:
        return None
    return _numeric(row.get("final_score"))


def _stop_loss(row: dict[str, Any] | None) -> float | None:
    if not row:
        return None
    return _numeric(row.get("stop_loss")) or _numeric(row.get("invalidation_level"))


def _buy_zone(row: dict[str, Any] | None) -> tuple[float | None, float | None]:
    if not row:
        return (None, None)
    return _range_from_columns(row, "buy_zone_low", "buy_zone_high", ("buy_zone", "entry_zone"))


def _take_profit_zone(row: dict[str, Any] | None) -> tuple[float | None, float | None]:
    if not row:
        return (None, None)
    return _range_from_columns(row, "take_profit_low", "take_profit_high", ("take_profit_zone", "take_profit", "target", "upside_target"))


def _dashboard_url(symbol: str) -> str:
    base = os.getenv("ALERT_DASHBOARD_URL", DEFAULT_DASHBOARD_URL).rstrip("/")
    return f"{base}/symbol/{symbol}"


def _condition_label(alert_type: str) -> str:
    labels = {
        "price_above": "Price above",
        "price_below": "Price below",
        "buy_zone_hit": "Buy zone hit",
        "stop_loss_broken": "Stop loss broken",
        "take_profit_hit": "Take profit hit",
        "score_above": "Score above",
        "score_below": "Score below",
        "score_changed_by": "Score changed",
        "rating_changed": "Rating changed",
        "action_changed": "Action changed",
        "new_top_candidate": "New top candidate",
    }
    return labels.get(alert_type, alert_type)


def _alert_type_label(rule: dict[str, Any]) -> str:
    source = "System" if _rule_source(rule) == "system" else "User"
    return f"{source} {_condition_label(_rule_type(rule))} Alert"


def _trigger_text(rule: dict[str, Any]) -> str:
    alert_type = _rule_type(rule)
    label = _condition_label(alert_type)
    if alert_type in {"price_above", "price_below", "score_above", "score_below"}:
        return f"{label} {_format_level(rule.get('threshold'))}"
    if alert_type == "score_changed_by":
        threshold = _numeric(rule.get("threshold"))
        return f"{label} by {_format_level(threshold if threshold is not None else 2)}+"
    return label


def _take_profit_lines(row: dict[str, Any]) -> list[str]:
    tp_low, tp_high = _take_profit_zone(row)
    conservative = _format_target_value(row.get("conservative_target"))
    balanced = _format_target_value(row.get("balanced_target"))
    aggressive = _format_target_value(row.get("aggressive_target"))

    if conservative == "N/A":
        conservative = _format_range(tp_low, tp_high, collapse_equal=True)
    if balanced == "N/A" and tp_low is not None and tp_high is not None and abs(tp_low - tp_high) >= 0.005:
        balanced = _format_range(tp_low, tp_high, collapse_equal=True)

    return [
        f"   - Conservative: {conservative}",
        f"   - Balanced: {balanced}",
        f"   - Aggressive: {aggressive}",
    ]


def _risk_reward_lines(row: dict[str, Any]) -> list[str]:
    conservative = _format_rr(row.get("conservative_risk_reward"))
    balanced = _average_rr(row.get("balanced_risk_reward_low"), row.get("balanced_risk_reward_high"))
    aggressive = _average_rr(row.get("aggressive_risk_reward_low"), row.get("aggressive_risk_reward_high"))

    if conservative == "N/A" or balanced == "N/A" or aggressive == "N/A":
        numbers = _extract_numbers(row.get("target_risk_reward_label") or row.get("risk_reward_label"))
        if len(numbers) >= 3:
            conservative = conservative if conservative != "N/A" else _format_rr(numbers[0])
            balanced = balanced if balanced != "N/A" else _format_rr(numbers[1])
            aggressive = aggressive if aggressive != "N/A" else _format_rr(numbers[2])
        elif len(numbers) == 2:
            balanced = balanced if balanced != "N/A" else _format_rr(numbers[0])
            aggressive = aggressive if aggressive != "N/A" else _format_rr(numbers[1])
        elif len(numbers) == 1:
            conservative = conservative if conservative != "N/A" else _format_rr(numbers[0])

    return [
        f"• Conservative: {conservative}",
        f"• Balanced: {balanced}",
        f"• Aggressive: {aggressive}",
    ]


def _evaluate_rule(
    rule: dict[str, Any],
    rows_by_symbol: dict[str, dict[str, Any]],
    top_symbols: set[str],
    top_rows_by_symbol: dict[str, dict[str, Any]],
    rule_state: dict[str, Any],
) -> AlertEvaluation:
    alert_type = _rule_type(rule)
    symbol = _rule_symbol(rule)
    row = rows_by_symbol.get(symbol) if symbol else None

    if alert_type not in VALID_ALERT_TYPES:
        return AlertEvaluation(False, "", reason=f"unsupported alert type {alert_type}")
    if alert_type != "new_top_candidate" and not symbol:
        return AlertEvaluation(False, "", reason="missing symbol")
    if alert_type != "new_top_candidate" and row is None:
        return AlertEvaluation(False, "", reason=f"{symbol} not found in full_ranking.csv")

    price = _price(row)
    score = _score(row)
    threshold = _numeric(rule.get("threshold"))

    if alert_type == "price_above":
        if price is None or threshold is None:
            return AlertEvaluation(False, "", row, "missing price or threshold")
        return AlertEvaluation(price >= threshold, f"{price:.2f}", row, f"price {price:.2f} >= {threshold:.2f}")

    if alert_type == "price_below":
        if price is None or threshold is None:
            return AlertEvaluation(False, "", row, "missing price or threshold")
        return AlertEvaluation(price <= threshold, f"{price:.2f}", row, f"price {price:.2f} <= {threshold:.2f}")

    if alert_type == "buy_zone_hit":
        low, high = _buy_zone(row)
        if price is None or low is None or high is None:
            return AlertEvaluation(False, "", row, "missing price or buy zone")
        return AlertEvaluation(low <= price <= high, f"{price:.2f}", row, f"price {price:.2f} inside buy zone {low:.2f}-{high:.2f}")

    if alert_type == "stop_loss_broken":
        stop = _stop_loss(row)
        if price is None or stop is None:
            return AlertEvaluation(False, "", row, "missing price or stop loss")
        return AlertEvaluation(price <= stop, f"{price:.2f}", row, f"price {price:.2f} <= stop {stop:.2f}")

    if alert_type == "take_profit_hit":
        low, high = _take_profit_zone(row)
        target = low if low is not None else high
        if price is None or target is None:
            return AlertEvaluation(False, "", row, "missing price or take profit zone")
        return AlertEvaluation(price >= target, f"{price:.2f}", row, f"price {price:.2f} >= take profit {target:.2f}")

    if alert_type == "score_above":
        if score is None or threshold is None:
            return AlertEvaluation(False, "", row, "missing score or threshold")
        return AlertEvaluation(score >= threshold, f"{score:.2f}", row, f"score {score:.2f} >= {threshold:.2f}")

    if alert_type == "score_below":
        if score is None or threshold is None:
            return AlertEvaluation(False, "", row, "missing score or threshold")
        return AlertEvaluation(score <= threshold, f"{score:.2f}", row, f"score {score:.2f} <= {threshold:.2f}")

    if alert_type == "score_changed_by":
        if score is None:
            return AlertEvaluation(False, "", row, "missing score")
        minimum_change = threshold if threshold is not None else 2.0
        previous = _numeric(rule_state.get("last_observed_value") or rule_state.get("last_trigger_value"))
        if previous is None:
            return AlertEvaluation(False, f"{score:.2f}", row, "baseline score recorded", baseline_value=f"{score:.2f}")
        change = score - previous
        return AlertEvaluation(abs(change) >= minimum_change, f"{score:.2f}", row, f"score changed {change:+.2f}")

    if alert_type == "rating_changed":
        current = _clean_text(row.get("rating"), "")
        previous = _clean_text(rule_state.get("last_observed_value") or rule_state.get("last_trigger_value"), "")
        if not current:
            return AlertEvaluation(False, "", row, "missing rating")
        if not previous:
            return AlertEvaluation(False, current, row, "baseline rating recorded", baseline_value=current)
        return AlertEvaluation(current != previous, current, row, f"rating {previous} -> {current}")

    if alert_type == "action_changed":
        current = _action_for_row(row)
        previous = _clean_text(rule_state.get("last_observed_value") or rule_state.get("last_trigger_value"), "")
        if current == "N/A":
            return AlertEvaluation(False, "", row, "missing action")
        if not previous:
            return AlertEvaluation(False, current, row, "baseline action recorded", baseline_value=current)
        return AlertEvaluation(current != previous, current, row, f"action {previous} -> {current}")

    if alert_type == "new_top_candidate":
        if symbol:
            current = "present" if symbol in top_symbols else "absent"
            previous = _clean_text(rule_state.get("last_observed_value") or rule_state.get("last_trigger_value"), "")
            candidate_row = top_rows_by_symbol.get(symbol) or rows_by_symbol.get(symbol)
            if not previous:
                return AlertEvaluation(False, current, candidate_row, "baseline top-candidate state recorded", baseline_value=current)
            return AlertEvaluation(previous != "present" and current == "present", current, candidate_row, f"{symbol} appeared in top_candidates.csv")

        previous_symbols = set(str(rule_state.get("last_observed_value") or "").split(",")) - {""}
        if not previous_symbols:
            return AlertEvaluation(False, ",".join(sorted(top_symbols)), None, "baseline top candidates recorded", baseline_value=",".join(sorted(top_symbols)))
        new_symbols = sorted(top_symbols - previous_symbols)
        if not new_symbols:
            return AlertEvaluation(False, ",".join(sorted(top_symbols)), None, "no new top candidates", baseline_value=",".join(sorted(top_symbols)))
        first_new = new_symbols[0]
        return AlertEvaluation(True, first_new, top_rows_by_symbol.get(first_new) or rows_by_symbol.get(first_new), f"{first_new} appeared in top_candidates.csv")

    return AlertEvaluation(False, "", row, "not triggered")


def _build_message(rule: dict[str, Any], evaluation: AlertEvaluation) -> str:
    row = evaluation.row or {}
    symbol = _clean_text(row.get("symbol"), _rule_symbol(rule) or "N/A").upper()
    buy_low, buy_high = _buy_zone(row)
    stop = _stop_loss(row)
    company = _company_for_row(row)
    symbol_line = f"📊 Symbol: {symbol}" if company == "N/A" else f"📊 Symbol: {symbol} ({company})"
    note = _clean_text(row.get("trade_quality_note") or row.get("target_warning"), "")
    lines = [
        "🚨 Market Alpha Alert",
        "",
        symbol_line,
        f"🔥 Trigger: {_trigger_text(rule)}",
        "",
        f"💰 Price: {_format_currency(row.get('price'))}",
        "",
        "🎯 Trade Plan",
        f"• Buy Zone: {_format_range(buy_low, buy_high)}",
        f"• Stop Loss: {_format_level(stop)}",
        "• Take Profit:",
        *_take_profit_lines(row),
        "",
        "⚖️ Risk/Reward:",
        *_risk_reward_lines(row),
        "",
        "📈 Signal:",
        f"• Rating: {_clean_text(row.get('rating'))}",
        f"• Action: {_action_for_row(row)}",
        f"• Score: {_format_number(row.get('final_score'))}",
    ]
    if note:
        lines.extend(["", "⚠️ Note:", note])
    lines.extend(["", "🔗 Open:", _dashboard_url(symbol)])
    return "\n".join(lines)


def _send_telegram(message: str) -> tuple[bool, str]:
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not bot_token or not chat_id:
        return False, "Telegram env vars missing; skipping Telegram."

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = parse.urlencode({"chat_id": chat_id, "text": message}).encode("utf-8")
    req = request.Request(url, data=payload, method="POST")
    try:
        with request.urlopen(req, timeout=15) as response:
            if 200 <= response.status < 300:
                return True, "sent"
            return False, f"Telegram returned HTTP {response.status}"
    except error.URLError as exc:
        return False, f"Telegram send failed: {exc}"
    except Exception as exc:
        return False, f"Telegram send failed: {exc}"


def _send_email(message: str, subject: str) -> tuple[bool, str]:
    required = {
        "ALERT_EMAIL_FROM": os.getenv("ALERT_EMAIL_FROM", "").strip(),
        "ALERT_EMAIL_TO": os.getenv("ALERT_EMAIL_TO", "").strip(),
        "SMTP_HOST": os.getenv("SMTP_HOST", "").strip(),
        "SMTP_PORT": os.getenv("SMTP_PORT", "").strip(),
        "SMTP_USER": os.getenv("SMTP_USER", "").strip(),
        "SMTP_PASSWORD": os.getenv("SMTP_PASSWORD", "").strip(),
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        return False, f"Email env vars missing ({', '.join(missing)}); skipping email."

    port = int(required["SMTP_PORT"])
    email = EmailMessage()
    email["From"] = required["ALERT_EMAIL_FROM"]
    email["To"] = required["ALERT_EMAIL_TO"]
    email["Subject"] = subject
    email.set_content(message)

    try:
        if port == 465:
            with smtplib.SMTP_SSL(required["SMTP_HOST"], port, timeout=15) as smtp:
                smtp.login(required["SMTP_USER"], required["SMTP_PASSWORD"])
                smtp.send_message(email)
        else:
            with smtplib.SMTP(required["SMTP_HOST"], port, timeout=15) as smtp:
                smtp.starttls()
                smtp.login(required["SMTP_USER"], required["SMTP_PASSWORD"])
                smtp.send_message(email)
        return True, "sent"
    except Exception as exc:
        return False, f"Email send failed: {exc}"


def _within_cooldown(rule: dict[str, Any], rule_state: dict[str, Any], now: datetime) -> bool:
    last_sent_at = _clean_text(rule_state.get("last_sent_at"), "")
    if not last_sent_at:
        return False
    try:
        last_sent = datetime.fromisoformat(last_sent_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    if last_sent.tzinfo is None:
        last_sent = last_sent.replace(tzinfo=timezone.utc)
    return now - last_sent < timedelta(minutes=_cooldown_minutes(rule))


def evaluate_alert_rules(
    full_ranking: pd.DataFrame,
    top_candidates: pd.DataFrame | None,
    outdir: Path,
    alert_rules_path: str | None = None,
    alert_state_path: str | None = None,
    send: bool = True,
) -> AlertSummary:
    full_ranking = _normalize_df(full_ranking)
    top_candidates = _normalize_df(top_candidates if top_candidates is not None else pd.DataFrame())
    rule_path = rules_path(outdir, alert_rules_path)
    state_file = state_path(outdir, alert_state_path)
    rules = load_alert_rules(rule_path, create_default=True)
    state = load_alert_state(state_file)
    state_alerts = state.setdefault("alerts", {})
    rows_by_symbol = _row_map(full_ranking)
    top_rows_by_symbol = _row_map(top_candidates)
    top_symbols = set(top_rows_by_symbol)
    now = datetime.now(timezone.utc)

    triggered_count = 0
    sent_count = 0
    skipped_count = 0
    warnings: list[str] = []
    state_changed = False

    for rule in rules:
        rule_id = _rule_id(rule)
        if not rule_id:
            skipped_count += 1
            warnings.append("Skipping alert rule with missing id.")
            continue
        rule_state = state_alerts.setdefault(rule_id, {})
        if not isinstance(rule_state, dict):
            rule_state = {}
            state_alerts[rule_id] = rule_state
        if not _rule_enabled(rule):
            skipped_count += 1
            continue

        channels = _rule_channels(rule)
        if not channels:
            skipped_count += 1
            warnings.append(f"[{rule_id}] no valid channels configured.")
            continue

        evaluation = _evaluate_rule(rule, rows_by_symbol, top_symbols, top_rows_by_symbol, rule_state)
        if evaluation.baseline_value is not None:
            rule_state["last_observed_value"] = evaluation.baseline_value
            rule_state["last_checked_at"] = now.isoformat()
            state_changed = True
        if not evaluation.triggered:
            continue

        triggered_count += 1
        message = _build_message(rule, evaluation)
        message_hash = _message_hash(message)

        if _within_cooldown(rule, rule_state, now):
            skipped_count += 1
            rule_state["last_skipped_at"] = now.isoformat()
            rule_state["last_skip_reason"] = "cooldown"
            state_changed = True
            print(f"[alerts] Skipping {rule_id}: cooldown active.")
            continue

        if not send:
            skipped_count += 1
            print(f"[alerts] Rule {rule_id} triggered, send disabled.")
            continue

        channel_results: dict[str, str] = {}
        sent_any = False
        for channel in channels:
            if channel == "telegram":
                ok, detail = _send_telegram(message)
            elif channel == "email":
                ok, detail = _send_email(message, f"Market Alpha Alert: {_rule_symbol(rule) or _condition_label(_rule_type(rule))}")
            else:
                ok, detail = False, f"unsupported channel {channel}"
            channel_results[channel] = detail
            if ok:
                sent_any = True
            else:
                warnings.append(f"[{rule_id}] {detail}")
                print(f"[alerts] {detail}")

        if sent_any:
            sent_count += 1
            rule_state.update(
                {
                    "alert_id": rule_id,
                    "last_sent_at": now.isoformat(),
                    "last_trigger_value": evaluation.trigger_value,
                    "last_observed_value": evaluation.trigger_value,
                    "last_message_hash": message_hash,
                    "last_channel_results": channel_results,
                    "last_status": "sent",
                }
            )
            state_changed = True
        else:
            skipped_count += 1
            rule_state.update(
                {
                    "alert_id": rule_id,
                    "last_skipped_at": now.isoformat(),
                    "last_skip_reason": "no channel delivered",
                    "last_channel_results": channel_results,
                    "last_status": "skipped",
                }
            )
            state_changed = True

    if state_changed:
        save_alert_state(state_file, state)

    summary = AlertSummary(
        loaded_rules=len(rules),
        triggered_count=triggered_count,
        sent_count=sent_count,
        skipped_count=skipped_count,
        warnings=warnings,
    )
    print_alert_summary(summary)
    return summary


def print_alert_summary(summary: AlertSummary) -> None:
    print(
        "[alerts] Summary:"
        f" loaded_rules={summary.loaded_rules},"
        f" triggered={summary.triggered_count},"
        f" sent={summary.sent_count},"
        f" skipped={summary.skipped_count}"
    )


def read_alert_input_files(outdir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    full_path = outdir / "full_ranking.csv"
    top_path = outdir / "top_candidates.csv"
    full_ranking = pd.read_csv(full_path) if full_path.exists() else pd.DataFrame()
    top_candidates = pd.read_csv(top_path) if top_path.exists() else pd.DataFrame()
    return full_ranking, top_candidates


def process_telegram_alerts(df: pd.DataFrame, outdir: Path) -> None:
    # Backward-compatible entry point for older scanner integrations.
    evaluate_alert_rules(df, None, outdir, send=True)
