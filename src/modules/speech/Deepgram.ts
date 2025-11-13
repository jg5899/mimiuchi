declare const window: any

class Deepgram {
  recorded: Blob | null = null

  stream_ref: MediaStream | null = null
  mediaRecorder: MediaRecorder | null = null

  talking: boolean = false
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
  maxReconnectAttempts: number = 5

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
            sampleRate: 16000,
          },
        })
      }

      // Connect WebSocket
      this.connectWebSocket()

      // Start streaming audio
      this.startAudioStream()

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
    // Construct WebSocket URL with Deepgram parameters
    const params = new URLSearchParams({
      model: 'nova-2',
      language: this.language,
      smart_format: 'true',
      interim_results: 'true',
      punctuate: 'true',
      endpointing: '300', // 300ms silence before finalizing
      encoding: 'linear16',
      sample_rate: '16000',
    })

    // Add custom keywords if provided
    if (this.customKeywords.length > 0) {
      params.append('keywords', this.customKeywords.join(','))
    }

    const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`

    this.socket = new WebSocket(wsUrl, ['token', this.apiKey])

    this.socket.onopen = () => {
      console.log('Deepgram WebSocket connected')
    }

    this.socket.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data)

        if (data.type === 'Results') {
          const transcript = data.channel?.alternatives?.[0]?.transcript

          if (transcript && transcript.trim()) {
            const isFinal = data.is_final || false
            this.onresult(transcript, isFinal)
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
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max reconnection attempts reached')
          this.onerror({ error: 'max-reconnect', message: 'Maximum reconnection attempts exceeded' })
          this.listening = false
          return
        }

        // Set reconnecting flag to prevent simultaneous reconnections
        this.isReconnecting = true
        this.reconnectAttempts++

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000)

        console.log(`Reconnecting in ${backoffDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

        setTimeout(() => {
          if (this.listening) {
            this.connectWebSocket()
            this.startAudioStream()
          }
          this.isReconnecting = false
        }, backoffDelay)
      }
    }
  }

  startAudioStream() {
    if (!this.stream_ref || !this.socket) return

    this.audioContext = new AudioContext({ sampleRate: 16000 })
    const source = this.audioContext.createMediaStreamSource(this.stream_ref)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

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
