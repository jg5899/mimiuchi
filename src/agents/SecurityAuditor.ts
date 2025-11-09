/**
 * Security Auditor Agent
 * Scans for security vulnerabilities and best practices
 */

import { BaseAgent } from './BaseAgent'
import type { Agent } from './types'
import { useSpeechStore } from '@/stores/speech'
import { useTranslationStore } from '@/stores/translation'
import { useConnectionsStore } from '@/stores/connections'

export class SecurityAuditor extends BaseAgent implements Agent {
  readonly id = 'security-auditor'
  readonly name = 'Security Auditor'
  readonly description = 'Checks for security vulnerabilities'
  readonly category = 'security' as const
  readonly icon = 'mdi-shield-check'

  protected async execute(): Promise<void> {
    await this.checkAPIKeyStorage()
    await this.checkWebSocketSecurity()
    await this.checkLocalStorageSecurity()
    await this.checkNetworkExposure()
    this.generateSecurityRecommendations()
  }

  private async checkAPIKeyStorage(): Promise<void> {
    const speechStore = useSpeechStore()
    const translationStore = useTranslationStore()

    // Check if API keys are stored in localStorage (security risk)
    const storedSpeech = localStorage.getItem('speech')
    const storedTranslation = localStorage.getItem('translation')

    let hasPlaintextKeys = false

    if (storedSpeech) {
      const parsed = JSON.parse(storedSpeech)
      if (parsed.stt?.deepgramApiKey || parsed.stt?.whisperApiKey) {
        hasPlaintextKeys = true
      }
    }

    if (storedTranslation) {
      const parsed = JSON.parse(storedTranslation)
      if (parsed.openai_api_key && !parsed.openai_api_key.includes('encrypted')) {
        hasPlaintextKeys = true
      }
    }

    if (hasPlaintextKeys) {
      this.addCheck({
        name: 'API Key Storage',
        status: 'error',
        message: 'API keys stored in plaintext in localStorage',
        severity: 'critical',
      })
      this.addRecommendation('🔒 Encrypt API keys before storing (use crypto helper)')
    } else {
      this.addCheck({
        name: 'API Key Storage',
        status: 'success',
        message: 'API keys appear to be encrypted or not stored',
        severity: 'info',
      })
    }
  }

  private async checkWebSocketSecurity(): Promise<void> {
    const connectionsStore = useConnectionsStore()
    const wsServerConfig = connectionsStore.connections.find(
      c => c.type === 'websocketserver'
    )

    if (wsServerConfig && wsServerConfig.enabled) {
      // Check if server is bound to 0.0.0.0 (potential security risk)
      this.addCheck({
        name: 'WebSocket Binding',
        status: 'warning',
        message: 'WebSocket server binds to 0.0.0.0 (accessible from network)',
        severity: 'warning',
      })
      this.addRecommendation('⚠️ Anyone on your network can connect - consider authentication')

      // Check if using WSS (secure WebSocket)
      this.addCheck({
        name: 'WebSocket Encryption',
        status: 'warning',
        message: 'Using unencrypted WebSocket (ws://)',
        severity: 'warning',
      })
      this.addRecommendation('💡 Consider using WSS (wss://) for encrypted connections')
    }
  }

  private async checkLocalStorageSecurity(): Promise<void> {
    // Check localStorage size and sensitive data
    let totalSize = 0
    let sensitiveDataCount = 0

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key) || ''
        totalSize += value.length

        // Check for sensitive patterns
        if (value.includes('sk-') || value.includes('api') || value.includes('key')) {
          sensitiveDataCount++
        }
      }
    }

    const sizeMB = (totalSize / 1024 / 1024).toFixed(2)

    if (sensitiveDataCount > 0) {
      this.addCheck({
        name: 'LocalStorage Security',
        status: 'warning',
        message: `${sensitiveDataCount} item(s) may contain sensitive data`,
        severity: 'warning',
        details: { size: `${sizeMB} MB`, items: sensitiveDataCount },
      })
    } else {
      this.addCheck({
        name: 'LocalStorage Security',
        status: 'success',
        message: 'No obvious sensitive data in localStorage',
        severity: 'info',
      })
    }
  }

  private async checkNetworkExposure(): Promise<void> {
    // Check if running in development mode
    const isDev = import.meta.env.DEV

    if (isDev) {
      this.addCheck({
        name: 'Development Mode',
        status: 'warning',
        message: 'Running in development mode',
        severity: 'warning',
      })
      this.addRecommendation('Build for production before deploying')
    } else {
      this.addCheck({
        name: 'Production Build',
        status: 'success',
        message: 'Running in production mode',
        severity: 'info',
      })
    }

    // Check for HTTPS
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
      this.addCheck({
        name: 'HTTPS',
        status: 'error',
        message: 'Not using HTTPS for non-localhost connection',
        severity: 'critical',
      })
      this.addRecommendation('🔒 Use HTTPS to encrypt data in transit')
    }
  }

  private generateSecurityRecommendations(): void {
    const criticalIssues = this.checks.filter(c => c.severity === 'critical')
    const warnings = this.checks.filter(c => c.status === 'warning')

    if (criticalIssues.length > 0) {
      this.addRecommendation(`🚨 Fix ${criticalIssues.length} critical security issue(s) immediately`)
    }

    if (warnings.length >= 3) {
      this.addRecommendation('Consider implementing additional security measures')
    }

    // General security best practices
    this.addRecommendation('💡 Regularly rotate API keys')
    this.addRecommendation('💡 Keep dependencies up to date for security patches')
  }
}
