#!/usr/bin/env python3
"""Scanner health monitor — the alerting half of the SNDK preventive actions.

`docs/ops/rca-sndk-missing-from-scanner-20260910.md`: SNDK was absent from
every production scan for 35 days and nothing noticed, because the only ledger
(`scanner_drop_reasons.csv`) accounts for symbols that were *selected*, and the
in-image guard that would have caught it shipped inside the very image that was
never rebuilt.

Two guards came out of that. `warn_missing_required_symbols()` runs inside the
scan and is live. This is the other half: it runs on the host, on a timer, and
it can see things the scan cannot say about itself.

    1. STALE IMAGE   the scanner-job image is older than the code it carries
    2. MISSING GUARD the scan logged [universe] WARNING for a required symbol
    3. UNIVERSE DRIFT the selected universe changed size, or a required symbol
                      is absent from the drop-reason ledger
    4. STALE SCAN    no scan has completed recently

It never imports scanner code (a broken scanner must not be able to silence its
own monitor) and it never reads a value out of `.env` into its output. SMTP
settings are loaded at runtime and the secret keys are never logged, echoed or
included in an alert body — the same contract tradeveto-resource-watchdog.py
holds.

Exit codes: 0 healthy, 1 problems found (systemd marks the unit failed, so a
missed email still surfaces in `systemctl --failed`), 2 the monitor itself
could not run.
"""
from __future__ import annotations

import argparse
import ast
import json
import os
import re
import smtplib
import socket
import subprocess
import sys
import time
from email.message import EmailMessage
from pathlib import Path

APP_DIR = Path(os.getenv("TRADEVETO_APP_DIR", "/opt/apps/market-alpha-scanner/app"))
APP_ENV = APP_DIR / ".env"
RUNTIME = Path(os.getenv("TRADEVETO_RUNTIME_DIR", "/opt/apps/market-alpha-scanner/runtime"))
DROP_REASONS = RUNTIME / "scanner_output" / "scanner_drop_reasons.csv"
UNIVERSE_PY = APP_DIR / "scanner" / "universe.py"
FRESHNESS = APP_DIR / "tools" / "ops" / "scanner-image-freshness.sh"

STATE_FILE = Path("/var/lib/tradeveto-scanner-health/state.json")
LOG_FILE = Path("/var/log/market-alpha/scanner-health.log")
REPORT_FILE = Path("/var/log/market-alpha/scanner-health-state.json")
HOSTNAME = socket.gethostname()

#: Never log, echo, or put in an alert body.
SENSITIVE_KEYS = {"SMTP_PASS", "SMTP_USER", "DATABASE_URL", "POSTGRES_PASSWORD"}

DEFAULT_COOLDOWN_SECONDS = 6 * 3600
DEFAULT_MAX_SCAN_AGE_MINUTES = 90
#: The scan selects this many symbols. A drift of more than a couple means the
#: universe file changed, which is exactly the class of change that went
#: unnoticed for 35 days.
DEFAULT_EXPECTED_UNIVERSE = 500
DEFAULT_UNIVERSE_TOLERANCE = 5


def log(message: str) -> None:
    line = f"[{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}] {message}\n"
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as handle:
            handle.write(line)
    except OSError:
        pass  # never let logging failure mask a real finding
    print(line, end="")


def load_env_file(path: Path) -> dict[str, str]:
    """Read KEY=VALUE pairs. Values are used, never printed."""
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def required_symbols() -> list[str]:
    """Read REQUIRED_OPPORTUNITY_SYMBOLS without importing the scanner.

    Parsed out of the source with ast rather than imported, for two reasons: a
    scanner too broken to import must not be able to disable the monitor that
    reports it, and the host python has none of the scanner's dependencies.
    """
    if not UNIVERSE_PY.exists():
        return []
    tree = ast.parse(UNIVERSE_PY.read_text(encoding="utf-8"))
    for node in tree.body:
        targets = (
            node.targets if isinstance(node, ast.Assign)
            else [node.target] if isinstance(node, ast.AnnAssign)
            else []
        )
        for target in targets:
            if isinstance(target, ast.Name) and target.id == "REQUIRED_OPPORTUNITY_SYMBOLS":
                value = node.value
                if isinstance(value, (ast.Tuple, ast.List)):
                    return [e.value for e in value.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)]
    return []


