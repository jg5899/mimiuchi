# Mimiuchi Admin Dashboard — Design Spec

## Overview

A web-accessible monitoring and control dashboard for a single Mimiuchi instance. The dashboard runs independently of the Electron app via a lightweight Node.js manager service, enabling remote start/stop of the app, real-time stats monitoring, and service fund tracking.

**Primary use case:** Operator monitors and controls a Mimiuchi instance running at a church/venue from their phone or laptop, without needing terminal access.

## Architecture

### Components

```
[Admin Dashboard :9090]  ←→  [Manager Service (always running)]
                                       ↕ local WebSocket
                               [Electron App (child process)]
                                       ↕ WebSocket
                               [Viewers via :8080 (unchanged)]
```

**Manager Service** (~350 lines, Node.js)
- Always-on process, started on boot (launchd/systemd/pm2)
- Listens on port 9090 (HTTP for admin dashboard + WebSocket for admin clients)
- Listens on port 9091 (WebSocket for Electron ↔ Manager internal communication, localhost only)
- Serves the admin dashboard HTML at `/admin`
- Spawns/kills the Electron app as a child process
- Relays stats from Electron (port 9091) to admin clients (port 9090)
- Relays commands from admin clients to Electron
- Polls provider balance APIs for fund tracking
- PIN-gated: rejects unauthenticated admin connections
- Fails with clear error if port 9090 is already in use

**Admin Dashboard** (standalone HTML, ~300 lines)
- Static HTML page served by the manager at `/admin`
- Same architectural pattern as the existing `display.html`
- Connects to manager via WebSocket
- Displays real-time stats in a 3x2 card grid
- Provides controls: start/stop app, toggle HTTP server, toggle tunnel
- Two states: "online" (full stats + controls) and "offline" (start button + last session summary)

**Electron App** (minimal changes, ~50 lines added)
- On startup, connects to manager via local WebSocket (`ws://localhost:9091`)
- Pushes stats snapshot every 2 seconds
- Receives and executes commands (toggle server, toggle tunnel, shutdown)
- Existing viewer system on port 8080 is completely unchanged

### Ports

| Port | Service | Access |
|------|---------|--------|
| 9090 | Manager HTTP (admin dashboard) | Local network |
| 9091 | Manager WebSocket (internal) | Localhost only (Electron ↔ Manager) |
| 8080 | Electron HTTP/WS (viewer display) | Local network / tunnel |

## Dashboard Panels

### 1. Viewers
- Current connected count (large number)
- List of connected clients: IP address, language filter, connection duration
- Expandable if more than 4 viewers

### 2. Server & Tunnel
- HTTP Server: on/off toggle, local URL display
- Cloudflare Tunnel: on/off toggle, public URL display when active
- QR code availability indicator

### 3. Funds Remaining
- Per-provider balance with progress bar visualization
- Deepgram: auto-pull via `/v1/projects/{id}/balances` API (polled every 5 minutes)
- OpenAI: auto-pull if balance endpoint available, otherwise manual entry
- Color-coded bars based on absolute dollar thresholds: green (>$10), amber ($3-$10), red (<$3)

### 4. Speech-to-Text
- Active engine name (Web Speech / Deepgram Nova-3 / Whisper)
- Mic status: listening / paused / inactive
- Streaming indicator

### 5. Translation
- Active provider (OpenAI / DeepL)
- Enabled languages as tag chips
- Queue depth (pending translations)

### 6. Session
- Uptime
- Total words transcribed
- Total translations served
- Peak viewer count

### Offline State
When Electron is not running:
- All panels collapse to a centered offline indicator
- "Start App" button prominently displayed
- Last session stats shown below (persisted by manager)

## Stats Reporting Protocol

### IPC Bridge: Renderer → Main Process

Stats originate from Pinia stores in the **renderer process** (speech, logs, multi_translation). Since the main process cannot access renderer stores directly, the renderer pushes a stats object to main via IPC on a 2-second timer:

**Renderer side** (new `src/helpers/stats_reporter.ts`, ~30 lines):
- Runs a `setInterval(2000)` timer
- Reads from Pinia stores: `speechStore`, `logsStore`, `multiTranslationStore`, `translationQueueStore`
- Sends aggregated stats via `window.ipcRenderer.send('stats-update', payload)`

**Main process side** (`manager-client.ts`):
- Listens for `ipcMain.on('stats-update', ...)`
- Merges renderer stats with main-process-only stats (viewer list, server status, tunnel status)
- Forwards merged snapshot to manager via WebSocket

### New Counters

Two new counters need to be added since they don't exist in current stores:

- **`words_transcribed`**: Increment in `logsStore` when a transcription is finalized. Count words via `text.split(/\s+/).length` on each final result.
- **`translations_served`**: Increment in `multiTranslationStore` when a translation result is received. Count per-language (one source text → 5 languages = 5 translations served).
- **`peak_viewers`**: Tracked in main process `httpserver.ts` — update on each new WebSocket connection if current count exceeds previous max.

### Viewer Client Tracking

The existing `HttpServer` class tracks WebSocket subscriptions but not per-client metadata. Add a `Map<WebSocket, ClientInfo>` where:

