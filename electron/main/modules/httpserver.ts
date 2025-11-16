import * as http from 'node:http'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { WebSocketServer, WebSocket } from 'ws'

interface HttpServerConfig {
  port: number
  publicPath: string
}

class HttpServer {
  private server: http.Server | null = null
  private wss: WebSocketServer | null = null
  private port: number
  private publicPath: string
  private isRunning: boolean = false
  // Track language subscriptions per WebSocket connection
  private subscriptions: Map<WebSocket, string | null> = new Map()

  constructor(config: HttpServerConfig) {
    this.port = config.port
    this.publicPath = config.publicPath
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        reject(new Error('Server is already running'))
        return
      }

      // Create HTTP server
      this.server = http.createServer((req, res) => {
        // Serve display.html for all requests
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
      })

      // Create WebSocket server attached to HTTP server
      this.wss = new WebSocketServer({ server: this.server })

      this.wss.on('connection', (ws) => {
        console.log('Display client connected via WebSocket')

        // Initialize with no language filter (show all by default)
        this.subscriptions.set(ws, null)

        // Handle incoming messages for subscription
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString())
            if (message.type === 'subscribe' && message.targetLang) {
              console.log(`Client subscribed to language: ${message.targetLang}`)
              this.subscriptions.set(ws, message.targetLang)
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        })

        ws.on('close', () => {
          console.log('Display client disconnected')
          // Clean up subscription tracking
          this.subscriptions.delete(ws)
        })

        ws.on('error', (error) => {
          console.error('WebSocket error:', error)
        })
      })

      // Start listening
      this.server.listen(this.port, () => {
        this.isRunning = true
        console.log(`HTTP server running on http://localhost:${this.port}`)
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

      // Close WebSocket server first
      if (this.wss) {
        this.wss.close(() => {
          console.log('WebSocket server closed')
        })
      }

      // Close HTTP server
      this.server.close((err) => {
        if (err) {
          reject(err)
          return
        }

        this.isRunning = false
        this.server = null
        this.wss = null
        console.log('HTTP server stopped')
        resolve()
      })
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
      console.error('Error parsing broadcast message:', error)
    }

    let sentCount = 0
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        const subscribedLang = this.subscriptions.get(client)

        // If client has no subscription (null), send everything (backward compatibility)
        if (subscribedLang === null || subscribedLang === undefined) {
          client.send(message)
          sentCount++
        }
        // If message has targetLang, only send to clients subscribed to that language
        else if (messageData && messageData.targetLang) {
          if (messageData.targetLang === subscribedLang) {
            console.log(`[HTTPServer] Sending message to client subscribed to ${subscribedLang}`)
            client.send(message)
            sentCount++
          }
        }
        // If message has no targetLang, it's the "all" broadcast
        else {
          client.send(message)
          sentCount++
        }
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
}

export { HttpServer, HttpServerConfig }
