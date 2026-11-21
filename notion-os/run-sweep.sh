#!/usr/bin/env bash
set -euo pipefail

export PATH="/Users/rustancorpuz/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
LOG_DIR="/Users/rustancorpuz/.pi/agent/notion-os/logs"
mkdir -p "$LOG_DIR"
STAMP="$(date +%Y-%m-%d_%H%M%S)"

exec /Users/rustancorpuz/.local/bin/pi -p --no-session \
  "Fetch the Notion Skill 'Notion Operating Contract' (https://app.notion.com/p/41fad88a64e08175b961d3cb994d1b39) and run the Weekly Convergent Sweep Procedure (steps 1 through 8) on Rustan's Notion workspace. Never call notion-delete-pages and never touch Passwords (3f2ad88a-64e0-8049-9ca0-ce95ef1eab07). Leave already-compliant rows untouched so Edited timestamps are preserved. Report a concise summary of fixes." \
  >"$LOG_DIR/sweep-$STAMP.log" 2>&1
