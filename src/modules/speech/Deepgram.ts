declare const window: any

// Configuration constants
const DEEPGRAM_CONFIG = {
  ENDPOINTING_MS: 300,         // 300ms silence = finalize phrase (allows interims to flow)
  BUFFER_SIZE: 2048,           // Smaller buffer = lower latency audio capture
  SAMPLE_RATE: 16000,         // Audio sample rate in Hz
  MIN_BACKOFF_MS: 1000,       // Minimum reconnection delay
  MAX_BACKOFF_MS: 16000,      // Maximum reconnection delay
  MAX_RECONNECT_ATTEMPTS: 5,  // Maximum WebSocket reconnection attempts
} as const

// Deepgram Nova-3 keyterm prompting: a CONSERVATIVE, curated list of distinctive,
// frequently-spoken biblical proper nouns + theological terms that general ASR mishears
// (e.g. "Habakkuk" -> "have a look"). Kept tight (~35) and limited to multi-syllable,
// distinctive words to minimize Deepgram's known force-fitting/overfitting pathology
// (which worsens past ~50 terms). Common short names (John, Mark, Paul) are intentionally
// omitted — Nova-3 already recognizes them and they collide with everyday speech.
// Per-speaker custom vocabulary is appended to this base list at connect time.
const BIBLICAL_VOCABULARY: string[] = [
  // Book / epistle names that are distinctive and commonly misrecognized
  'Habakkuk', 'Thessalonians', 'Corinthians', 'Ephesians', 'Philippians', 'Colossians',
  'Galatians', 'Deuteronomy', 'Leviticus', 'Ezekiel', 'Nehemiah', 'Zephaniah', 'Haggai',
  'Zechariah', 'Malachi', 'Philemon', 'Lamentations', 'Ecclesiastes', 'Obadiah', 'Hosea',
  // People / places
  'Pharisees', 'Sadducees', 'Gentiles', 'Messiah', 'Gethsemane', 'Capernaum', 'Nazareth',
  // Theological terms
  'righteousness', 'sanctification', 'justification', 'propitiation', 'redemption',
  'atonement', 'repentance', 'Pentecost',
]

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
  inputDeviceId: string = '' // '' = OS default input device

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

  constructor(lang: string = 'en-US', apiKey: string = '', customKeywords: string[] = [], inputDeviceId: string = '') {
    this.apiKey = apiKey
    this.language = lang.split('-')[0] // e.g., 'en-US' -> 'en'
    this.customKeywords = customKeywords
    this.inputDeviceId = inputDeviceId
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
      // Get microphone stream. Use the explicitly-selected input device when set;
      // otherwise the OS default (which in AV booths may be a silent virtual device).
      if (!this.stream_ref) {
        const audioConstraints: MediaTrackConstraints = {
          channelCount: 1,
          sampleRate: 16000,
        }
        if (this.inputDeviceId)
          audioConstraints.deviceId = { exact: this.inputDeviceId }

        this.stream_ref = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
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
      punctuate: 'true',
      endpointing: String(DEEPGRAM_CONFIG.ENDPOINTING_MS),
      utterance_end_ms: '1000', // Force-finalize after 1s silence as safety net
      encoding: 'linear16',
      sample_rate: String(DEEPGRAM_CONFIG.SAMPLE_RATE),
      // Accuracy improvements
      numerals: 'true', // Better number formatting (e.g., "John 3:16")
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
      // A successful (re)connection means recovery worked — clear the consecutive
      // reconnect counter. Without this, unrelated network blips spread across a long
      // service accumulate toward MAX_RECONNECT_ATTEMPTS and permanently kill captions
      // mid-sermon even though each individual blip recovered.
      this.reconnectAttempts = 0
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
