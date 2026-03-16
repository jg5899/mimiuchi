#!/usr/bin/env bash
# manager/setup.sh — Install mimiuchi-manager as a launchd service (macOS)
# Usage: bash manager/setup.sh [path-to-mimiuchi-project]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${1:-$(dirname "$SCRIPT_DIR")}"
NODE_PATH="$(which node)"
CONFIG_DIR="$HOME/.mimiuchi-manager"
PLIST_NAME="com.mimiuchi.manager"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

echo "Setting up mimiuchi-manager..."
echo "  Manager: $SCRIPT_DIR"
echo "  Project: $PROJECT_DIR"
echo "  Node:    $NODE_PATH"

cd "$SCRIPT_DIR"
npm install --production

mkdir -p "$CONFIG_DIR"
if [ ! -f "$CONFIG_DIR/config.json" ]; then
  cat > "$CONFIG_DIR/config.json" <<CONF
{
  "pin": "",
  "electron_path": "$PROJECT_DIR",
  "funds": {
    "deepgram": { "api_key": "", "project_id": "" },
    "openai": { "api_key": "", "manual_balance": null }
  }
}
CONF
  echo "  Created $CONFIG_DIR/config.json — edit to set PIN and API keys"
else
  echo "  Config exists at $CONFIG_DIR/config.json"
fi

if [ "$(uname)" = "Darwin" ]; then
  cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${SCRIPT_DIR}/index.js</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${CONFIG_DIR}/manager.log</string>
  <key>StandardErrorPath</key>
  <string>${CONFIG_DIR}/manager.log</string>
  <key>WorkingDirectory</key>
  <string>${SCRIPT_DIR}</string>
</dict>
</plist>
PLIST

  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  launchctl load "$PLIST_PATH"

  echo "  Installed launchd service: $PLIST_NAME"
  echo "  Logs: $CONFIG_DIR/manager.log"
  echo ""
  echo "Manager is running! Open http://localhost:9090/admin"
else
  echo ""
  echo "  Not macOS — set up with pm2:"
  echo "    pm2 start $SCRIPT_DIR/index.js --name mimiuchi-manager"
  echo "    pm2 save && pm2 startup"
fi
