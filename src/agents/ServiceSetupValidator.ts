/**
 * Service Setup Validator Agent
 * Ensures everything is ready before a church service
 */

import { BaseAgent } from './BaseAgent'
import type { Agent } from './types'
import { useSpeechStore } from '@/stores/speech'
import { useTranslationStore } from '@/stores/translation'
import { useMultiTranslationStore } from '@/stores/multi_translation'
import { useConnectionsStore } from '@/stores/connections'
import is_electron from '@/helpers/is_electron'

export class ServiceSetupValidator extends BaseAgent implements Agent {
  readonly id = 'service-setup-validator'
  readonly name = 'Service Setup Validator'
  readonly description = 'Pre-service checklist - validates all systems are ready'
  readonly category = 'health' as const
  readonly icon = 'mdi-clipboard-check'

  protected async execute(): Promise<void> {
    await Promise.all([
      this.checkMicrophoneAccess(),
      this.checkSTTConfiguration(),
      this.checkTranslationConfiguration(),
      this.checkLanguageStreams(),
      this.checkWebSocketServer(),
      this.checkNetworkConnectivity(),
    ])

    // Generate recommendations
    this.generateRecommendations()
  }

  private async checkMicrophoneAccess(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())

      this.addCheck({
        name: 'Microphone Access',
        status: 'success',
        message: 'Microphone permission granted and accessible',
        severity: 'info',
      })
    } catch (error: any) {
      this.addCheck({
        name: 'Microphone Access',
        status: 'error',
        message: `Cannot access microphone: ${error.message}`,
        severity: 'critical',
        details: { error: error.name },
      })
      this.addRecommendation('Grant microphone permission in browser/system settings')
    }
  }

  private async checkSTTConfiguration(): Promise<void> {
    const speechStore = useSpeechStore()
    const sttType = speechStore.stt.type.value

    // Check if STT is configured
    if (!sttType) {
      this.addCheck({
        name: 'STT Configuration',
        status: 'error',
        message: 'No STT provider selected',
        severity: 'critical',
      })
      this.addRecommendation('Select an STT provider in Settings > STT')
      return
    }

    // Check API keys for cloud providers
    if (sttType === 'deepgram') {
      const apiKey = speechStore.stt.deepgramApiKey
      if (!apiKey || apiKey.length === 0) {
        this.addCheck({
          name: 'Deepgram API Key',
          status: 'error',
          message: 'Deepgram API key not configured',
          severity: 'critical',
        })
        this.addRecommendation('Add Deepgram API key in Settings > STT')
      } else {
        this.addCheck({
          name: 'Deepgram API Key',
          status: 'success',
          message: 'Deepgram API key configured',
          severity: 'info',
        })
      }
    } else if (sttType === 'whisper') {
      const apiKey = speechStore.stt.whisperApiKey
      if (!apiKey || apiKey.length === 0) {
        this.addCheck({
          name: 'Whisper API Key',
          status: 'error',
          message: 'OpenAI API key not configured for Whisper',
          severity: 'critical',
        })
        this.addRecommendation('Add OpenAI API key in Settings > STT')
      } else {
        this.addCheck({
          name: 'Whisper API Key',
          status: 'success',
          message: 'OpenAI API key configured for Whisper',
          severity: 'info',
        })
      }
    } else if (sttType === 'webspeech') {
      this.addCheck({
        name: 'Web Speech API',
        status: 'success',
        message: 'Using browser built-in speech recognition (free)',
        severity: 'info',
      })
    }
  }

  private async checkTranslationConfiguration(): Promise<void> {
    const translationStore = useTranslationStore()

    if (!translationStore.enabled) {
      this.addCheck({
        name: 'Translation',
        status: 'warning',
        message: 'Translation is disabled',
        severity: 'warning',
      })
      this.addRecommendation('Enable translation in Settings > Translation if needed')
      return
    }

    // Check OpenAI API key for translation
    const apiKey = translationStore.openai_api_key
    if (!apiKey || apiKey.length === 0) {
      this.addCheck({
        name: 'Translation API Key',
        status: 'error',
        message: 'OpenAI API key not configured for translation',
        severity: 'error',
      })
      this.addRecommendation('Add OpenAI API key in Settings > Translation')
    } else if (apiKey.startsWith('sk-')) {
      this.addCheck({
        name: 'Translation API Key',
        status: 'success',
        message: 'Translation API key configured',
        severity: 'info',
      })
    } else {
      this.addCheck({
        name: 'Translation API Key',
        status: 'warning',
        message: 'API key format looks incorrect (should start with sk-)',
        severity: 'warning',
      })
      this.addRecommendation('Verify OpenAI API key is correct')
    }
  }

  private async checkLanguageStreams(): Promise<void> {
    const multiTranslationStore = useMultiTranslationStore()
    const enabledStreams = multiTranslationStore.enabledStreams

    if (enabledStreams.length === 0) {
      this.addCheck({
        name: 'Language Streams',
        status: 'warning',
        message: 'No language streams enabled',
        severity: 'warning',
      })
      this.addRecommendation('Enable language streams in Settings > Multi-Language if needed')
    } else {
      this.addCheck({
        name: 'Language Streams',
        status: 'success',
        message: `${enabledStreams.length} language stream(s) enabled: ${enabledStreams.map(s => s.name).join(', ')}`,
        severity: 'info',
        details: { streams: enabledStreams },
      })

      // Warn about cost if many languages enabled
      if (enabledStreams.length > 3) {
        this.addRecommendation(`You have ${enabledStreams.length} languages enabled - this will increase API costs`)
      }
    }
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
        name: 'WebSocket Server',
        status: 'warning',
        message: 'WebSocket server is disabled',
        severity: 'warning',
      })
      this.addRecommendation('Enable WebSocket server in Settings > Connections for browser streams')
      return
    }

    const port = wsServerConfig.websocketserver?.port || 7714

    try {
      // Try to connect to WebSocket server
      const ws = new WebSocket(`ws://localhost:${port}`)

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close()
          reject(new Error('Connection timeout'))
        }, 3000)

        ws.onopen = () => {
          clearTimeout(timeout)
          ws.close()
          resolve(true)
        }

        ws.onerror = (error) => {
          clearTimeout(timeout)
          reject(error)
        }
      })

      this.addCheck({
        name: 'WebSocket Server',
        status: 'success',
        message: `WebSocket server running on port ${port}`,
        severity: 'info',
        details: { port },
      })
    } catch (error: any) {
      this.addCheck({
        name: 'WebSocket Server',
        status: 'error',
        message: `Cannot connect to WebSocket server on port ${port}`,
        severity: 'error',
        details: { port, error: error.message },
      })
      this.addRecommendation('Start the WebSocket server or check if port is already in use')
    }
  }

  private async checkNetworkConnectivity(): Promise<void> {
    // Check if we can reach common APIs
    const checks = []

    // Check OpenAI API
    checks.push(
      this.checkApiConnection(
        'https://api.openai.com',
        'OpenAI API',
        {}
      )
    )

    // Check Deepgram API
    checks.push(
      this.checkApiConnection(
        'https://api.deepgram.com',
        'Deepgram API',
        {}
      )
    )

    await Promise.all(checks)
  }

  private generateRecommendations(): void {
    const errors = this.checks.filter(c => c.status === 'error')
    const warnings = this.checks.filter(c => c.status === 'warning')

    if (errors.length > 0) {
      this.addRecommendation(`⚠️ Fix ${errors.length} critical issue(s) before starting service`)
    }

    if (warnings.length > 0 && errors.length === 0) {
      this.addRecommendation(`✓ System is functional but has ${warnings.length} warning(s)`)
    }

    if (errors.length === 0 && warnings.length === 0) {
      this.addRecommendation('✅ All systems ready! You can start the service')
    }
  }
}