def ledger_symbols() -> tuple[set[str], int, float | None]:
    """Symbols in the latest drop-reason ledger, its row count, and its age."""
    if not DROP_REASONS.exists():
        return set(), 0, None
    rows = DROP_REASONS.read_text(encoding="utf-8", errors="replace").splitlines()
    symbols: set[str] = set()
    for line in rows[1:]:
        parts = line.split(",")
        if len(parts) > 1 and parts[1].strip():
            symbols.add(parts[1].strip().upper())
    age_minutes = (time.time() - DROP_REASONS.stat().st_mtime) / 60.0
    return symbols, max(0, len(rows) - 1), age_minutes


def universe_warnings(hours: int) -> list[str]:
    """Any `[universe] WARNING` the scan itself emitted, from the journal."""
    try:
        proc = subprocess.run(
            ["journalctl", "-u", "market-alpha-fast-scan.service", "-u", "market-alpha-full-scan.service",
             "--since", f"-{hours}h", "--no-pager", "-o", "cat"],
            capture_output=True, text=True, timeout=60,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        log(f"could not read the scan journal: {exc}")
        return []
    return [line.strip() for line in proc.stdout.splitlines() if "[universe] WARNING" in line]


def image_freshness() -> dict[str, object]:
    if not FRESHNESS.exists():
        return {"status": "unavailable", "detail": f"{FRESHNESS} is missing"}
    try:
        proc = subprocess.run([str(FRESHNESS), "--json"], capture_output=True, text=True, timeout=120)
        for line in proc.stdout.splitlines():
            line = line.strip()
            if line.startswith("{"):
                return json.loads(line)
        return {"status": "unavailable", "detail": "freshness check produced no json"}
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
        return {"status": "unavailable", "detail": f"freshness check failed: {exc}"}


def send_email(env: dict[str, str], subject: str, body: str) -> str:
    required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"]
    missing = [key for key in required if not env.get(key)]
    if missing:
        # Names only. Never the values.
        return f"skipped: SMTP not configured (missing {', '.join(missing)})"
    to = env.get("TRADEVETO_SCANNER_ALERT_TO") or env.get("TRADEVETO_RESOURCE_ALERT_TO") or env.get("SUPPORT_EMAIL")
    if not to:
        return "skipped: no alert recipient configured"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = env["EMAIL_FROM"]
    msg["To"] = to
    msg.set_content(body)
    try:
        port = int(env["SMTP_PORT"])
    except ValueError:
        return "skipped: SMTP_PORT is not a number"
    try:
        if env.get("SMTP_SECURE", "false").lower() in {"1", "true", "yes"} or port == 465:
            with smtplib.SMTP_SSL(env["SMTP_HOST"], port, timeout=20) as smtp:
                smtp.login(env["SMTP_USER"], env["SMTP_PASS"])
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(env["SMTP_HOST"], port, timeout=20) as smtp:
                smtp.starttls()
                smtp.login(env["SMTP_USER"], env["SMTP_PASS"])
                smtp.send_message(msg)
    except Exception as exc:  # noqa: BLE001 - the reason matters, the credentials never appear in it
        return f"failed: {type(exc).__name__}"
    return "sent"


def read_state() -> dict[str, object]:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def write_state(state: dict[str, object]) -> None:
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    except OSError as exc:
        log(f"could not persist state: {exc}")


def main() -> int:
    parser = argparse.ArgumentParser(description="TradeVeto scanner health monitor")
    parser.add_argument("--max-scan-age-minutes", type=int, default=DEFAULT_MAX_SCAN_AGE_MINUTES)
    parser.add_argument("--expected-universe", type=int, default=DEFAULT_EXPECTED_UNIVERSE)
    parser.add_argument("--universe-tolerance", type=int, default=DEFAULT_UNIVERSE_TOLERANCE)
    parser.add_argument("--journal-hours", type=int, default=24)
    parser.add_argument("--cooldown-seconds", type=int, default=DEFAULT_COOLDOWN_SECONDS)
    parser.add_argument("--no-email", action="store_true", help="check and report, do not alert")
    args = parser.parse_args()

    problems: list[str] = []
    facts: dict[str, object] = {"host": HOSTNAME, "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

    # 1. stale image -- the actual SNDK root cause
    fresh = image_freshness()
    facts["image"] = fresh
    if fresh.get("status") == "fail":
        problems.append(
            f"STALE IMAGE: scanner-job image is {fresh.get('stale_days')} day(s) older than scan-relevant code "
            f"(image {fresh.get('image_created')}, newest relevant commit {fresh.get('newest_relevant_commit')}). "
            f"This is the SNDK failure mode. Rebuild per docs/ops/scanner-job-deploy-runbook.md."
        )
    elif fresh.get("status") == "warn":
        problems.append(f"IMAGE DRIFT: {fresh.get('commit_verdict')}")
    elif fresh.get("status") == "unavailable":
        problems.append(f"IMAGE CHECK UNAVAILABLE: {fresh.get('detail')}")

    # 2. the scan's own guard fired
    warnings = universe_warnings(args.journal_hours)
    facts["universe_warnings"] = warnings[:10]
    if warnings:
        problems.append(
            f"REQUIRED SYMBOL MISSING: the scan logged {len(warnings)} [universe] WARNING line(s) "
            f"in the last {args.journal_hours}h. Most recent: {warnings[-1]}"
        )

    # 3. universe drift, measured against the ledger the scan actually wrote
    ledger, ledger_rows, ledger_age = ledger_symbols()
    required = required_symbols()
    facts["ledger_rows"] = ledger_rows
    facts["ledger_age_minutes"] = None if ledger_age is None else round(ledger_age, 1)
    facts["required_symbol_count"] = len(required)

    if ledger_rows == 0:
        problems.append(f"NO LEDGER: {DROP_REASONS} is missing or empty; the last scan accounted for nothing.")
    else:
        drift = abs(ledger_rows - args.expected_universe)
        if drift > args.universe_tolerance:
            problems.append(
                f"UNIVERSE DRIFT: the last scan selected {ledger_rows} symbols, expected about "
                f"{args.expected_universe} (tolerance {args.universe_tolerance})."
            )
        absent = [symbol for symbol in required if symbol not in ledger]
        facts["required_absent_from_ledger"] = absent
        if absent:
            problems.append(
                f"REQUIRED SYMBOLS ABSENT FROM LEDGER: {', '.join(absent)}. "
                f"A promised symbol that never reaches the ledger is the exact SNDK signature."
            )

    # 4. the scan is running at all
    if ledger_age is not None and ledger_age > args.max_scan_age_minutes:
        problems.append(
            f"STALE SCAN: the drop-reason ledger is {ledger_age:.0f} minutes old, "
            f"over the {args.max_scan_age_minutes} minute budget."
        )

    facts["problems"] = problems
    facts["status"] = "problems" if problems else "ok"

    try:
        REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
        REPORT_FILE.write_text(json.dumps(facts, indent=2), encoding="utf-8")
    except OSError as exc:
        log(f"could not write report: {exc}")

    if not problems:
        log(f"ok — image {fresh.get('status')}, ledger {ledger_rows} rows, {len(required)} required symbols all present")
        return 0

    for problem in problems:
        log(f"PROBLEM {problem}")

    if args.no_email:
        return 1

    # Cooldown on the problem set, not the clock: a new kind of problem alerts
    # immediately even inside the window, and an unchanged one stays quiet.
    state = read_state()
    signature = "|".join(sorted(p.split(":")[0] for p in problems))
    last_signature = state.get("last_signature")
    last_sent = float(state.get("last_sent_epoch") or 0)
    now = time.time()
    within_cooldown = signature == last_signature and (now - last_sent) < args.cooldown_seconds

    if within_cooldown:
        log(f"alert suppressed by cooldown ({int((now - last_sent) / 60)} min since last, signature unchanged)")
    else:
        env = load_env_file(APP_ENV)
        body = (
            f"TradeVeto scanner health on {HOSTNAME}\n\n"
            + "\n\n".join(f"- {problem}" for problem in problems)
            + "\n\nRunbook: docs/ops/scanner-job-deploy-runbook.md\n"
            + "RCA:     docs/ops/rca-sndk-missing-from-scanner-20260910.md\n"
            + "\nNo credentials or environment values are included in this message.\n"
        )
        result = send_email(env, f"[TradeVeto] Scanner health: {len(problems)} problem(s) on {HOSTNAME}", body)
        log(f"alert email {result}")
        state["last_signature"] = signature
        state["last_sent_epoch"] = now
        state["last_result"] = result
        write_state(state)

    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        log(f"monitor itself failed: {type(exc).__name__}: {exc}")
        sys.exit(2)
