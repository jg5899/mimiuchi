declare const window: any

// Configuration constants
const DEEPGRAM_CONFIG = {
  ENDPOINTING_MS: 500,         // 500ms silence = finalize phrase (happy medium: snappier than 800 but less mid-sentence chopping than the old 300)
  BUFFER_SIZE: 2048,           // Smaller buffer = lower latency audio capture
  SAMPLE_RATE: 48000,         // Audio sample rate in Hz (wideband — nova-3 accuracy beats the old 16k telephone band)
  MIN_BACKOFF_MS: 1000,       // Minimum reconnection delay
  MAX_BACKOFF_MS: 16000,      // Maximum reconnection delay
  MAX_RECONNECT_ATTEMPTS: 5,  // Maximum WebSocket reconnection attempts
} as const

// No keywords - let Nova-3 work naturally for best speed/accuracy
const BIBLICAL_VOCABULARY: string[] = []

class Deepgram {
  stream_ref: MediaStream | null = null
  listening: boolean = false
  isRecording: boolean = false
  apiKey: string = ''
  language: string = 'en'
  recognition: boolean = true
  last_error: string = ''
  try_restart_interval: any = null
  customKeywords: string[] = []

  // WebSocket for real-time streaming
  socket: WebSocket | null = null
  audioContext: AudioContext | null = null
  processor: ScriptProcessorNode | null = null

  // Reconnection management
  isReconnecting: boolean = false
  reconnectAttempts: number = 0
  lastInterimTranscript: string = '' // Track last interim for UtteranceEnd finalization

  onresult: Function = () => {}
  onend: Function = () => {}
  onerror: Function = () => {}
  onstart: Function = () => {}

  constructor(lang: string = 'en-US', apiKey: string = '', customKeywords: string[] = []) {
    this.apiKey = apiKey
    this.language = lang.split('-')[0] // e.g., 'en-US' -> 'en'
    this.customKeywords = customKeywords
  }

