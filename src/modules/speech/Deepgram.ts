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

  onresult: Function = () => {}
  onend: Function = () => {}
  onerror: Function = () => {}
  onstart: Function = () => {}

  constructor(lang: string = 'en-US', apiKey: string = '', customKeywords: string[] = []) {
    this.apiKey = apiKey
    this.language = lang.split('-')[0] // e.g., 'en-US' -> 'en'
    this.customKeywords = customKeywords
  }

  async start() {
    if (!this.apiKey) {
      this.onerror({ error: 'no-api-key', message: 'Deepgram API key not configured' })
      return
    }

    this.listening = true

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
      if (this.listening) {
        // Try to reconnect if still listening
        setTimeout(() => {
          if (this.listening) {
            this.connectWebSocket()
          }
        }, 1000)
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

    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.socket) {
      // Send close message to Deepgram
      this.socket.send(JSON.stringify({ type: 'CloseStream' }))
      this.socket.close()
      this.socket = null
    }

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
