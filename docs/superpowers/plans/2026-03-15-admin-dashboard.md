# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a web-accessible monitoring and control dashboard for Mimiuchi, powered by a standalone Node.js manager service that can start/stop the Electron app and relay real-time stats.

**Architecture:** A lightweight always-on Node.js manager (port 9090/9091) spawns Electron as a child process. Electron reports stats to the manager over a local WebSocket. The manager serves a PIN-gated admin HTML dashboard that shows real-time viewer counts, server/tunnel status, STT/translation state, session stats, and provider fund balances.

**Tech Stack:** Node.js (http, ws, child_process), standalone HTML/CSS/JS (same pattern as display.html), TypeScript additions to Electron main process.

**Spec:** `docs/superpowers/specs/2026-03-15-admin-dashboard-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `manager/index.js` | Manager service entry point — HTTP server (port 9090), two WebSocket servers (admin on 9090, internal on 9091), child process management, PIN auth, stats relay |
| `manager/config.js` | Load/save `~/.mimiuchi-manager/config.json` — PIN, electron path, fund API keys, last session |
| `manager/funds.js` | Poll Deepgram/OpenAI balance APIs, return cached balances |
| `manager/admin.html` | Admin dashboard — standalone HTML/CSS/JS page, WebSocket client, PIN entry, stats panels, controls |
| `manager/package.json` | Minimal deps: `ws` only |
| `electron/main/modules/manager-client.ts` | WebSocket client that connects to manager on port 9091, sends stats, receives commands |
| `src/helpers/stats_reporter.ts` | Renderer-side 2s timer — reads Pinia stores, sends aggregated stats to main via IPC |

### Modified Files

| File | Change |
|------|--------|
| `electron/main/modules/httpserver.ts` | Add `ClientInfo` map, `getClientList()` and `getPeakViewers()` getters (~20 lines) |
| `electron/main/modules/cloudflared.ts` | Already has `getStatus()` — no changes needed |
| `electron/main/index.ts` | Initialize manager-client, add `stats-update` IPC handler, add `manager-command` handler (~25 lines) |
| `electron/preload/index.ts` | Add `'stats-update'` to send allowlist, add `'manager-command'` to on allowlist (~4 lines) |
| `src/stores/logs.ts` | Add `wordsTranscribed` counter (~5 lines) |
| `src/stores/multi_translation.ts` | Add `translationsServed` counter (~5 lines) |
| `src/stores/speech.ts` | Call `logsStore.countWords()` on transcription finalize (~1 line) |
| `src/App.vue` | Initialize stats reporter, handle manager commands (~15 lines) |

---

## Chunk 1: Manager Service Foundation

### Task 1: Manager config module

**Files:**
- Create: `manager/package.json`
- Create: `manager/config.js`

- [ ] **Step 1: Create manager package.json**

```json
{
  "name": "mimiuchi-manager",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "ws": "^8.18.2"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd manager && npm install`
Expected: `node_modules/` created with `ws` package

- [ ] **Step 3: Write config module**

```js
// manager/config.js
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CONFIG_DIR = join(homedir(), '.mimiuchi-manager')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')
const SESSION_PATH = join(CONFIG_DIR, 'last_session.json')

const DEFAULT_CONFIG = {
  pin: '',
  electron_path: '',
  funds: {
    deepgram: { api_key: '', project_id: '' },
    openai: { api_key: '', manual_balance: null }
  }
}

export function loadConfig() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
    return { ...DEFAULT_CONFIG }
  }
  const raw = readFileSync(CONFIG_PATH, 'utf-8')
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
}

export function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

export function loadLastSession() {
  if (!existsSync(SESSION_PATH)) return null
  try {
    return JSON.parse(readFileSync(SESSION_PATH, 'utf-8'))
  } catch { return null }
}

