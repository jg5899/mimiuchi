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
