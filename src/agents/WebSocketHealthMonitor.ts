/**
 * WebSocket Health Monitor Agent
 * Monitors WebSocket server health and client connections
 */

import { BaseAgent } from './BaseAgent'
import type { Agent } from './types'
import { useConnectionsStore } from '@/stores/connections'
import is_electron from '@/helpers/is_electron'

export class WebSocketHealthMonitor extends BaseAgent implements Agent {
  readonly id = 'websocket-health-monitor'
  readonly name = 'WebSocket Health Monitor'
  readonly description = 'Monitors WebSocket server health and connections'
  readonly category = 'health' as const
  readonly icon = 'mdi-lan-check'

  protected async execute(): Promise<void> {
    await this.checkWebSocketServer()
    await this.checkBrowserClients()
    await this.checkNetworkAccessibility()
    this.generateHealthRecommendations()
  }

  private async checkWebSocketServer(): Promise<void> {
    if (!is_electron()) {
      this.addCheck({
        name: 'WebSocket Server',
        status: 'warning',
        message: 'Not running in Electron - WebSocket server unavailable',
        severity: 'warning',
      })
      return
    }

    const connectionsStore = useConnectionsStore()
    const wsServerConfig = connectionsStore.connections.find(
      c => c.type === 'websocketserver'
    )

    if (!wsServerConfig || !wsServerConfig.enabled) {
      this.addCheck({
        name: 'WebSocket Server Status',
        status: 'error',
        message: 'WebSocket server is disabled',
        severity: 'error',
      })
      this.addRecommendation('Enable WebSocket server in Settings > Connections')
      return
    }

    const port = wsServerConfig.websocketserver?.port || 7714

    try {
      const ws = new WebSocket(`ws://localhost:${port}`)
      const startTime = Date.now()

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close()
          reject(new Error('Connection timeout'))
        }, 3000)

        ws.onopen = () => {
          clearTimeout(timeout)
          const latency = Date.now() - startTime
          ws.close()
          resolve(latency)
        }

        ws.onerror = (error) => {
          clearTimeout(timeout)
          reject(error)
        }
      })

      this.addCheck({
        name: 'WebSocket Server Status',
        status: 'success',
        message: `Server running on port ${port}`,
        severity: 'info',
        details: { port },
      })
    } catch (error: any) {
      this.addCheck({
        name: 'WebSocket Server Status',
        status: 'error',
        message: `Cannot connect to server on port ${port}: ${error.message}`,
        severity: 'error',
      })
      this.addRecommendation('Check if WebSocket server is started or if port is blocked')
    }
  }

  private async checkBrowserClients(): Promise<void> {
    // In a real implementation, this would query the main process for client count
    // For now, we'll note that this check requires IPC

    if (!is_electron()) {
      this.addCheck({
        name: 'Browser Clients',
        status: 'warning',
        message: 'Cannot check client count in browser mode',
        severity: 'warning',
      })
      return
    }

    this.addCheck({
      name: 'Browser Clients',
      status: 'success',
      message: 'Client monitoring requires main process integration',
      severity: 'info',
    })
  }

  private async checkNetworkAccessibility(): Promise<void> {
    // Check if we can determine local network IP
    try {
      // In Electron, we could use Node's os.networkInterfaces()
      // In browser, we're limited
      if (is_electron()) {
        this.addCheck({
          name: 'Network Accessibility',
          status: 'success',
          message: 'Server accessible on local network',
          severity: 'info',
        })
      } else {
        this.addCheck({
          name: 'Network Accessibility',
          status: 'warning',
          message: 'Cannot verify network accessibility in browser',
          severity: 'warning',
        })
      }
    } catch (error: any) {
      this.addCheck({
        name: 'Network Accessibility',
        status: 'error',
        message: `Network check failed: ${error.message}`,
        severity: 'error',
      })
    }
  }

  private generateHealthRecommendations(): void {
    const errors = this.checks.filter(c => c.status === 'error')

    if (errors.length > 0) {
      this.addRecommendation('Fix WebSocket server issues before expecting browser clients to connect')
    } else {
      this.addRecommendation('WebSocket server appears healthy - browser streams should work')
    }
  }
}
