#!/usr/bin/env bash
# Install the out-of-image scanner monitoring: a daily health timer and a
# non-blocking freshness check in front of each scan.
#
# Everything installed here lives OUTSIDE the scanner image, deliberately. The
# guard that shipped inside the image could not detect that the image was stale
# -- see docs/ops/rca-sndk-missing-from-scanner-20260910.md.
#
# Idempotent. Re-running it overwrites the same four files and reloads systemd.
# Uninstall is documented at the bottom.
set -euo pipefail

APP="/opt/apps/market-alpha-scanner/app"
SRC="${APP}/tools/ops/systemd"

if [ "$(id -u)" -ne 0 ]; then
  echo "install-scanner-monitoring.sh must run as root (it writes /etc/systemd)" >&2
  exit 1
fi
for f in tradeveto-scanner-health.service tradeveto-scanner-health.timer \
         market-alpha-fast-scan.service.d/freshness.conf \
         market-alpha-full-scan.service.d/freshness.conf; do
  [ -f "${SRC}/${f}" ] || { echo "missing source unit: ${SRC}/${f}" >&2; exit 1; }
done

install -m 0644 "${SRC}/tradeveto-scanner-health.service" /etc/systemd/system/tradeveto-scanner-health.service
install -m 0644 "${SRC}/tradeveto-scanner-health.timer"   /etc/systemd/system/tradeveto-scanner-health.timer
install -d -m 0755 /etc/systemd/system/market-alpha-fast-scan.service.d
install -d -m 0755 /etc/systemd/system/market-alpha-full-scan.service.d
install -m 0644 "${SRC}/market-alpha-fast-scan.service.d/freshness.conf" \
                /etc/systemd/system/market-alpha-fast-scan.service.d/freshness.conf
install -m 0644 "${SRC}/market-alpha-full-scan.service.d/freshness.conf" \
                /etc/systemd/system/market-alpha-full-scan.service.d/freshness.conf

install -d -m 0755 -o sre -g sre /var/lib/tradeveto-scanner-health
install -d -m 0755 /var/log/market-alpha

systemctl daemon-reload
systemctl enable --now tradeveto-scanner-health.timer

echo "installed:"
systemctl is-enabled tradeveto-scanner-health.timer
systemctl list-timers tradeveto-scanner-health.timer --no-pager || true
echo
echo "the scans now run the freshness check first (non-blocking):"
systemctl cat market-alpha-fast-scan.service --no-pager | grep -A1 "freshness.conf" || true
echo
echo "uninstall:"
echo "  systemctl disable --now tradeveto-scanner-health.timer"
echo "  rm -f /etc/systemd/system/tradeveto-scanner-health.{service,timer}"
echo "  rm -f /etc/systemd/system/market-alpha-{fast,full}-scan.service.d/freshness.conf"
echo "  systemctl daemon-reload"
