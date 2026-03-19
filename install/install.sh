#!/usr/bin/env bash
# mimiuchi install script
# Usage: bash install.sh [path-to-secrets.json]
#
# Installs mimiuchi on a fresh Mac with everything pre-configured:
#   - Node.js (via Homebrew if missing)
#   - cloudflared (via Homebrew if missing)
#   - Builds the production Electron app
#   - Installs the manager dashboard (auto-starts on login)
#   - Pre-configures API keys, tunnel, and PIN
#
# The secrets.json file should contain:
#   {
#     "pin": "7011",
#     "deepgram_api_key": "...",
#     "openai_api_key": "...",
#     "tunnel_token": "...",
#     "tunnel_hostname": "caption.gensandbox.com"
#   }

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SECRETS_FILE="${1:-$SCRIPT_DIR/secrets.json}"
CONFIG_DIR="$HOME/.mimiuchi-manager"
APP_SUPPORT_DIR="$HOME/Library/Application Support/mimiuchi"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}WARNING:${NC} $1"; }
fail() { echo -e "${RED}ERROR:${NC} $1"; exit 1; }

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║       mimiuchi installer             ║"
echo "  ║  Real-time transcription & caption   ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# --- Check secrets file ---
if [ ! -f "$SECRETS_FILE" ]; then
  warn "No secrets.json found at $SECRETS_FILE"
  echo "  Copy secrets.example.json to secrets.json and fill in your API keys."
  echo "  Then run: bash install.sh"
  echo ""
  echo "  Or provide the path: bash install.sh /path/to/secrets.json"
  exit 1
fi

step "Reading secrets from $SECRETS_FILE"
# Parse JSON with node if available, otherwise basic grep
if command -v node &>/dev/null; then
  PIN=$(node -e "console.log(require('$SECRETS_FILE').pin || '')")
  DEEPGRAM_KEY=$(node -e "console.log(require('$SECRETS_FILE').deepgram_api_key || '')")
  OPENAI_KEY=$(node -e "console.log(require('$SECRETS_FILE').openai_api_key || '')")
  TUNNEL_TOKEN=$(node -e "console.log(require('$SECRETS_FILE').tunnel_token || '')")
  TUNNEL_HOSTNAME=$(node -e "console.log(require('$SECRETS_FILE').tunnel_hostname || '')")
else
  fail "Node.js is required to parse secrets. Install it first."
fi

echo "  PIN: ${PIN:+set}${PIN:-not set}"
echo "  Deepgram API key: ${DEEPGRAM_KEY:+set (${#DEEPGRAM_KEY} chars)}${DEEPGRAM_KEY:-not set}"
echo "  OpenAI API key: ${OPENAI_KEY:+set (${#OPENAI_KEY} chars)}${OPENAI_KEY:-not set}"
echo "  Tunnel token: ${TUNNEL_TOKEN:+set (${#TUNNEL_TOKEN} chars)}${TUNNEL_TOKEN:-not set}"
echo "  Tunnel hostname: ${TUNNEL_HOSTNAME:-not set}"

# --- Check / Install prerequisites ---
step "Checking prerequisites"

# Homebrew
if ! command -v brew &>/dev/null; then
  step "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi
echo "  Homebrew: $(brew --version | head -1)"

# Node.js
if ! command -v node &>/dev/null; then
  step "Installing Node.js..."
  brew install node
fi
NODE_VERSION=$(node --version)
echo "  Node.js: $NODE_VERSION"

# npm
if ! command -v npm &>/dev/null; then
  fail "npm not found. Please install Node.js properly."
fi
echo "  npm: $(npm --version)"

# cloudflared (optional but recommended)
if ! command -v cloudflared &>/dev/null; then
  if [ -n "$TUNNEL_TOKEN" ]; then
    step "Installing cloudflared (needed for tunnel)..."
    brew install cloudflared
  else
    warn "cloudflared not installed. Tunnel features will be unavailable."
  fi
else
  echo "  cloudflared: $(cloudflared --version 2>&1 | head -1)"
fi