export function saveLastSession(stats) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(SESSION_PATH, JSON.stringify(stats, null, 2))
}
```

- [ ] **Step 4: Test config module manually**

Run: `cd manager && node -e "import('./config.js').then(c => { const cfg = c.loadConfig(); console.log(JSON.stringify(cfg, null, 2)); })"`
Expected: Prints default config, creates `~/.mimiuchi-manager/config.json`

- [ ] **Step 5: Commit**

```bash
git add manager/package.json manager/package-lock.json manager/config.js
git commit -m "feat(manager): add config module with load/save for ~/.mimiuchi-manager"
```

---

### Task 2: Manager HTTP + WebSocket server

**Files:**
- Create: `manager/index.js`

- [ ] **Step 1: Write the manager service**

```js
// manager/index.js
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { WebSocketServer, WebSocket } from 'ws'
import { loadConfig, saveConfig, loadLastSession, saveLastSession } from './config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ADMIN_PORT = 9090
const INTERNAL_PORT = 9091

// --- State ---
let config = loadConfig()
let electronProcess = null
let electronWs = null
let latestStats = null
let lastSessionSaved = 0
const adminClients = new Set()

// --- HTTP Server (port 9090) ---
const adminHtml = readFileSync(join(__dirname, 'admin.html'), 'utf-8')

const httpServer = createServer((req, res) => {
  if (req.url === '/admin' || req.url === '/admin/' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(adminHtml)
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
})

// --- Admin WebSocket (port 9090) ---
const adminWss = new WebSocketServer({ server: httpServer })

adminWss.on('connection', (ws) => {
  let authenticated = false
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      ws.send(JSON.stringify({ type: 'auth', status: 'timeout' }))
      ws.close()
    }
  }, 5000)

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    if (!authenticated) {
      if (msg.type === 'auth') {
        if (!config.pin || msg.pin === config.pin) {
          authenticated = true
          clearTimeout(authTimeout)
          adminClients.add(ws)
          ws.send(JSON.stringify({ type: 'auth', status: 'ok' }))
          ws.send(JSON.stringify({
            type: 'state',
            app_running: electronProcess !== null,
            stats: latestStats,
            last_session: loadLastSession(),
            funds: null
          }))
        } else {
          ws.send(JSON.stringify({ type: 'auth', status: 'denied' }))
          ws.close()
        }
      }
      return
    }

    if (msg.type === 'command') {
      handleCommand(msg)
    }
  })

  ws.on('close', () => {
    clearTimeout(authTimeout)
    adminClients.delete(ws)
  })
})

// --- Internal WebSocket (port 9091, Electron connects here) ---
const internalWss = new WebSocketServer({ port: INTERNAL_PORT, host: '127.0.0.1' })

internalWss.on('connection', (ws) => {
  console.log('[manager] Electron connected')
  electronWs = ws
  broadcastToAdmins({ type: 'app_status', running: true })

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    if (msg.type === 'stats') {
      latestStats = msg
      broadcastToAdmins({ type: 'stats', ...msg })
      const now = Date.now()
      if (now - lastSessionSaved > 30000) {
        saveLastSession(msg.session || {})
        lastSessionSaved = now
      }
    }
  })

  ws.on('close', () => {
    console.log('[manager] Electron disconnected')
    electronWs = null
    latestStats = null
    broadcastToAdmins({ type: 'app_status', running: false })
  })
})

// --- Command Handling ---
function handleCommand(msg) {
  switch (msg.action) {
    case 'start_app':
      startElectron()
      break
    case 'stop_app':
      stopElectron()
      break
    case 'toggle_server':
    case 'toggle_tunnel':
      if (electronWs && electronWs.readyState === WebSocket.OPEN) {
        electronWs.send(JSON.stringify(msg))
      }
      break
    case 'update_config':
      if (msg.config) {
        config = { ...config, ...msg.config }
        saveConfig(config)
      }
      break
  }
}

