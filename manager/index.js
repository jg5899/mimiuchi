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
