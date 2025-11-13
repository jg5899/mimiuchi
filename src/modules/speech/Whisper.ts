declare const window: any

declare interface Lang {
  title: string
  value: string
  icon?: string
}

function get_mime_type() {
  const types = [
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
    'audio/wav',
    'audio/aac',
  ]
  for (let i = 0; i < types.length; i++) {
    if (MediaRecorder.isTypeSupported(types[i]))
      return types[i]
  }
  return undefined
}

class Whisper {
  recorded: Blob | null = null

  stream_ref: MediaStream | null = null // MediaStream
  media_recorder: MediaRecorder | null = null
  chunks_ref: Blob[] = []

  talking: boolean = false
  listening: boolean = false
  isRecording: boolean = false
  apiKey: string = ''
  language: string = 'en'
  recognition: boolean = true // Compatibility flag for speech recognition check
  last_error: string = ''
  try_restart_interval: any = null
  chunk_interval: NodeJS.Timeout | null = null
  customPrompt: string = '' // Custom prompt for context-aware transcription
  useGPT4oPostProcessing: boolean = false // Enable GPT-4o refinement

  onresult: Function = () => {}
  onend: Function = () => {}
  onerror: Function = () => {}
  onstart: Function = () => {}

  constructor(lang: string = 'en-US', apiKey: string = '', customPrompt: string = '', useGPT4o: boolean = false) {
    this.apiKey = apiKey
    this.customPrompt = customPrompt || 'Church service with scripture readings, prayers, hymns, and sermon. Proper nouns include God, Jesus, Christ, Holy Spirit, Bible, Amen.'
    this.useGPT4oPostProcessing = useGPT4o
    // Convert Web Speech API language code to Whisper language code
    this.language = lang.split('-')[0] // e.g., 'en-US' -> 'en'
  }