// --- Electron Process Management ---
function startElectron() {
  if (electronProcess) {
    broadcastToAdmins({ type: 'error', message: 'App is already running' })
    return
  }

  const electronPath = config.electron_path
  if (!electronPath) {
    broadcastToAdmins({ type: 'error', message: 'electron_path not configured in ~/.mimiuchi-manager/config.json' })
    return
  }

  console.log('[manager] Starting Electron: ' + electronPath)

  if (existsSync(join(electronPath, 'package.json'))) {
    electronProcess = spawn('npx', ['electron', '.'], {
      cwd: electronPath,
      stdio: 'pipe',
      env: { ...process.env, MIMIUCHI_MANAGER_PORT: String(INTERNAL_PORT) }
    })
  } else {
    electronProcess = spawn(electronPath, [], {
      stdio: 'pipe',
      env: { ...process.env, MIMIUCHI_MANAGER_PORT: String(INTERNAL_PORT) }
    })
  }

  electronProcess.stdout?.on('data', (d) => console.log('[electron] ' + d.toString().trim()))
  electronProcess.stderr?.on('data', (d) => console.error('[electron] ' + d.toString().trim()))

  electronProcess.on('exit', (code) => {
    console.log('[manager] Electron exited with code ' + code)
    electronProcess = null
    electronWs = null
    latestStats = null
    broadcastToAdmins({ type: 'app_status', running: false })
  })

  broadcastToAdmins({ type: 'app_status', running: true, starting: true })
}

function stopElectron() {
  if (!electronProcess) {
    broadcastToAdmins({ type: 'error', message: 'App is not running' })
    return
  }

  if (electronWs && electronWs.readyState === WebSocket.OPEN) {
    electronWs.send(JSON.stringify({ type: 'command', action: 'shutdown' }))
  }

  setTimeout(() => {
    if (electronProcess) {
      console.log('[manager] Force-killing Electron')
      electronProcess.kill('SIGKILL')
    }
  }, 5000)
}

// --- Broadcast ---
function broadcastToAdmins(msg) {
  const payload = JSON.stringify(msg)
  for (const ws of adminClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload)
    }
  }
}

// --- Start ---
httpServer.listen(ADMIN_PORT, '0.0.0.0', () => {
  console.log('[manager] Admin dashboard: http://localhost:' + ADMIN_PORT + '/admin')
  console.log('[manager] Internal WebSocket: ws://127.0.0.1:' + INTERNAL_PORT)
  if (!config.pin) {
    console.log('[manager] WARNING: No PIN set. Edit ~/.mimiuchi-manager/config.json to add one.')
  }
  if (!config.electron_path) {
    console.log('[manager] WARNING: electron_path not set. Edit ~/.mimiuchi-manager/config.json')
  }
})

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('[manager] ERROR: Port ' + ADMIN_PORT + ' is already in use. Is another manager running?')
    process.exit(1)
  }
  throw err
})

internalWss.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('[manager] ERROR: Port ' + INTERNAL_PORT + ' is already in use.')
    process.exit(1)
  }
  throw err
})

process.on('SIGINT', () => {
  console.log('\n[manager] Shutting down...')
  if (electronProcess) electronProcess.kill('SIGTERM')
  internalWss.close()
  adminWss.close()
  httpServer.close()
  process.exit(0)
})
```

- [ ] **Step 2: Test the manager starts and serves HTTP**

Run: `cd manager && node index.js &` then `curl -s http://localhost:9090/admin | head -5`
Expected: Returns HTML content (will fail until admin.html exists — verify the server starts and prints startup messages)
Cleanup: `kill %1`

- [ ] **Step 3: Commit**

```bash
git add manager/index.js
git commit -m "feat(manager): add main service with HTTP, WebSocket, process management, PIN auth"
```

---

### Task 3: Funds polling module

**Files:**
- Create: `manager/funds.js`
- Modify: `manager/index.js` (add funds integration)

- [ ] **Step 1: Write the funds module**