  private cleanupAudioStream() {
    if (this.processor) {
      this.processor.disconnect()
      this.processor.onaudioprocess = null
      this.processor = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }

  private cleanupWebSocket() {
    if (this.socket) {
      this.socket.onclose = null
      this.socket.onerror = null
      this.socket.onmessage = null
      this.socket.onopen = null
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'CloseStream' }))
      }
      this.socket.close()
      this.socket = null
    }
  }

  async start() {
    if (!this.apiKey) {
      this.onerror({ error: 'no-api-key', message: 'Deepgram API key not configured' })
      return
    }

    this.listening = true
    this.reconnectAttempts = 0

    try {
      // Get microphone stream
      if (!this.stream_ref) {
        this.stream_ref = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: DEEPGRAM_CONFIG.SAMPLE_RATE,
          },
        })
      }

      // Connect WebSocket (audio streaming starts in onopen callback)
      this.connectWebSocket()

      this.isRecording = true
      this.onstart()
    }
    catch (error: any) {
      console.error('Deepgram start error:', error)
      this.onerror({ error: 'audio-capture', message: error.message })
      this.listening = false
    }
  }

  connectWebSocket() {
    // Cleanup any existing WebSocket before creating a new one to prevent duplicates
    this.cleanupWebSocket()

    // Construct WebSocket URL with Deepgram parameters
    const params = new URLSearchParams({
      model: 'nova-3',
      language: this.language,
      interim_results: 'true',
      smart_format: 'true', // Deepgram-recommended formatting (punctuation, numbers, dates) — replaces raw numerals
      endpointing: String(DEEPGRAM_CONFIG.ENDPOINTING_MS),
      utterance_end_ms: '1200', // Force-finalize after 1.2s silence as safety net (matches the 500ms endpointing middle ground)
      encoding: 'linear16',
      sample_rate: String(DEEPGRAM_CONFIG.SAMPLE_RATE),
      profanity_filter: 'false', // We handle this ourselves with church context
    })

    // Nova-3 uses keyterm prompting instead of keywords — smarter, contextual matching
    const allKeywords = [...BIBLICAL_VOCABULARY, ...this.customKeywords]
    const uniqueKeywords = [...new Set(allKeywords)]
    for (const term of uniqueKeywords) {
      params.append('keyterm', term)
    }

    const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`

    this.socket = new WebSocket(wsUrl, ['token', this.apiKey])

    this.socket.onopen = () => {
      console.log('Deepgram WebSocket connected')
      this.startAudioStream()
    }

    this.socket.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data)

        if (data.type === 'Results') {
          const transcript = data.channel?.alternatives?.[0]?.transcript
          const isFinal = data.is_final || false

          console.log(`[Deepgram] ${isFinal ? 'FINAL' : 'interim'}: "${transcript?.substring(0, 50)}"`)

          if (transcript && transcript.trim()) {
            if (!isFinal) {
              this.lastInterimTranscript = transcript
            } else {
              this.lastInterimTranscript = ''
            }
            this.onresult(transcript, isFinal)
          }
        }
        else if (data.type === 'UtteranceEnd') {
          // Deepgram detected end of speech — finalize any pending interim
          if (this.lastInterimTranscript) {
            this.onresult(this.lastInterimTranscript, true)
            this.lastInterimTranscript = ''
          }
        }
        else if (data.type === 'Metadata') {
          console.log('Deepgram metadata:', data)
        }
      }
      catch (error) {
        console.error('Error parsing Deepgram message:', error)
      }
    }

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.onerror({ error: 'websocket', message: 'WebSocket connection error' })
    }

    this.socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason)

      // Cleanup audio stream before reconnecting
      this.cleanupAudioStream()

      if (this.listening && !this.isReconnecting) {
        // Check if we've exceeded max reconnection attempts
        if (this.reconnectAttempts >= DEEPGRAM_CONFIG.MAX_RECONNECT_ATTEMPTS) {
          console.error('Max reconnection attempts reached')
          this.onerror({ error: 'max-reconnect', message: 'Maximum reconnection attempts exceeded' })
          this.listening = false
          return
        }

        // Set reconnecting flag IMMEDIATELY to prevent simultaneous reconnections
        this.isReconnecting = true
        this.reconnectAttempts++

        // Exponential backoff with configurable limits
        const backoffDelay = Math.min(
          DEEPGRAM_CONFIG.MIN_BACKOFF_MS * Math.pow(2, this.reconnectAttempts - 1),
          DEEPGRAM_CONFIG.MAX_BACKOFF_MS
        )

        console.log(`Reconnecting in ${backoffDelay}ms (attempt ${this.reconnectAttempts}/${DEEPGRAM_CONFIG.MAX_RECONNECT_ATTEMPTS})`)

        setTimeout(() => {
          if (this.listening) {
            this.connectWebSocket() // startAudioStream() called in onopen
          }
          // Reset flag AFTER reconnection attempt
          this.isReconnecting = false
        }, backoffDelay)
      }
    }
  }

  startAudioStream() {
    if (!this.stream_ref || !this.socket) return

    // Always cleanup existing audio stream before creating a new one to prevent duplicates
    this.cleanupAudioStream()

    this.audioContext = new AudioContext({ sampleRate: DEEPGRAM_CONFIG.SAMPLE_RATE })
    const source = this.audioContext.createMediaStreamSource(this.stream_ref)
    // Note: ScriptProcessorNode is deprecated but still works. TODO: Migrate to AudioWorklet
    this.processor = this.audioContext.createScriptProcessor(DEEPGRAM_CONFIG.BUFFER_SIZE, 1, 1)

    source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)

    this.processor.onaudioprocess = (event) => {
      if (!this.listening || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return
      }

      const inputData = event.inputBuffer.getChannelData(0)

      // Convert Float32Array to Int16Array (PCM16 for Deepgram)
      const pcm16 = new Int16Array(inputData.length)
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]))
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }

      // Send raw PCM16 binary data
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(pcm16.buffer)
      }
    }
  }

  stop() {
    this.listening = false
    this.isReconnecting = false

    // Clear any pending restart interval
    if (this.try_restart_interval) {
      clearTimeout(this.try_restart_interval)
      this.try_restart_interval = null
    }

    this.cleanupAudioStream()
    this.cleanupWebSocket()

    if (this.stream_ref) {
      this.stream_ref.getTracks().forEach(track => track.stop())
      this.stream_ref = null
    }

    this.isRecording = false
    this.onend()
  }

  speak(input: string) {
    // TTS not supported with Deepgram
  }
}

export { Deepgram }
