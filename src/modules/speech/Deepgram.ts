declare const window: any

// Biblical vocabulary for improved STT accuracy in church contexts
const BIBLICAL_VOCABULARY = [
  // Names of God & Jesus
  'Jesus', 'Christ', 'Messiah', 'Lord', 'God', 'Yahweh', 'Jehovah', 'Almighty',
  'Father', 'Son', 'Holy Spirit', 'Holy Ghost', 'Savior', 'Redeemer', 'Emmanuel',

  // Bible Books - Old Testament
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges',
  'Ruth', 'Samuel', 'Kings', 'Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job',
  'Psalms', 'Proverbs', 'Ecclesiastes', 'Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah',
  'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',

  // Bible Books - New Testament
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', 'Corinthians', 'Galatians',
  'Ephesians', 'Philippians', 'Colossians', 'Thessalonians', 'Timothy', 'Titus',
  'Philemon', 'Hebrews', 'James', 'Peter', 'Jude', 'Revelation',

  // Biblical People
  'Abraham', 'Isaac', 'Jacob', 'Moses', 'David', 'Solomon', 'Elijah', 'Elisha',
  'Isaiah', 'Jeremiah', 'Daniel', 'Paul', 'Peter', 'John', 'James', 'Mary',
  'Joseph', 'Adam', 'Eve', 'Noah', 'Sarah', 'Rebecca', 'Rachel', 'Leah',
  'Pharaoh', 'Pilate', 'Herod', 'Lazarus', 'Martha', 'Nicodemus', 'Barnabas',

  // Biblical Places
  'Jerusalem', 'Israel', 'Bethlehem', 'Nazareth', 'Galilee', 'Jordan', 'Egypt',
  'Babylon', 'Canaan', 'Zion', 'Calvary', 'Golgotha', 'Gethsemane', 'Sinai',

  // Theological Terms
  'salvation', 'redemption', 'sanctification', 'justification', 'righteousness',
  'atonement', 'grace', 'mercy', 'forgiveness', 'repentance', 'baptism',
  'communion', 'resurrection', 'crucifixion', 'gospel', 'scripture', 'prophecy',
  'covenant', 'testament', 'commandments', 'beatitudes', 'parable', 'miracle',
  'faith', 'hope', 'love', 'sin', 'transgression', 'iniquity', 'confession',
  'intercession', 'supplication', 'thanksgiving', 'worship', 'praise', 'prayer',
  'tithe', 'offering', 'sacrifice', 'blessing', 'anointing', 'consecration',

  // Church Terms
  'congregation', 'fellowship', 'ministry', 'sermon', 'pastor', 'preacher',
  'deacon', 'elder', 'apostle', 'disciple', 'believer', 'Christian',
  'church', 'sanctuary', 'altar', 'pulpit', 'choir', 'hymn', 'psalm',

  // Common Phrases
  'Amen', 'Hallelujah', 'Hosanna', 'Alleluia', 'Maranatha', 'Selah',
  'born again', 'eternal life', 'kingdom of God', 'kingdom of heaven',
  'Holy Bible', 'Word of God', 'Good News', 'Great Commission',

  // Trinity Community Church - Staff & Leadership
  'Trinity Community Church', 'Trinity', 'TCC',
  'Aaron Lipinski', 'Andrei Sava', 'Angelina Matchain', 'Bryan Frazier',
  'Bryce Naylor', 'Chris Nickel', 'Chuck Shillito', 'Daniel Garcia',
  'Dorothy Doswald', 'Emily Ladd', 'Emma Shapazian', 'Guillermo Matchain',
  'Heather Jensen', 'Hillary Belmont', 'Jaimi Fong', 'James Bernabe',
  'John Baker', 'Jordan Potter', 'Josh Garcia', 'Kevin Lockwood',
  'Laura Barth', 'Lisa Richardson', 'Martine Cox', 'Matt Harder',
  'Monica Gutierrez', 'Nathan Belknap', 'Nathanael Cervantes', 'Noah Potter',
  'Rachel Golding', 'Sam Musgrave', 'Sean Cox', 'Shanna Frost',
  // Trinity Elders
  'Cameron Fong', 'John Blackburn', 'Keith De', 'Larry Parker',
  'Randy Larson', 'Rick Wood', 'Scott Beckman',

  // Trinity Ministries & Programs
  'Adult Discipleship', 'Biblical Counseling', 'Fellowship Groups',
  'High School Ministry', 'Junior High Ministry', 'Student Ministries',
  'Young Adults', 'Newly Marrieds', 'Preschool Ministries', 'Sunday School',
  'Prayer Ministries', 'Worship Ministries', 'Welcoming Ministries',
  'Trinity Missions', 'Midweek Bible', 'Special Events', 'Pastoral Care',

  // Local Places (Fresno area)
  'Fresno', 'Clovis', 'Willow Ave', 'Fresno State', 'Fresno Pacific',
]

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
    // Cleanup any existing WebSocket before creating a new one to prevent duplicates
    this.cleanupWebSocket()

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
      // Accuracy improvements
      filler_words: 'false', // Remove "um", "uh", etc.
      numerals: 'true', // Better number formatting (e.g., "John 3:16")
      profanity_filter: 'false', // We handle this ourselves with church context
    })

    // Combine biblical vocabulary with user's custom keywords
    const allKeywords = [...BIBLICAL_VOCABULARY, ...this.customKeywords]
    // Deepgram limits keywords, so take unique values
    const uniqueKeywords = [...new Set(allKeywords)]
    if (uniqueKeywords.length > 0) {
      params.append('keywords', uniqueKeywords.join(','))
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

        // Set reconnecting flag IMMEDIATELY to prevent simultaneous reconnections
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