```js
// manager/funds.js
import { loadConfig } from './config.js'

const POLL_INTERVAL = 5 * 60 * 1000
let cachedFunds = { deepgram: null, openai: null }
let pollTimer = null

export function getCachedFunds() {
  return { ...cachedFunds }
}

export async function pollFunds() {
  const config = loadConfig()
  await Promise.allSettled([
    pollDeepgram(config.funds?.deepgram),
    pollOpenAI(config.funds?.openai)
  ])
  return getCachedFunds()
}

async function pollDeepgram(dgConfig) {
  if (!dgConfig?.api_key || !dgConfig?.project_id) {
    cachedFunds.deepgram = { available: false, reason: 'not_configured' }
    return
  }

  try {
    const res = await fetch(
      'https://api.deepgram.com/v1/projects/' + dgConfig.project_id + '/balances',
      { headers: { 'Authorization': 'Token ' + dgConfig.api_key } }
    )
    if (!res.ok) {
      cachedFunds.deepgram = { available: false, reason: 'api_error_' + res.status }
      return
    }
    const data = await res.json()
    const balances = data.balances || []
    const total = balances.reduce((sum, b) => sum + (b.amount || 0), 0)
    cachedFunds.deepgram = {
      available: true,
      balance: total,
      currency: balances[0]?.units || 'usd',
      polled_at: Date.now()
    }
  } catch {
    cachedFunds.deepgram = { available: false, reason: 'network_error' }
  }
}

async function pollOpenAI(oaiConfig) {
  if (oaiConfig?.manual_balance != null) {
    cachedFunds.openai = {
      available: true,
      balance: oaiConfig.manual_balance,
      currency: 'usd',
      manual: true,
      polled_at: Date.now()
    }
  } else {
    cachedFunds.openai = { available: false, reason: 'not_configured' }
  }
}

export function startPolling() {
  pollFunds()
  pollTimer = setInterval(pollFunds, POLL_INTERVAL)
}

export function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
}
```

- [ ] **Step 2: Integrate funds into manager/index.js**

Add import at top of `manager/index.js`:
```js
import { startPolling, getCachedFunds } from './funds.js'
```

In the initial state message (the `ws.send(JSON.stringify({ type: 'state', ... }))` block), change `funds: null` to:
```js
funds: getCachedFunds()
```

In the `httpServer.listen` callback, add:
```js
startPolling()
```

After the `httpServer.listen` block, add a 60-second fund broadcast timer:
```js
setInterval(() => {
  broadcastToAdmins({ type: 'funds', ...getCachedFunds() })
}, 60000)
```

- [ ] **Step 3: Commit**

```bash
git add manager/funds.js manager/index.js
git commit -m "feat(manager): add funds polling for Deepgram balance API with manual OpenAI fallback"
```

---

### Task 4: Admin dashboard HTML

**Files:**
- Create: `manager/admin.html`

- [ ] **Step 1: Write the admin dashboard**

Create `manager/admin.html` — a standalone HTML file following the same pattern as `public/display.html`. It connects via WebSocket to the manager on port 9090, authenticates with PIN, and renders 6 stat panels in a 3x2 responsive grid.

The dashboard has two screens:
1. **PIN screen** — input + connect button, shown on load
2. **Dashboard** — top bar (app name, online/offline badge, uptime, start/stop button) + 6 cards (Viewers, Server & Tunnel, Funds, STT, Translation, Session) + offline overlay when app is down

