#!/usr/bin/env bash
set -euo pipefail

REPO="${TRADEVETO_REPO:-/Users/hdtv/dev/market-alpha-scanner}"
LABEL="com.tradeveto.command-relay"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
WORKER="$REPO/tools/local/tradeveto-command-relay/relay_worker.py"
RELAY_DIR="$REPO/.agent-relay"

mkdir -p "$HOME/Library/LaunchAgents" "$RELAY_DIR/requests" "$RELAY_DIR/results" "$RELAY_DIR/archive"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>$WORKER</string>
    <string>--repo</string>
    <string>$REPO</string>
    <string>--poll-seconds</string>
    <string>2</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$RELAY_DIR/worker.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>$RELAY_DIR/worker.stderr.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$UID" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID" "$PLIST"
launchctl kickstart -k "gui/$UID/$LABEL"
launchctl print "gui/$UID/$LABEL" | sed -n '1,40p'
