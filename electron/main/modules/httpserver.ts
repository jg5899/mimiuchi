import * as http from 'node:http'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { WebSocketServer, WebSocket } from 'ws'

interface HttpServerConfig {
  port: number
  publicPath: string
}

interface ClientInfo {
  ip: string
  lang: string | null
  connected_at: number
}

class HttpServer {
  private server: http.Server | null = null
  private wss: WebSocketServer | null = null
  private port: number
  private publicPath: string
  private isRunning: boolean = false
  // Track language subscriptions per WebSocket connection
  private subscriptions: Map<WebSocket, string | null> = new Map()
  // Cache display.html to avoid reading from disk on every request
  private cachedDisplayHtml: Buffer | null = null
  // Connection tracking
  private readonly MAX_CONNECTIONS: number = 50
  private clientInfo: Map<WebSocket, ClientInfo> = new Map()
  private peakViewers: number = 0

  constructor(config: HttpServerConfig) {
    this.port = config.port
    this.publicPath = config.publicPath

    // Cache display.html on construction
    try {
      const filePath = path.join(this.publicPath, 'display.html')
      this.cachedDisplayHtml = fs.readFileSync(filePath)
      console.log('[HTTPServer] Cached display.html file')
    } catch (error) {
      console.error('[HTTPServer] Failed to cache display.html:', error)
    }
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        reject(new Error('Server is already running'))
        return
      }

      // Create HTTP server with cached file serving
      this.server = http.createServer((req, res) => {
        // Serve cached display.html for all requests
        if (this.cachedDisplayHtml) {
          res.writeHead(200, {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache',
          })
          res.end(this.cachedDisplayHtml)
        } else {
          // Fallback to reading from disk if cache failed
          const filePath = path.join(this.publicPath, 'display.html')
          fs.readFile(filePath, (err, data) => {
            if (err) {
              res.writeHead(404, { 'Content-Type': 'text/plain' })
              res.end('404 Not Found')
              return
            }
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(data)
          })
        }
      })

      // Create WebSocket server with compression enabled
      this.wss = new WebSocketServer({
        server: this.server,
        perMessageDeflate: {
          zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3,
          },
          zlibInflateOptions: {
            chunkSize: 10 * 1024,
          },
          threshold: 1024, // Only compress messages larger than 1KB
        },
      })

      this.wss.on('connection', (ws, req) => {
        // Check connection limit
        if (this.clientInfo.size >= this.MAX_CONNECTIONS) {
          console.warn('[HTTPServer] Max connections reached, rejecting client')
          ws.close(1008, 'Server at capacity')
          return
        }

        const clientIp = req.socket.remoteAddress || 'unknown'
        this.clientInfo.set(ws, { ip: clientIp, lang: null, connected_at: Date.now() })
        if (this.clientInfo.size > this.peakViewers) {
          this.peakViewers = this.clientInfo.size
        }
        console.log(`[HTTPServer] Display client connected (${this.clientInfo.size}/${this.MAX_CONNECTIONS}) from ${clientIp}`)

        // Initialize with no language filter (show all by default)
        this.subscriptions.set(ws, null)

        // Handle incoming messages for subscription
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString())
            if (message.type === 'subscribe' && message.targetLang) {
              console.log(`[HTTPServer] Client subscribed to language: ${message.targetLang}`)
              this.subscriptions.set(ws, message.targetLang)
              const info = this.clientInfo.get(ws)
              if (info) info.lang = message.targetLang
            }
          } catch (error) {
            console.error('[HTTPServer] Error parsing WebSocket message:', error)
          }
        })

        ws.on('close', () => {
          this.clientInfo.delete(ws)
          console.log(`[HTTPServer] Display client disconnected (${this.clientInfo.size}/${this.MAX_CONNECTIONS})`)
          this.subscriptions.delete(ws)
        })

        ws.on('error', (error) => {
          console.error('[HTTPServer] WebSocket error:', error)
          this.clientInfo.delete(ws)
          this.subscriptions.delete(ws)
        })

        // Set up ping/pong to detect dead connections
        const pingInterval = setInterval(() => {
          if (ws.readyState === 1) { // WebSocket.OPEN
            ws.ping()
          }
        }, 30000) // Ping every 30 seconds

        ws.on('close', () => {
          clearInterval(pingInterval)
        })
      })

      // Start listening on all network interfaces (0.0.0.0)
      this.server.listen(this.port, '0.0.0.0', () => {
        this.isRunning = true
        console.log(`HTTP server running on http://0.0.0.0:${this.port}`)
        resolve()
      })

      this.server.on('error', (error) => {
        console.error('HTTP server error:', error)
        reject(error)
      })
    })
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isRunning || !this.server) {
        resolve()
        return
      }

      // Close WebSocket server first and wait for completion
      const closeWebSocket = new Promise<void>((wsResolve) => {
        if (this.wss) {
          this.wss.close(() => {
            console.log('[HTTPServer] WebSocket server closed')
            wsResolve()
          })
        } else {
          wsResolve()
        }
      })

      // After WebSocket closes, close HTTP server
      closeWebSocket.then(() => {
        if (!this.server) {
          resolve()
          return
        }

        this.server.close((err) => {
          if (err) {
            reject(err)
            return
          }

          this.isRunning = false
          this.server = null
          this.wss = null
          this.clientInfo.clear()
          this.peakViewers = 0
          this.subscriptions.clear()
          console.log('[HTTPServer] HTTP server stopped')
          resolve()
        })
      }).catch(reject)
    })
  }

  broadcast(message: string): void {
    if (!this.wss) return

    // Parse the message to check if it has a targetLang
    let messageData: any = null
    try {
      const parsed = JSON.parse(message)
      if (parsed.type === 'text' && parsed.data) {
        messageData = parsed.data
      }
    } catch (error) {
      // If parsing fails, broadcast to all (old format)
      console.error('[HTTPServer] Error parsing broadcast message:', error)
    }

    let sentCount = 0
    const deadConnections: WebSocket[] = []

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        const subscribedLang = this.subscriptions.get(client)
        let shouldSend = false

        // Determine if we should send to this client
        if (subscribedLang === null || subscribedLang === undefined) {
          // No subscription - send everything (backward compatibility)
          shouldSend = true
        } else if (messageData && messageData.targetLang) {
          // Message has target language - only send to matching subscribers
          shouldSend = messageData.targetLang === subscribedLang
        } else {
          // Message has no targetLang (English transcript) - DON'T send to language-specific subscribers
          // They only want their specific language translations, not English
          shouldSend = false
        }

        if (shouldSend) {
          try {
            client.send(message)
            sentCount++
          } catch (error) {
            console.error('[HTTPServer] Error sending to client:', error)
            // Mark for cleanup
            deadConnections.push(client)
          }
        }
      }
    })

    // Clean up dead connections
    deadConnections.forEach((client) => {
      this.subscriptions.delete(client)
      try {
        client.terminate()
      } catch (e) {
        // Ignore termination errors
      }
    })

    if (messageData?.targetLang) {
      console.log(`[HTTPServer] Broadcast complete for ${messageData.targetLang}: sent to ${sentCount} clients`)
    }
  }

  getPort(): number {
    return this.port
  }

  getIsRunning(): boolean {
    return this.isRunning
  }

  getClientList(): ClientInfo[] {
    return Array.from(this.clientInfo.values())
  }

  getPeakViewers(): number {
    return this.peakViewers
  }

  getConnectionCount(): number {
    return this.clientInfo.size
  }
}

export { HttpServer, HttpServerConfig, ClientInfo }
