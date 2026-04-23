from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib import error, parse, request

import pandas as pd


ALERTS_DIRNAME = "alerts"
STATE_FILENAME = "telegram_alert_state.json"
TOP_RATING = "TOP"
HIGH_SCORE_THRESHOLD = 80.0
SECONDARY_RATING = "ACTIONABLE"
SECONDARY_SCORE_THRESHOLD = 78.0
SECONDARY_RISK_PENALTY = 0.0
MESSAGE_COLUMNS = [
    "symbol",
    "asset_type",
    "final_score",
    "rating",
    "setup_type",
    "macro_score",
    "risk_penalty",
    "upside_driver",
    "key_risk",
]
FINGERPRINT_COLUMNS = [
    "symbol",
    "asset_type",
    "final_score",
    "rating",
    "setup_type",
    "macro_score",
    "risk_penalty",
]


@dataclass
class TelegramConfig:
    bot_token: str
    chat_id: str


def load_telegram_config() -> TelegramConfig | None:
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not bot_token or not chat_id:
        return None
    return TelegramConfig(bot_token=bot_token, chat_id=chat_id)


def build_alert_rows(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=[column for column in MESSAGE_COLUMNS if column in df.columns])

    working = df.copy()
    for column in ["rating", "symbol", "asset_type", "setup_type", "upside_driver", "key_risk"]:
        if column in working.columns:
            working[column] = working[column].fillna("").astype(str).str.strip()
    for column in ["final_score", "macro_score", "risk_penalty"]:
        if column in working.columns:
            working[column] = pd.to_numeric(working[column], errors="coerce")

    rating_mask = working.get("rating", pd.Series("", index=working.index)).str.upper() == TOP_RATING
    high_score_mask = working.get("final_score", pd.Series(float("nan"), index=working.index)).ge(HIGH_SCORE_THRESHOLD)
    secondary_mask = (
        working.get("rating", pd.Series("", index=working.index)).str.upper().eq(SECONDARY_RATING)
        & working.get("final_score", pd.Series(float("nan"), index=working.index)).ge(SECONDARY_SCORE_THRESHOLD)
        & working.get("risk_penalty", pd.Series(float("nan"), index=working.index)).eq(SECONDARY_RISK_PENALTY)
    )

    alert_df = working[rating_mask | high_score_mask | secondary_mask].copy()
    if alert_df.empty:
        return alert_df

    if "final_score" in alert_df.columns:
        alert_df = alert_df.sort_values(["final_score", "symbol"], ascending=[False, True], na_position="last")
    else:
        alert_df = alert_df.sort_values("symbol")

    visible_columns = [column for column in MESSAGE_COLUMNS if column in alert_df.columns]
    return alert_df[visible_columns].reset_index(drop=True)


def _clean_text(value: object, default: str = "n/a") -> str:
    if value is None or pd.isna(value): # type: ignore
        return default
    text = str(value).strip()
    return text if text else default


def _format_number(value: object, decimals: int = 2) -> str:
    numeric = pd.to_numeric(value, errors="coerce") # type: ignore
    if pd.isna(numeric):
        return "n/a"
    if float(numeric).is_integer():
        return str(int(numeric))
    return f"{float(numeric):.{decimals}f}"


def format_telegram_message(rows: pd.DataFrame) -> str:
    header = ["🚀 Market Alpha Alert", "", "TOP / High-Conviction signals found:", ""]
    blocks: list[str] = []

    for row in rows.to_dict(orient="records"):
        blocks.extend(
            [
                f"{_clean_text(row.get('symbol'))} | {_clean_text(row.get('asset_type'))} | "
                f"Score {_format_number(row.get('final_score'))} | {_clean_text(row.get('rating'))}",
                f"Setup: {_clean_text(row.get('setup_type'))}",
                f"Macro: {_format_number(row.get('macro_score'))} | Risk: {_format_number(row.get('risk_penalty'))}",
                f"Driver: {_clean_text(row.get('upside_driver'))}",
                f"Risk: {_clean_text(row.get('key_risk'))}",
                "",
            ]
        )

    return "\n".join(header + blocks).strip()


def _fingerprint_payload(rows: pd.DataFrame) -> str:
    if rows.empty:
        return "empty"

    payload_rows: list[dict[str, object]] = []
    for row in rows.to_dict(orient="records"):
        payload_rows.append({column: row.get(column) for column in FINGERPRINT_COLUMNS})
    payload = json.dumps(payload_rows, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _alert_state_path(outdir: Path) -> Path:
    alerts_dir = outdir / ALERTS_DIRNAME
    alerts_dir.mkdir(parents=True, exist_ok=True)
    return alerts_dir / STATE_FILENAME


def load_alert_state(outdir: Path) -> dict[str, object]:
    state_path = _alert_state_path(outdir)
    if not state_path.exists():
        return {}

    try:
        return json.loads(state_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_alert_state(outdir: Path, fingerprint: str, rows: pd.DataFrame) -> None:
    state_path = _alert_state_path(outdir)
    payload = {
        "fingerprint": fingerprint,
        "row_count": int(len(rows)),
        "updated_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    state_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def should_send_alert(outdir: Path, fingerprint: str) -> bool:
    state = load_alert_state(outdir)
    return state.get("fingerprint") != fingerprint


def send_telegram_message(text: str, config: TelegramConfig) -> bool:
    url = f"https://api.telegram.org/bot{config.bot_token}/sendMessage"
    payload = parse.urlencode(
        {
            "chat_id": config.chat_id,
            "text": text,
        }
    ).encode("utf-8")
    req = request.Request(url, data=payload, method="POST")

    try:
        with request.urlopen(req, timeout=10) as response:
            return 200 <= response.status < 300
    except error.URLError as exc:
        print(f"[alerts] Telegram send failed: {exc}")
        return False
    except Exception as exc:
        print(f"[alerts] Telegram send failed: {exc}")
        return False


def process_telegram_alerts(df: pd.DataFrame, outdir: Path) -> None:
    config = load_telegram_config()
    if config is None:
        print("[alerts] Telegram config missing. Skipping alerts.")
        return

    rows = build_alert_rows(df)
    fingerprint = _fingerprint_payload(rows)

    if not should_send_alert(outdir, fingerprint):
        return

    if rows.empty:
        save_alert_state(outdir, fingerprint, rows)
        return

    message = format_telegram_message(rows)
    if send_telegram_message(message, config):
        save_alert_state(outdir, fingerprint, rows)