# --- Build the app ---
step "Installing npm dependencies"
cd "$PROJECT_DIR"
npm install --no-audit --no-fund 2>&1 | tail -3

step "Building production app"
npm run build 2>&1 | tail -5

APP_BINARY="$PROJECT_DIR/release/0.5.0/mac-arm64/mimiuchi.app/Contents/MacOS/mimiuchi"
if [ ! -f "$APP_BINARY" ]; then
  # Try x64
  APP_BINARY="$PROJECT_DIR/release/0.5.0/mac-x64/mimiuchi.app/Contents/MacOS/mimiuchi"
fi
if [ ! -f "$APP_BINARY" ]; then
  fail "Build failed — could not find mimiuchi binary"
fi
echo "  Built: $APP_BINARY"

# --- Install manager service ---
step "Setting up manager dashboard"
cd "$PROJECT_DIR/manager"
npm install --production --no-audit --no-fund 2>&1 | tail -2

# --- Write manager config ---
step "Writing manager config"
mkdir -p "$CONFIG_DIR"

NODE_PATH="$(which node)"
MANAGER_DIR="$PROJECT_DIR/manager"

cat > "$CONFIG_DIR/config.json" <<CONF
{
  "pin": "$PIN",
  "electron_path": "$APP_BINARY",
  "funds": {
    "deepgram": { "api_key": "", "project_id": "" },
    "openai": { "api_key": "", "manual_balance": null }
  }
}
CONF
echo "  Config: $CONFIG_DIR/config.json"

# --- Pre-configure app settings (localStorage seed) ---
step "Pre-configuring app settings"
mkdir -p "$APP_SUPPORT_DIR"

# Create a seed file that the app reads on first launch
cat > "$APP_SUPPORT_DIR/seed-settings.json" <<SEED
{
  "speech": {
    "stt": {
      "type": { "title": "Deepgram Nova-3", "value": "deepgram" },
      "language": "en-US",
      "confidence": 0.9,
      "sensitivity": 0,
      "deepgramApiKey": "$DEEPGRAM_KEY"
    },
    "tts": { "enabled": false, "type": "webspeech", "voice": "", "rate": 1, "pitch": 1 },
    "pinned_languages": {}
  },
  "translation": {
    "enabled": false,
    "type": "OpenAI",
    "source": "eng_Latn",
    "target": "spa_Latn",
    "download": -1,
    "show_original": true,
    "display_mode": "translation",
    "openai_api_key": "$OPENAI_KEY",
    "use_context": false,
    "context_window_size": 3
  },
  "httpserver": {
    "enabled": true,
    "port": 8080,
    "tunnelMode": "named",
    "tunnelToken": "$TUNNEL_TOKEN",
    "tunnelHostname": "$TUNNEL_HOSTNAME"
  }
}
SEED
echo "  Seed settings written"

# --- Install launchd service ---
step "Installing launchd service (auto-start on login)"
PLIST_NAME="com.mimiuchi.manager"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

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
    <string>${MANAGER_DIR}/index.js</string>
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
  <string>${MANAGER_DIR}</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"
echo "  Service installed and started"

# --- Done ---
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  mimiuchi installed successfully!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "  Dashboard:  http://localhost:9090/admin"
echo "  PIN:        $PIN"
echo ""
echo "  To use:"
echo "    1. Open http://localhost:9090/admin in a browser"
echo "    2. Enter the PIN"
echo "    3. Click 'Start App' to launch mimiuchi"
echo "    4. Click 'Start Mic' to begin transcribing"
echo ""
if [ -n "$TUNNEL_HOSTNAME" ]; then
echo "  Public URL: https://$TUNNEL_HOSTNAME"
echo "  (Toggle Cloudflare Tunnel on in the dashboard)"
echo ""
fi
echo "  Display URLs (for phones/tablets/projectors):"
echo "    Local:   http://localhost:8080"
echo "    Network: http://$(ipconfig getifaddr en0 2>/dev/null || echo '<your-ip>'):8080"
echo ""
echo "  Logs: $CONFIG_DIR/manager.log"
echo "  Config: $CONFIG_DIR/config.json"
echo ""
