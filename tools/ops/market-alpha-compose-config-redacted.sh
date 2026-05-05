#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${MARKET_ALPHA_APP_DIR:-/opt/apps/market-alpha-scanner/app}"

cd "${APP_DIR}"

docker compose config "$@" | python3 -c '
import re
import sys

sensitive_key = re.compile(r"(^|[_-])(SECRET|TOKEN|KEY|PASSWORD)($|[_-])|DATABASE_URL|POSTGRES_PASSWORD|SMTP_PASS|SENTRY_DSN|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|MARKET_ALPHA_SESSION_SECRET|MARKET_ALPHA_MONITORING_TOKEN", re.IGNORECASE)
assignment = re.compile(r"^(\s*[-]?\s*([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*)(.*)$")
url_secret = re.compile(r"(postgres(?:ql)?(?:\\+psycopg)?://[^:\\s]+:)([^@\\s]+)(@)", re.IGNORECASE)

for line in sys.stdin:
    text = line.rstrip("\n")
    match = assignment.match(text)
    if match and sensitive_key.search(match.group(2)):
        print(f"{match.group(1)}[redacted]")
        continue
    print(url_secret.sub(r"\1[redacted]\3", text))
'
