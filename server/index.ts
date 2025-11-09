/**
 * Standalone server for Docker deployment
 * Runs mimiuchi without Electron - serves static files and handles WebSocket
 */

import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { Worker } from 'node:worker_threads'
import { WebSocket, WebSocketServer } from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const WS_PORT = process.env.WS_PORT || 7714
const DIST_DIR = path.join(__dirname, '../dist')

// Translation worker setup
const WORKER_PATH = path.join(__dirname, '../dist-electron/main/worker/translation.js')
let translationWorker: Worker | null = null

function getTranslationWorker(): Worker {
  if (!translationWorker) {
    console.log('[Server] Initializing translation worker...')
    translationWorker = new Worker(WORKER_PATH)

    translationWorker.on('message', (message) => {
      console.log('[Server] Translation result:', message.status)

      // Broadcast to all WebSocket clients
      if (wsServer && message.status === 'complete') {
        const payload = JSON.stringify({
          type: 'translation',
          data: message
        })

        let sentCount = 0
        wsServer.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload)
            sentCount++
          }
        })
        console.log(`[Server] Broadcasted translation to ${sentCount} clients`)
      }
    })

    translationWorker.on('error', (error) => {
      console.error('[Server] Translation worker error:', error)
      translationWorker = null
      setTimeout(() => {
        console.log('[Server] Restarting translation worker...')
        getTranslationWorker()
      }, 1000)
    })

    translationWorker.on('exit', (code) => {
      console.warn('[Server] Translation worker exited with code:', code)
      if (code !== 0) {
        translationWorker = null
      }
    })
  }

  return translationWorker
}

// WebSocket server for real-time translation broadcasting
let wsServer: WebSocketServer | null = null

function startWebSocketServer() {
  wsServer = new WebSocketServer({ port: Number(WS_PORT), host: '0.0.0.0' })

  wsServer.on('error', (error) => {
    console.error('[Server] WebSocket error:', error)
  })

  wsServer.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress
    console.log(`[Server] WebSocket client connected: ${ip}`)

    ws.on('close', (code, reason) => {
      console.log(`[Server] WebSocket client disconnected: ${ip} (${code})`)
    })

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        console.log(`[Server] WebSocket message: ${message.type}`)

        if (message.type === 'translate') {
          // Handle translation request from browser client
          const worker = getTranslationWorker()
          worker.postMessage({
            type: 'transformers-translate-multi',
            data: message.data
          })
        } else if (message.type === 'set-api-key') {
          // Handle API key setup
          const worker = getTranslationWorker()
          worker.postMessage({
            type: 'set-api-key',
            apiKey: message.apiKey
          })
        }
      } catch (error) {
        console.error('[Server] Error processing WebSocket message:', error)
      }
    })
  })

  console.log(`[Server] WebSocket server listening on port ${WS_PORT}`)
}

// HTTP server for serving static files
const server = createServer((req, res) => {
  // Determine file path
  let filePath = req.url === '/' ? '/index.html' : req.url

  // Remove query string
  const queryIndex = filePath.indexOf('?')
  if (queryIndex > -1) {
    filePath = filePath.substring(0, queryIndex)
  }

  // Remove hash
  const hashIndex = filePath.indexOf('#')
  if (hashIndex > -1) {
    filePath = filePath.substring(0, hashIndex)
  }

  const fullPath = path.join(DIST_DIR, filePath)

  // Security: prevent directory traversal
  if (!fullPath.startsWith(DIST_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  // Check if file exists
  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // For SPA routing, serve index.html for non-existent routes
      const indexPath = path.join(DIST_DIR, 'index.html')
      fs.readFile(indexPath, (err, data) => {
        if (err) {
          res.writeHead(500)
          res.end('Error loading index.html')
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(data)
      })
      return
    }

    // Serve file
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(500)
        res.end('Error reading file')
        return
      }

      // Set content type based on file extension
      const ext = path.extname(fullPath).toLowerCase()
      const contentTypes: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject',
      }

      const contentType = contentTypes[ext] || 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(data)
    })
  })
})

// Start servers
server.listen(PORT, () => {
  console.log(`[Server] HTTP server listening on port ${PORT}`)
  console.log(`[Server] Serving files from: ${DIST_DIR}`)
  console.log(`[Server] Access the app at: http://localhost:${PORT}`)
})

startWebSocketServer()

// Initialize translation worker on startup
getTranslationWorker()

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...')
  server.close(() => {
    console.log('[Server] HTTP server closed')
  })
  wsServer?.close(() => {
    console.log('[Server] WebSocket server closed')
  })
  translationWorker?.terminate()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully...')
  server.close(() => {
    console.log('[Server] HTTP server closed')
  })
  wsServer?.close(() => {
    console.log('[Server] WebSocket server closed')
  })
  translationWorker?.terminate()
  process.exit(0)
})
