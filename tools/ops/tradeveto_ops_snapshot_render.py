"""Render a TradeVeto ops snapshot from collected raw section files.

Invoked by tools/ops/tradeveto-ops-snapshot.sh. Reads the raw command output
that script captured, and writes one machine-readable JSON plus one
human-readable HTML page. Kept deliberately dependency-free so it runs on the
production host with nothing installed.
"""

from __future__ import annotations

import html
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


def read(work: Path, name: str) -> Optional[str]:
    """Return a captured section's stdout, or None when the section failed."""
    path = work / name
    if not path.is_file():
        return None
    text = path.read_text(encoding="utf-8", errors="replace").strip()
    return text or None


def read_json(work: Path, name: str) -> Optional[Dict[str, Any]]:
    raw = read(work, name)
    if raw is None:
        return None
    try:
        parsed: Any = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if isinstance(parsed, dict):
        return parsed
    return None


def parse_routes(raw: Optional[str]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if not raw:
        return rows
    for line in raw.splitlines():
        parts = line.split()
        if len(parts) != 3:
            continue
        path, code, seconds = parts[0], parts[1], parts[2]
        try:
            total = float(seconds)
        except ValueError:
            total = 0.0
        rows.append({"path": path, "status": code, "totalSeconds": round(total, 3)})
    return rows


def parse_pipe_ints(raw: Optional[str], keys: List[str]) -> Dict[str, Optional[int]]:
    values: Dict[str, Optional[int]] = {key: None for key in keys}
    if not raw:
        return values
    parts = raw.split("|")
    for index, key in enumerate(keys):
        if index >= len(parts):
            break
        token = parts[index].strip()
        if not token:
            continue
        try:
            values[key] = int(float(token))
        except ValueError:
            values[key] = None
    return values


def parse_int(raw: Optional[str]) -> Optional[int]:
    if not raw:
        return None
    try:
        return int(float(raw.strip()))
    except ValueError:
        return None


def parse_decisions(raw: Optional[str]) -> Dict[str, int]:
    """Parse 'AVOID=168' style rows into a decision mix."""
    mix: Dict[str, int] = {}
    if not raw:
        return mix
    for line in raw.splitlines():
        if "=" not in line:
            continue
        name, _, count = line.rpartition("=")
        try:
            mix[name.strip()] = int(count.strip())
        except ValueError:
            continue
    return mix


def parse_stats(raw: Optional[str]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    if not raw:
        return rows
    for line in raw.splitlines():
        parts = line.split("|")
        if len(parts) != 3:
            continue
        rows.append({"container": parts[0], "cpu": parts[1], "memory": parts[2]})
    return rows


def backup_state(local: Optional[str], remote: Optional[str], age_hours: Optional[str]) -> Dict[str, Any]:
    local_name = Path(local).name if local else None
    return {
        "latestLocal": local_name,
        "latestOffsite": remote,
        "offsiteMatchesLocal": bool(local_name and remote and local_name == remote),
        "ageHours": parse_int(age_hours),
    }


def _users_block(users_raw: Optional[str], paid_raw: Optional[str]) -> Dict[str, Optional[int]]:
    """Real vs total, kept separate so a probe-inflated number is never the headline."""
    users = parse_pipe_ints(users_raw, ["real", "total"])
    paid = parse_pipe_ints(paid_raw, ["payingLive", "entitledUnexpired", "activeRows"])
    return {
        "realUsers": users["real"],
        "totalUsers": users["total"],
        "payingLiveStripe": paid["payingLive"],
        "entitledUnexpired": paid["entitledUnexpired"],
        "activeSubscriptionRows": paid["activeRows"],
    }


def build(work: Path) -> Dict[str, Any]:
    deep_code = read(work, "health_deep_code")
    dirty = read(work, "deploy_dirty")
    db = parse_pipe_ints(read(work, "db_scanner"), ["rankedRows", "distinctSymbols", "lastScanAgeMinutes"])
    decisions = parse_decisions(read(work, "db_decisions"))
    actionable = sum(count for name, count in decisions.items() if name in ("ENTER", "WAIT_PULLBACK"))
    routes = parse_routes(read(work, "routes"))
    slowest = max(routes, key=lambda row: float(row["totalSeconds"]), default=None)

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": os.environ.get("BASE_URL", ""),
        "withProbes": os.environ.get("WITH_PROBES", "0") == "1",
        "deploy": {
            "commit": read(work, "deploy_commit"),
            "subject": read(work, "deploy_subject"),
            "committedAt": read(work, "deploy_date"),
            "workingTreeClean": dirty is None,
            "dirtyPaths": dirty.splitlines() if dirty else [],
        },
        "health": {
            "app": read_json(work, "health"),
            "deepHttpStatus": deep_code,
            "deep": read_json(work, "health_deep"),
        },
        "routes": routes,
        "slowestRoute": slowest,
        "scanner": {
            "rankedRows": db["rankedRows"],
            "distinctSymbols": db["distinctSymbols"],
            "lastScanAgeMinutes": db["lastScanAgeMinutes"],
            "decisionMix": decisions,
            "actionableRows": actionable,
        },
        "users": _users_block(read(work, "db_users"), read(work, "db_paid")),
        "backups": {
            "postgres": backup_state(read(work, "backup_pg"), read(work, "r2_pg"), read(work, "backup_pg_age_h")),
            "scanner": backup_state(read(work, "backup_scanner"), read(work, "r2_scanner"), read(work, "backup_scanner_age_h")),
            "staleTempFiles": parse_int(read(work, "backup_stale_tmp")),
        },
        "resources": {
            "containers": parse_stats(read(work, "docker_stats")),
            "disk": read(work, "disk"),
        },
    }


def concerns(snapshot: Dict[str, Any]) -> List[str]:
    """State what is wrong in plain words. Empty list means nothing detected."""
    found: List[str] = []
    deploy: Dict[str, Any] = snapshot["deploy"]
    if not deploy["workingTreeClean"]:
        found.append("Production working tree is dirty - the running code may not match the recorded commit.")

    status = snapshot["health"]["deepHttpStatus"]
    if status and status != "200":
        found.append(f"Deep health returned HTTP {status}.")

    for name in ("postgres", "scanner"):
        state: Dict[str, Any] = snapshot["backups"][name]
        age = state["ageHours"]
        if state["latestLocal"] is None:
            found.append(f"No local {name} backup found at all.")
        elif not state["offsiteMatchesLocal"] and not (isinstance(age, int) and age < 1):
            # A backup uploaded within the last hour may still be in flight, and a
            # multi-gigabyte artifact takes a while. Flagging that mismatch turns a
            # normal in-progress upload into a false alarm every run.
            found.append(f"Offsite {name} backup does not match the newest local artifact.")
        # In sync but ancient is the failure mode a match-only check misses:
        # a stopped backup job leaves both copies identical and both useless.
        if isinstance(age, int) and age > 48:
            found.append(f"Newest {name} backup is {age} hours old ({age // 24} days) - the backup job may have stopped.")

    stale_tmp = snapshot["backups"].get("staleTempFiles")
    if isinstance(stale_tmp, int) and stale_tmp > 0:
        found.append(
            f"{stale_tmp} backup .tmp file(s) older than 2 hours - a dump started and never "
            "completed, or something removed it mid-write."
        )

    age = snapshot["scanner"]["lastScanAgeMinutes"]
    if isinstance(age, int) and age > 180:
        found.append(f"Newest scan is {age} minutes old.")

    ranked = snapshot["scanner"]["rankedRows"]
    if isinstance(ranked, int) and ranked == 0:
        found.append("Latest scan ranked zero symbols.")

    mix: Dict[str, int] = snapshot["scanner"]["decisionMix"]
    total_rows = sum(mix.values()) if mix else 0
    actionable = snapshot["scanner"]["actionableRows"]
    if mix and total_rows and actionable / total_rows < 0.02:
        shown = ", ".join(f"{name} {count}" for name, count in sorted(mix.items(), key=lambda kv: -kv[1]))
        found.append(
            f"Latest scan produced {actionable} actionable rows out of {total_rows} - "
            f"users are shown effectively nothing to act on. Decision mix: {shown}."
        )

    for row in snapshot["routes"]:
        if row["status"] != "200":
            found.append(f"Route {row['path']} returned HTTP {row['status']}.")

    slowest: Optional[Dict[str, Any]] = snapshot["slowestRoute"]
    if slowest and float(slowest["totalSeconds"]) > 3.0:
        found.append(f"Slowest route {slowest['path']} took {slowest['totalSeconds']}s.")

    return found


def esc(value: object) -> str:
    return html.escape("-" if value is None else str(value))


def render_html(snapshot: Dict[str, Any], issues: List[str]) -> str:
    deploy: Dict[str, Any] = snapshot["deploy"]
    scanner: Dict[str, Any] = snapshot["scanner"]
    users: Dict[str, Any] = snapshot["users"]

    issue_html = (
        "<p class='ok'>No problems detected in this snapshot.</p>"
        if not issues
        else "<ul class='issues'>" + "".join(f"<li>{esc(item)}</li>" for item in issues) + "</ul>"
    )

    route_rows = "".join(
        "<tr><td>{path}</td><td class='n {cls}'>{status}</td><td class='n'>{secs}s</td></tr>".format(
            path=esc(row["path"]),
            cls="bad" if row["status"] != "200" else "",
            status=esc(row["status"]),
            secs=esc(row["totalSeconds"]),
        )
        for row in snapshot["routes"]
    )

    container_rows = "".join(
        f"<tr><td>{esc(row['container'])}</td><td class='n'>{esc(row['cpu'])}</td><td class='n'>{esc(row['memory'])}</td></tr>"
        for row in snapshot["resources"]["containers"]
    )

    backup_rows = "".join(
        "<tr><td>{name}</td><td>{local}</td><td>{remote}</td><td class='n'>{age}h</td><td class='n {cls}'>{state}</td></tr>".format(
            name=name,
            local=esc(snapshot["backups"][name]["latestLocal"]),
            remote=esc(snapshot["backups"][name]["latestOffsite"]),
            cls="" if snapshot["backups"][name]["offsiteMatchesLocal"] else "bad",
            state="in sync" if snapshot["backups"][name]["offsiteMatchesLocal"] else "STALE",
            age=esc(snapshot["backups"][name]["ageHours"]),
        )
        for name in ("postgres", "scanner")
    )

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TradeVeto ops snapshot</title>
<style>
:root {{ color-scheme: light dark; --ink:#14201e; --muted:#66756f; --line:#d8e0dd;
         --bg:#f3f5f4; --card:#fff; --bad:#8e3320; --ok:#2c6b4e; }}
@media (prefers-color-scheme: dark) {{ :root {{ --ink:#e3eae7; --muted:#93a29d; --line:#26312e;
         --bg:#0d1413; --card:#151d1c; --bad:#de8067; --ok:#6bb490; }} }}
* {{ box-sizing:border-box }}
body {{ margin:0; background:var(--bg); color:var(--ink); font:15px/1.55 ui-sans-serif,system-ui,sans-serif; }}
.wrap {{ max-width:900px; margin:0 auto; padding:28px 20px 64px }}
h1 {{ font-size:24px; margin:0 0 4px }}
.sub {{ color:var(--muted); font-size:13px; margin:0 0 24px; font-family:ui-monospace,monospace }}
section {{ background:var(--card); border:1px solid var(--line); border-radius:8px; padding:16px 18px; margin-bottom:14px }}
h2 {{ font-size:12px; text-transform:uppercase; letter-spacing:.12em; color:var(--muted); margin:0 0 12px }}
table {{ border-collapse:collapse; width:100% }}
td, th {{ text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); font-size:14px }}
tr:last-child td {{ border-bottom:0 }}
.n {{ font-family:ui-monospace,monospace; font-variant-numeric:tabular-nums }}
.bad {{ color:var(--bad); font-weight:600 }}
.ok {{ color:var(--ok); margin:0 }}
.issues {{ margin:0; padding-left:20px }}
.issues li {{ color:var(--bad); margin-bottom:6px }}
.kv {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px }}
.kv div b {{ display:block; font:600 21px/1.2 ui-monospace,monospace; font-variant-numeric:tabular-nums }}
.kv div small {{ color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.08em }}
.scroll {{ overflow-x:auto }}
</style></head><body><div class="wrap">
<h1>TradeVeto ops snapshot</h1>
<p class="sub">{esc(snapshot['generatedAt'])} &middot; {esc(snapshot['baseUrl'])}</p>

<section><h2>Needs attention</h2>{issue_html}</section>

<section><h2>Deploy</h2>
<div class="kv">
  <div><b>{esc(deploy['commit'])}</b><small>commit</small></div>
  <div><b>{'clean' if deploy['workingTreeClean'] else 'DIRTY'}</b><small>working tree</small></div>
  <div><b>{esc(snapshot['health']['deepHttpStatus'])}</b><small>deep health</small></div>
</div>
<p class="sub" style="margin:12px 0 0">{esc(deploy['subject'])}</p>
</section>

<section><h2>Users and scanner</h2>
<div class="kv">
  <div><b>{esc(users['realUsers'])}</b><small>real users</small></div>
  <div><b>{esc(users['payingLiveStripe'])}</b><small>paying (live stripe)</small></div>
  <div><b>{esc(users['entitledUnexpired'])}</b><small>entitled incl. comped</small></div>
  <div><b>{esc(users['totalUsers'])}</b><small>incl. probe</small></div>
  <div><b>{esc(scanner['rankedRows'])}</b><small>ranked rows</small></div>
  <div><b>{esc(scanner['distinctSymbols'])}</b><small>distinct symbols</small></div>
  <div><b>{esc(scanner['lastScanAgeMinutes'])}</b><small>scan age (min)</small></div>
  <div><b class="{'bad' if scanner['actionableRows'] == 0 and scanner['decisionMix'] else ''}">{esc(scanner['actionableRows'])}</b><small>actionable rows</small></div>
</div>
<p class="sub" style="margin:12px 0 0">decision mix: {esc(', '.join(f"{k} {v}" for k, v in sorted(scanner['decisionMix'].items(), key=lambda kv: -kv[1])) or '-')}</p>
</section>

<section><h2>Backups</h2><div class="scroll"><table>
<tr><th>Set</th><th>Newest local</th><th>Newest offsite</th><th>Age</th><th>State</th></tr>
{backup_rows}
</table></div></section>

<section><h2>Routes</h2><div class="scroll"><table>
<tr><th>Path</th><th>Status</th><th>Total</th></tr>
{route_rows}
</table></div></section>

<section><h2>Containers</h2><div class="scroll"><table>
<tr><th>Container</th><th>CPU</th><th>Memory</th></tr>
{container_rows}
</table></div>
<p class="sub" style="margin:12px 0 0">disk: {esc(snapshot['resources']['disk'])}</p>
</section>

</div></body></html>"""


def main() -> int:
    work = Path(os.environ["WORK"])
    snapshot = build(work)
    issues = concerns(snapshot)
    snapshot["concerns"] = issues

    Path(os.environ["JSON_OUT"]).write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    Path(os.environ["HTML_OUT"]).write_text(render_html(snapshot, issues), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
