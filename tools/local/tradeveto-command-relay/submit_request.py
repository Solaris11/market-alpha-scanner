#!/usr/bin/env python3
"""Submit a TradeVeto relay request and optionally wait for the result."""

from __future__ import annotations

import argparse
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_REPO = Path("/Users/hdtv/dev/market-alpha-scanner")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action")
    parser.add_argument("--repo", default=str(DEFAULT_REPO))
    parser.add_argument("--branch")
    parser.add_argument("--query")
    parser.add_argument("--service")
    parser.add_argument("--route", action="append", dest="routes")
    parser.add_argument("--rollback-tag")
    parser.add_argument("--confirm")
    parser.add_argument("--container")
    parser.add_argument("--around", help="UTC 'YYYY-MM-DD HH:MM' for prod_resource_snapshot journal window")
    parser.add_argument("--reason", default="")
    parser.add_argument("--wait", action="store_true")
    parser.add_argument("--timeout", type=float, default=900.0)
    args = parser.parse_args()

    repo = Path(args.repo).expanduser().resolve()
    root = repo / ".agent-relay"
    request_dir = root / "requests"
    result_dir = root / "results"
    request_dir.mkdir(parents=True, exist_ok=True)
    result_dir.mkdir(parents=True, exist_ok=True)

    request_id = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:10]}"
    action_args: dict[str, Any] = {}
    if args.branch:
        action_args["branch"] = args.branch
    if args.query:
        action_args["query"] = args.query
    if args.service:
        action_args["service"] = args.service
    if args.routes:
        action_args["routes"] = args.routes
    if args.rollback_tag:
        action_args["rollback_tag"] = args.rollback_tag
    if args.confirm:
        action_args["confirm"] = args.confirm
    if args.container:
        action_args["container"] = args.container
    if args.around:
        action_args["around"] = args.around

    request = {
        "action": args.action,
        "args": action_args,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "id": request_id,
        "reason": args.reason,
    }
    request_path = request_dir / f"{request_id}.json"
    request_path.write_text(json.dumps(request, indent=2, sort_keys=True), encoding="utf-8")
    result_path = result_dir / f"{request_id}.json"
    print(result_path)

    if not args.wait:
        return 0

    deadline = time.time() + args.timeout
    while time.time() < deadline:
        if result_path.exists():
            print(result_path.read_text(encoding="utf-8"))
            return 0
        time.sleep(0.5)
    print(f"timed out waiting for {result_path}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