```typescript
interface ClientInfo {
  ip: string
  lang: string | null    // from subscription
  connected_at: number   // Date.now() on connection
}
```

Populate on WebSocket `connection` event (IP from `req.socket.remoteAddress`, `connected_at` from `Date.now()`). Update `lang` when client sends a subscription message. Remove on `close`.

### Stats Snapshot (Main → Manager)

Electron main process pushes a JSON snapshot to the manager every 2 seconds:

```json
{
  "type": "stats",
  "viewers": {
    "count": 7,
    "clients": [
      {"ip": "192.168.1.42", "lang": "spanish", "connected_at": 1710500000}
    ]
  },
  "server": {
    "running": true,
    "port": 8080,
    "local_url": "http://192.168.1.100:8080"
  },
  "tunnel": {
    "running": true,
    "url": "abc123.trycloudflare.com"
  },
  "stt": {
    "engine": "deepgram",
    "model": "nova-3",
    "listening": true
  },
  "translation": {
    "provider": "openai",
    "languages": ["spanish", "ukrainian", "russian", "romanian", "french"],
    "queue_pending": 0
  },
  "session": {
    "started_at": 1710490000,
    "words_transcribed": 4218,
    "translations_served": 21090,
    "peak_viewers": 12
  }
}
```

## Command Protocol

Admin dashboard sends commands through the manager:

```json
{"type": "command", "action": "start_app"}
{"type": "command", "action": "stop_app"}
{"type": "command", "action": "toggle_server", "enabled": true}
{"type": "command", "action": "toggle_tunnel", "enabled": true}
```

Manager handles `start_app` and `stop_app` directly (child process management). Server and tunnel commands are relayed to Electron.

## Authentication

- Single PIN stored in `~/.mimiuchi-manager/config.json`
- Set on first launch or by editing the config file
- Admin dashboard shows PIN entry screen on load
- PIN sent as first WebSocket message after connection: `{"type": "auth", "pin": "1234"}`
- Manager validates within 5 seconds of connection; no auth message = disconnect
- Valid PIN: manager responds `{"type": "auth", "status": "ok"}` and begins relaying stats
- Invalid PIN: manager responds `{"type": "auth", "status": "denied"}` and disconnects
- Stateless: PIN entered each time (no cookies/sessions)
- Viewer `display.html` on port 8080 remains unauthenticated (unchanged)

## Funds Polling

Manager handles balance checks directly (not Electron) since it needs to work even when Electron is offline.

**Deepgram:**
- Endpoint: `GET https://api.deepgram.com/v1/projects/{project_id}/balances`
- Auth: API key from config
- Poll interval: 5 minutes
- Returns credit balance

**OpenAI:**
- Check for available billing/balance endpoint at implementation time
- Fallback: manual entry field in admin dashboard, stored in manager config

**Config storage:**
```json
// ~/.mimiuchi-manager/config.json
{
  "pin": "1234",
  "electron_path": "/path/to/mimiuchi",
  "funds": {
    "deepgram": {
      "api_key": "...",
      "project_id": "..."
    },
    "openai": {
      "api_key": "...",
      "manual_balance": 14.32
    }
  }
}
```

## File Structure (New Files)

```
mimiuchi/
├── manager/
│   ├── index.js          # Manager service entry point
│   ├── config.js         # Config loading/saving (~/.mimiuchi-manager/)
│   ├── funds.js          # Balance polling (Deepgram, OpenAI)
│   └── admin.html        # Admin dashboard (standalone, like display.html)
├── electron/
│   └── main/
│       └── modules/
│           └── manager-client.ts  # WebSocket client connecting to manager
```

## Changes to Existing Files

| File | Change |
|------|--------|
| `electron/main/index.ts` | Import and initialize manager-client on startup (~10 lines) |
| `electron/main/modules/httpserver.ts` | Expose connected client list for stats collection (~15 lines) |
| `electron/main/modules/cloudflared.ts` | Expose status for stats, accept toggle commands (~10 lines) |
| `src/stores/speech.ts` | No changes needed — engine/listening state already accessible from renderer stats reporter |
| `src/stores/logs.ts` | Add `words_transcribed` counter, increment on each finalized transcription (~5 lines) |
| `src/stores/multi_translation.ts` | Add `translations_served` counter, increment on each translation result (~5 lines) |

New files in existing codebase:
| File | Purpose |
|------|---------|
| `src/helpers/stats_reporter.ts` | Renderer-side timer that reads Pinia stores and sends stats to main via IPC (~30 lines) |

Total changes to existing code: ~65 lines. All additive (no behavior changes).

## Deployment

The manager service needs to auto-start on boot:

- **macOS:** launchd plist or pm2
- **Linux:** systemd unit or pm2
- **Windows:** pm2 or startup shortcut

A setup script will be provided to install the manager as a service.

## Out of Scope

- User accounts / multi-user auth (single PIN only)
- Historical stats / time-series data (current session only)
- Multiple Mimiuchi instances
- Remote STT mic control (operator controls mic from Electron UI)
- Mobile-native app (web dashboard is mobile-responsive)
