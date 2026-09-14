#!/usr/bin/env bash
set -euo pipefail

LABEL="com.tradeveto.command-relay"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$UID" "$PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"
echo "uninstalled $LABEL"