Key implementation notes:
- WebSocket connects to same host as the page was loaded from (`location.host`)
- First message after connect is `{ type: 'auth', pin: '...' }`
- Stats update the DOM via `textContent` for plain values
- Viewer list and fund bars use safe DOM construction (create elements, set textContent, no raw HTML injection from external data)
- Toggle switches send commands: `{ type: 'command', action: 'toggle_server', enabled: bool }`
- On WebSocket close while authenticated, auto-reconnect every 3 seconds
- Responsive: 3 columns > 900px, 2 columns > 600px, 1 column on mobile
- Dark theme matching the mockup (background #0f0f1a, cards #1a1a2e)

The CSS and layout should match the mockup from the brainstorming session (see `.superpowers/brainstorm/91174-1773624040/dashboard-layout.html`).

Full implementation: ~350 lines HTML/CSS/JS. Reference `public/display.html` (593 lines) for the existing WebSocket client pattern.

**Security note:** Build viewer list and fund bars using DOM methods (`createElement`, `textContent`) rather than innerHTML to avoid XSS from any unexpected data. Only use innerHTML for static template content that doesn't include external data.

- [ ] **Step 2: Test the full manager with dashboard**

Run: `cd manager && node index.js`
Then open `http://localhost:9090/admin` in a browser.
Expected: PIN screen loads. If no PIN set in config, entering blank PIN authenticates. Dashboard shows OFFLINE state with "Start App" button.

- [ ] **Step 3: Commit**

```bash
git add manager/admin.html
git commit -m "feat(manager): add admin dashboard HTML with stats panels, controls, PIN auth"
```

---

## Chunk 2: Electron Integration

### Task 5: Add viewer tracking to HttpServer

**Files:**
- Modify: `electron/main/modules/httpserver.ts`
  - Lines 7-8: Add `ClientInfo` interface after `HttpServerConfig`
  - Lines 12-23: Replace `connectionCount` with `clientInfo` map + `peakViewers`
  - Lines 86-126: Update connection/close/error handlers
  - Lines 262-268: Add getter methods

- [ ] **Step 1: Add ClientInfo interface and tracking map**

After the `HttpServerConfig` interface (~line 7), add:
```typescript
export interface ClientInfo {
  ip: string
  lang: string | null
  connected_at: number
}
```

In the class properties (lines 12-23):
- Add: `private clientInfo: Map<WebSocket, ClientInfo> = new Map()`
- Add: `private peakViewers: number = 0`
- Remove: `private connectionCount: number = 0`

- [ ] **Step 2: Update connection/close handlers**

In the WebSocket `connection` handler (~line 86), replace `connectionCount++` with:
```typescript
const clientIp = req.socket.remoteAddress || 'unknown'
this.clientInfo.set(ws, { ip: clientIp, lang: null, connected_at: Date.now() })
if (this.clientInfo.size > this.peakViewers) {
  this.peakViewers = this.clientInfo.size
}
```

In the `subscribe` message handler (~line 105), after `this.subscriptions.set(ws, targetLang)`, add:
```typescript
const info = this.clientInfo.get(ws)
if (info) info.lang = targetLang
```

In `close` and `error` handlers, replace `this.connectionCount--` with:
```typescript
this.clientInfo.delete(ws)
```

Note: Both `close` and `error` handlers call delete — this is safe since `Map.delete` on a missing key is a no-op (error events typically fire before close).

In the `stop()` method (~line 189), replace `this.connectionCount = 0` with:
```typescript
this.clientInfo.clear()
this.peakViewers = 0
```

Update any other remaining `this.connectionCount` read references to `this.clientInfo.size`.

- [ ] **Step 3: Add getter methods**

At the bottom of the class, add:
```typescript
getClientList(): ClientInfo[] {
  return Array.from(this.clientInfo.values())
}

getPeakViewers(): number {
  return this.peakViewers
}

getConnectionCount(): number {
  return this.clientInfo.size
}
```

- [ ] **Step 4: Verify app still works**

Run: `npm run dev`
Enable HTTP server in Electron settings. Open `http://localhost:8080` — display should work as before.

- [ ] **Step 5: Commit**

```bash
git add electron/main/modules/httpserver.ts
git commit -m "feat(httpserver): add per-client tracking with IP, language, connection time, peak viewers"
```

---

### Task 6: Add counters to Pinia stores

**Files:**
- Modify: `src/stores/logs.ts` (lines ~20 state, return statement)
- Modify: `src/stores/multi_translation.ts` (lines ~153 updateTranslation, return statement)
- Modify: `src/stores/speech.ts` (line ~335, after log added)

- [ ] **Step 1: Add wordsTranscribed counter to logs store**

In `src/stores/logs.ts`, after the existing `ref` declarations (~line 20), add:
```typescript
const wordsTranscribed = ref(0)
```

Add a counter function:
```typescript
function countWords(text: string) {
  wordsTranscribed.value += text.trim().split(/\s+/).filter(Boolean).length
}
```

Add `wordsTranscribed` and `countWords` to the store's return statement.

- [ ] **Step 2: Call countWords from speech.ts**

In `src/stores/speech.ts` `on_submit()` (starts at line 288), inside the `if (log.isFinal)` block (~line 355), add after the multi-language translation dispatch:
```typescript
logsStore.countWords(log.transcript)
```

Important: Must be inside the `isFinal` check — only count finalized words, not interim results.

- [ ] **Step 3: Add translationsServed counter to multi_translation store**

In `src/stores/multi_translation.ts`, after existing `ref` declarations, add:
```typescript
const translationsServed = ref(0)
```

In `updateTranslation()` (~line 153), after updating the translation, add:
```typescript
translationsServed.value++
```

Add `translationsServed` to the store's return statement.

- [ ] **Step 4: Verify counters increment**

Run: `npm run dev`, speak a test phrase, check that transcription and translation still work.

- [ ] **Step 5: Commit**

```bash
git add src/stores/logs.ts src/stores/multi_translation.ts src/stores/speech.ts
git commit -m "feat(stores): add wordsTranscribed and translationsServed counters for admin stats"
```

---

### Task 7: Stats reporter (renderer to main IPC)

**Files:**
- Create: `src/helpers/stats_reporter.ts`
- Modify: `electron/preload/index.ts` (line ~4, send channels)
- Modify: `src/App.vue` (onMounted block)

- [ ] **Step 1: Add 'stats-update' to preload send allowlist**

In `electron/preload/index.ts`, in the `validSendChannels` array (~line 4), add `'stats-update'`.

- [ ] **Step 2: Write stats reporter**

```typescript
// src/helpers/stats_reporter.ts
import { useLogsStore } from '@/stores/logs'
import { useMultiTranslationStore } from '@/stores/multi_translation'
import { useDefaultStore } from '@/stores/default'
import is_electron from '@/helpers/is_electron'

let interval: ReturnType<typeof setInterval> | null = null

export function startStatsReporter() {
  if (!is_electron() || interval) return

  interval = setInterval(() => {
    const logsStore = useLogsStore()
    const multiStore = useMultiTranslationStore()
    const defaultStore = useDefaultStore()

    // Speech object lives on defaultStore, not speechStore
    const speech = defaultStore.speech

    const stats = {
      stt: {
        engine: speech?.constructor?.name?.toLowerCase() || 'none',
        model: 'nova-3', // Hardcoded — model is set in Deepgram connection config, not exposed as property
        listening: speech?.listening || false
      },
      translation: {
        provider: 'openai',
        languages: multiStore.enabledStreams.map((s: any) => s.name),
        queue_pending: 0
      },
      session: {
        words_transcribed: logsStore.wordsTranscribed,
        translations_served: multiStore.translationsServed
      }
    }

    window.ipcRenderer?.send('stats-update', stats)
  }, 2000)
}

export function stopStatsReporter() {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}
```

- [ ] **Step 3: Initialize in App.vue**

In `src/App.vue`, add import:
```typescript
import { startStatsReporter } from '@/helpers/stats_reporter'
```

In the `onMounted` callback, add:
```typescript
startStatsReporter()
```

- [ ] **Step 4: Commit**

```bash
git add src/helpers/stats_reporter.ts src/App.vue electron/preload/index.ts
git commit -m "feat: add renderer stats reporter — sends store state to main process via IPC every 2s"
```

---

### Task 8: Manager client (main process to manager WebSocket)

**Files:**
- Create: `electron/main/modules/manager-client.ts`
- Modify: `electron/main/index.ts` (lines ~10 imports, ~300 IPC handlers, app lifecycle)
- Modify: `electron/preload/index.ts` (on channels)

- [ ] **Step 1: Write the manager client module**

```typescript
// electron/main/modules/manager-client.ts
import WebSocket from 'ws'
import type { HttpServer } from './httpserver.js'
import type { CloudflaredManager } from './cloudflared.js'

const MANAGER_PORT = process.env.MIMIUCHI_MANAGER_PORT || '9091'
const RECONNECT_DELAY = 5000

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let sessionStartedAt = Date.now()
let rendererStats: any = {}

let httpServerRef: { get: () => HttpServer | null } = { get: () => null }
let cloudflaredRef: { get: () => CloudflaredManager | null } = { get: () => null }
let onCommand: ((cmd: any) => void) | null = null

export function initManagerClient(deps: {
  getHttpServer: () => HttpServer | null
  getCloudflared: () => CloudflaredManager | null
  handleCommand: (cmd: any) => void
}) {
  httpServerRef.get = deps.getHttpServer
  cloudflaredRef.get = deps.getCloudflared
  onCommand = deps.handleCommand
  sessionStartedAt = Date.now()
  connect()
}

function connect() {
  if (ws) return

  try {
    ws = new WebSocket('ws://127.0.0.1:' + MANAGER_PORT)
  } catch {
    scheduleReconnect()
    return
  }

  ws.on('open', () => {
    console.log('[manager-client] Connected to manager')
  })

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'command' && onCommand) {
        onCommand(msg)
      }
    } catch { /* ignore malformed */ }
  })

  ws.on('close', () => {
    console.log('[manager-client] Disconnected from manager')
    ws = null
    scheduleReconnect()
  })

  ws.on('error', () => {
    ws?.close()
    ws = null
    scheduleReconnect()
  })
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, RECONNECT_DELAY)
}

export function updateRendererStats(stats: any) {
  rendererStats = stats
  sendStats()
}

function sendStats() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return

  const httpServer = httpServerRef.get()
  const cloudflared = cloudflaredRef.get()

  const payload = {
    type: 'stats',
    viewers: {
      count: httpServer?.getConnectionCount() || 0,
      clients: httpServer?.getClientList() || []
    },
    server: {
      running: httpServer?.getIsRunning() || false,
      port: httpServer?.getPort() || 8080,
      local_url: httpServer?.getIsRunning()
        ? 'http://localhost:' + httpServer.getPort()
        : null
    },
    tunnel: cloudflared?.getStatus() || { running: false, tunnelUrl: null },
    stt: rendererStats.stt || { engine: 'none', listening: false },
    translation: rendererStats.translation || {
      provider: 'none',
      languages: [],
      queue_pending: 0
    },
    session: {
      started_at: sessionStartedAt,
      words_transcribed: rendererStats.session?.words_transcribed || 0,
      translations_served: rendererStats.session?.translations_served || 0,
      peak_viewers: httpServer?.getPeakViewers() || 0
    }
  }

  ws.send(JSON.stringify(payload))
}

export function destroyManagerClient() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (ws) ws.close()
  ws = null
}
```

- [ ] **Step 2: Wire up in electron/main/index.ts**

Add import at top:
```typescript
import { initManagerClient, updateRendererStats, destroyManagerClient } from './modules/manager-client.js'
```

After `app.whenReady()` / `createWindow()`, add:
```typescript
initManagerClient({
  getHttpServer: () => httpServer,
  getCloudflared: () => cloudflaredManager,
  handleCommand: (cmd) => {
    switch (cmd.action) {
      case 'toggle_server':
        if (cmd.enabled && !httpServer) {
          win?.webContents.send('manager-command', { action: 'toggle_server', enabled: true })
        } else if (!cmd.enabled && httpServer) {
          httpServer.stop().then(() => { httpServer = null })
        }
        break
      case 'toggle_tunnel':
        win?.webContents.send('manager-command', { action: 'toggle_tunnel', enabled: cmd.enabled })
        break
      case 'shutdown':
        app.quit()
        break
    }
  }
})
```

Add the `stats-update` IPC handler (~line 300 area, with other handlers):
```typescript
ipcMain.on('stats-update', (_event, stats) => {
  updateRendererStats(stats)
})
```

In app quit/cleanup handler, add:
```typescript
destroyManagerClient()
```

- [ ] **Step 3: Add 'manager-command' to preload on-channels**

In `electron/preload/index.ts`, in the `validOnChannels` array, add `'manager-command'`.

- [ ] **Step 4: Test end-to-end**

1. Start manager: `cd manager && node index.js`
2. Set `electron_path` in `~/.mimiuchi-manager/config.json` to mimiuchi project root
3. Start Electron: `npm run dev`
4. Open `http://localhost:9090/admin`, enter PIN
5. Expected: Dashboard shows ONLINE, stats update in real-time

- [ ] **Step 5: Commit**

```bash
git add electron/main/modules/manager-client.ts electron/main/index.ts electron/preload/index.ts
git commit -m "feat: add manager client — connects to manager, reports stats, receives commands"
```

---

## Chunk 3: Remote Commands and Deployment

### Task 9: Handle manager commands in renderer

**Files:**
- Modify: `src/App.vue` (onMounted block)

- [ ] **Step 1: Add command handler for toggle_server and toggle_tunnel**

In `src/App.vue`, in the `onMounted` block, add a listener for manager commands.

Note: The httpserver store has no `startServer`/`stopServer` methods — server control is done via IPC directly (matching existing pattern in App.vue lines 122-131).

```typescript
window.ipcRenderer?.on('manager-command', (_event: any, cmd: any) => {
  if (cmd.action === 'toggle_server') {
    const httpServerStore = useHttpServerStore()
    if (cmd.enabled) {
      window.ipcRenderer?.invoke('httpserver-start', { port: httpServerStore.port })
    } else {
      window.ipcRenderer?.invoke('httpserver-stop')
    }
  }
  if (cmd.action === 'toggle_tunnel') {
    if (cmd.enabled) {
      const httpServerStore = useHttpServerStore()
      window.ipcRenderer?.invoke('cloudflare-tunnel-start', {
        httpPort: httpServerStore.port
      })
    } else {
      window.ipcRenderer?.invoke('cloudflare-tunnel-stop')
    }
  }
})
```

Import `useHttpServerStore` if not already imported (likely already is — check existing imports in App.vue).

- [ ] **Step 2: Commit**

```bash
git add src/App.vue
git commit -m "feat: handle manager commands in renderer for remote server/tunnel control"
```

---

### Task 10: Setup script and .gitignore

**Files:**
- Create: `manager/setup.sh`
- Modify: `.gitignore`

- [ ] **Step 1: Write setup script**

```bash
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
```

- [ ] **Step 2: Make executable and update .gitignore**

Run: `chmod +x manager/setup.sh`

Add to `.gitignore`:
```
manager/node_modules/
.superpowers/
```

- [ ] **Step 3: Commit**

```bash
git add manager/setup.sh .gitignore
git commit -m "feat(manager): add setup script for launchd/systemd auto-start"
```

---

### Task 11: End-to-end verification

- [ ] **Step 1: Clean test — manager starts and serves dashboard**

```bash
pkill -f "node.*manager/index.js" || true
cd manager && npm install && cd ..
cd manager && node index.js &
sleep 2
curl -s http://localhost:9090/admin | grep -q "mimiuchi" && echo "PASS: Admin page" || echo "FAIL"
kill %1
```

- [ ] **Step 2: Full integration test**

1. Start manager: `cd manager && node index.js`
2. Configure: Set `electron_path` in `~/.mimiuchi-manager/config.json`
3. Open dashboard: `http://localhost:9090/admin`
4. Click "Start App" — Electron should launch
5. Enable HTTP server in Electron settings
6. Open `http://localhost:8080` (viewer tab)
7. Dashboard should show: 1 viewer, server ON, STT status
8. Click "Stop App" — Electron should close
9. Dashboard should show OFFLINE with last session stats

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: mimiuchi admin dashboard — complete implementation"
```
