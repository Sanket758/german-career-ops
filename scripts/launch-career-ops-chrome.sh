#!/usr/bin/env bash
# launch-career-ops-chrome.sh — Start the dedicated LinkedIn automation Chrome with CDP.
# Idempotent: if a Chrome with this profile is already listening on 9222, just says so.
set -euo pipefail

PROFILE="${CAREER_OPS_CHROME_PROFILE:-$HOME/.config/career-ops-chrome}"
PORT="${CAREER_OPS_CHROME_PORT:-9222}"
LOG="${CAREER_OPS_CHROME_LOG:-/tmp/career-ops-chrome.log}"
CHROME_BIN="${CHROME_BIN:-/opt/google/chrome/chrome}"

if curl -sf -m 2 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  echo "OK: Chrome already listening on :${PORT} (profile: ${PROFILE})"
  exit 0
fi

mkdir -p "$PROFILE"
nohup "$CHROME_BIN" \
  --user-data-dir="$PROFILE" \
  --remote-debugging-port="$PORT" \
  --remote-debugging-address=127.0.0.1 \
  --no-first-run --no-default-browser-check \
  about:blank >"$LOG" 2>&1 &

echo "Launched Chrome (pid $!) with profile ${PROFILE} on :${PORT}. Log: ${LOG}"
for i in $(seq 1 20); do
  if curl -sf -m 2 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
    echo "OK: CDP reachable at http://127.0.0.1:${PORT}"
    exit 0
  fi
  sleep 0.5
done
echo "ERROR: Chrome did not open :${PORT} within 10s. Check ${LOG}" >&2
exit 1