  async start() {
    if (!this.apiKey) {
      this.onerror({ error: 'no-api-key', message: 'OpenAI API key not configured' })
      return
    }

    this.listening = true
    this.chunks_ref = []

    try {
      if (!this.stream_ref) {
        this.stream_ref = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
          },
        })
      }

      // Try to use MP4 first (Safari compatible and OpenAI accepts it)
      let mime_type = 'audio/mp4'
      if (!MediaRecorder.isTypeSupported(mime_type)) {
        // Fallback to webm if mp4 not supported
        mime_type = 'audio/webm'
        if (!MediaRecorder.isTypeSupported(mime_type)) {
          // Last resort - use whatever is available
          mime_type = get_mime_type() || 'audio/webm'
        }
      }

      console.log('Using MIME type for recording:', mime_type)
      this.media_recorder = new MediaRecorder(this.stream_ref, { mimeType: mime_type })

      this.media_recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.chunks_ref.push(event.data)
        }
      })

      this.media_recorder.addEventListener('stop', async () => {
        if (this.chunks_ref.length > 0) {
          const blob = new Blob(this.chunks_ref, { type: mime_type })
          await this.transcribe(blob)
          this.chunks_ref = []
        }
      })

      // Record in chunks (every 5 seconds for near real-time transcription)
      this.media_recorder.start()
      this.isRecording = true
      this.onstart()

      // Auto-chunk every 3 seconds for balanced real-time + readability
      // Clear any existing interval first
      if (this.chunk_interval) {
        clearInterval(this.chunk_interval)
      }
      this.chunk_interval = setInterval(() => {
        if (this.media_recorder?.state === 'recording' && this.listening) {
          this.media_recorder.stop()
          setTimeout(() => {
            if (this.listening && this.media_recorder) {
              this.media_recorder.start()
            }
          }, 100)
        }
        else {
          if (this.chunk_interval) {
            clearInterval(this.chunk_interval)
            this.chunk_interval = null
          }
        }
      }, 3000)
    }
    catch (error: any) {
      console.error('Whisper start error:', error)
      this.onerror({ error: 'audio-capture', message: error.message })
      this.listening = false
    }
  }

  stop() {
    this.listening = false
    // Clear chunk interval FIRST to prevent race conditions
    if (this.chunk_interval) {
      clearInterval(this.chunk_interval)
      this.chunk_interval = null
    }
    if (this.media_recorder && this.media_recorder.state !== 'inactive') {
      this.media_recorder.stop()
    }
    if (this.stream_ref) {
      this.stream_ref.getTracks().forEach(track => track.stop())
      this.stream_ref = null
    }
    this.isRecording = false
    this.onend()
  }

  async transcribe(audioBlob: Blob) {
    if (!this.apiKey) {
      console.error('No API key configured')
      return
    }

    try {
      console.log('transcribe called with blob:', {
        type: audioBlob.type,
        size: audioBlob.size
      })

      // Skip very small audio chunks (likely silence or noise)
      // Typical speech is ~10KB+ per second, so 3 seconds should be 30KB+
      if (audioBlob.size < 10000) {
        console.log('Skipping small/silent chunk:', audioBlob.size, 'bytes')
        return
      }

      // Use the actual blob type - don't lie about the format!
      // OpenAI supports webm, so just send it as-is
      let filename = 'audio.webm'
      let mimeType = audioBlob.type || 'audio/webm'

      // Set correct filename based on actual type
      if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
        filename = 'audio.m4a'
      } else if (mimeType.includes('webm')) {
        filename = 'audio.webm'
      } else if (mimeType.includes('ogg')) {
        filename = 'audio.ogg'
      } else if (mimeType.includes('wav')) {
        filename = 'audio.wav'
      }

      // Convert blob to file for OpenAI API with REAL type
      const file = new File([audioBlob], filename, { type: mimeType })

      console.log('Sending to OpenAI:', {
        originalType: audioBlob.type,
        finalType: mimeType,
        filename,
        size: audioBlob.size
      })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('model', 'whisper-1')
      formData.append('language', this.language)
      formData.append('response_format', 'json')
      formData.append('temperature', '0') // Reduce hallucinations

      // Add custom prompt to guide transcription with speaker-specific context
      // This helps with specialized vocabulary, names, and proper capitalization
      formData.append('prompt', this.customPrompt)

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Transcription failed')
      }

      const result = await response.json()
      let transcript = result.text

      if (transcript && transcript.trim()) {
        // Apply GPT-4o post-processing if enabled
        if (this.useGPT4oPostProcessing) {
          try {
            transcript = await this.refineWithGPT4o(transcript)
          }
          catch (error: any) {
            console.error('GPT-4o post-processing error (using original):', error)
            // Fall back to original transcript if GPT-4o fails
          }
        }

        // Send interim result first
        this.onresult(transcript, false)
        // Then send final result after a short delay
        setTimeout(() => {
          this.onresult(transcript, true)
        }, 100)
      }
    }
    catch (error: any) {
      console.error('Whisper transcription error:', error)
      this.onerror({ error: 'network', message: error.message })
    }
  }

  async refineWithGPT4o(transcript: string): Promise<string> {
    if (!this.apiKey) {
      console.error('No API key configured for GPT-4o')
      return transcript
    }

    // Skip refinement for very short transcripts (less than 3 words)
    const wordCount = transcript.trim().split(/\s+/).length
    if (wordCount < 3) {
      console.log('Skipping GPT-4o for short transcript:', transcript)
      return transcript
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a transcript refinement assistant for church services. Your job is to:
1. Fix grammar, punctuation, and capitalization
2. Correct biblical and theological terms (e.g., "god" -> "God", "jesus" -> "Jesus", "holy spirit" -> "Holy Spirit")
3. Fix common speech-to-text errors for religious content
4. Preserve the speaker's exact words and meaning
5. Return ONLY the corrected transcript, nothing else
6. Process even short fragments - do NOT ask for more text
7. If the transcript is incomplete (mid-sentence), still fix what's there

IMPORTANT: Even if the transcript is short or seems incomplete, refine it anyway. Do not respond with meta-commentary.

Context: ${this.customPrompt}`,
            },
            {
              role: 'user',
              content: transcript,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'GPT-4o refinement failed')
      }

      const result = await response.json()
      const refinedText = result.choices[0]?.message?.content?.trim()

      console.log('GPT-4o refinement:', {
        original: transcript,
        refined: refinedText,
      })

      return refinedText || transcript
    }
    catch (error: any) {
      console.error('GPT-4o refinement error:', error)
      return transcript // Fall back to original on error
    }
  }

  speak(input: string) {
    // TTS not supported with Whisper
  }
}

export { Whisper }
