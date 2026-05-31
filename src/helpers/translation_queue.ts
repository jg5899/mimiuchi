import { useMultiTranslationStore } from '@/stores/multi_translation'
import { useTranslationStore } from '@/stores/translation'
import is_electron from '@/helpers/is_electron'

declare const window: any

// Configuration constants
const QUEUE_CONFIG = {
  MAX_HISTORY: 10,           // Absolute maximum context history regardless of user setting
  MAX_CONCURRENT: 5,         // Maximum concurrent API requests (increased for faster multi-lang)
  TASK_TIMEOUT_MS: 30000,    // 30 second timeout for stuck translations
  DEBUG: false,              // Set to true to enable verbose logging
} as const

interface QueuedTask {
  text: string
  srcLang: string
  tgtLang: string
  logIndex: number
  context: string
  priority: number // Higher priority = process first
  startTime?: number // Track when task started for timeout detection
}

class TranslationQueue {
  private translationStore: any = null
  private multiTranslationStore: any = null
  private contextHistory: string[] = []
  private activeTasks: number = 0
  private queue: QueuedTask[] = []
  private activeTaskIds: Map<string, ReturnType<typeof setTimeout>> = new Map() // Track active tasks with timeouts

  private initialized = false

  constructor() {
    // IPC listener deferred to initialize() to ensure stores are ready
  }

  initialize(translationStore: any, multiTranslationStore: any) {
    this.translationStore = translationStore
    this.multiTranslationStore = multiTranslationStore

    // Register IPC listener only once, after stores are available
    if (!this.initialized && is_electron()) {
      window.ipcRenderer?.on('transformers-translate-render-multi', (event: any, data: any) => {
        this.handleTranslationResult(data)
      })
      this.initialized = true
    }
  }

  // Debug logging helper - only logs if DEBUG is enabled
  private log(...args: any[]) {
    if (QUEUE_CONFIG.DEBUG) {
      console.log('[TranslationQueue]', ...args)
    }
  }

  // Generate unique task ID for timeout tracking
  private getTaskId(logIndex: number, tgtLang: string): string {
    return `${logIndex}-${tgtLang}`
  }

  addMultiLanguageTasks(text: string, srcLang: string, logIndex: number) {
    this.log('addMultiLanguageTasks called:', {
      text: text.substring(0, 50),
      srcLang,
      logIndex,
      hasMultiStore: !!this.multiTranslationStore,
      hasTranslationStore: !!this.translationStore,
    })

    if (!this.multiTranslationStore || !this.translationStore) {
      console.error('[TranslationQueue] Stores not initialized! Cannot proceed with translations.')
      return
    }

    // Build context string from last N items in contextHistory
    let contextString = ''
    if (this.translationStore.use_context && this.contextHistory.length > 0) {
      const windowSize = this.translationStore.context_window_size || 3
      const contextItems = this.contextHistory.slice(-windowSize)
      contextString = contextItems.join(' ')
    }

    const enabledLangs = this.multiTranslationStore.enabledTargetLangs
    this.log('Enabled languages:', enabledLangs, 'Queue size:', this.queue.length, 'Active:', this.activeTasks)

    // Add all translation tasks to queue with priority
    enabledLangs.forEach((tgtLang: string, index: number) => {
      this.queue.push({
        text,
        srcLang,
        tgtLang,
        logIndex,
        context: contextString,
        priority: index, // First language has highest priority
      })
    })

    // Add current text to contextHistory with absolute maximum limit
    if (this.translationStore.use_context) {
      this.contextHistory.push(text)
      // Trim contextHistory to max size with absolute maximum
      const userMaxHistorySize = (this.translationStore.context_window_size || 3) * 2
      const maxHistorySize = Math.min(userMaxHistorySize, QUEUE_CONFIG.MAX_HISTORY)
      if (this.contextHistory.length > maxHistorySize) {
        this.contextHistory.splice(0, this.contextHistory.length - maxHistorySize)
      }
    }

    // Process queue
    this.processQueue()
  }

  private processQueue() {
    // Process as many tasks as we can while staying under the concurrency limit
    while (this.activeTasks < QUEUE_CONFIG.MAX_CONCURRENT && this.queue.length > 0) {
      // Sort queue by priority (lower priority number = higher priority)
      this.queue.sort((a, b) => a.priority - b.priority)

      // Take the highest priority task
      const task = this.queue.shift()
      if (!task) break

      this.activeTasks++
      this.log(`Starting translation for ${task.tgtLang} (Active: ${this.activeTasks}/${QUEUE_CONFIG.MAX_CONCURRENT}, Queue: ${this.queue.length})`)

      this.sendTranslationRequest(task.text, task.srcLang, task.tgtLang, task.logIndex, task.context)
    }
  }

  private sendTranslationRequest(text: string, srcLang: string, tgtLang: string, logIndex: number, context: string = '') {
    this.log('Sending translation request:', {
      text: text.substring(0, 50),
      srcLang,
      tgtLang,
      logIndex,
      isElectron: is_electron(),
    })

    const taskId = this.getTaskId(logIndex, tgtLang)

    if (is_electron()) {
      // Send translation request to Electron worker with rate limiting
      this.log('Sending to Electron worker via IPC')
      window.ipcRenderer.send('transformers-translate-multi', {
        text,
        context: context || '',
        src_lang: srcLang,
        tgt_lang: tgtLang,
        index: logIndex,
      })

      // Set up timeout to recover from stuck translations
      const timeoutId = setTimeout(() => {
        if (this.activeTaskIds.has(taskId)) {
          console.error(`[TranslationQueue] Translation timeout for ${tgtLang} (index: ${logIndex}) — falling back to original text`)
          this.activeTaskIds.delete(taskId)
          this.activeTasks--
          // Fall back to the original text so the line isn't lost to a timeout token.
          this.deliverTranslation(logIndex, tgtLang, text)
          this.processQueue() // Continue with next task
        }
      }, QUEUE_CONFIG.TASK_TIMEOUT_MS)

      this.activeTaskIds.set(taskId, timeoutId)
    }
    else {
      // For web version, just store the original text
      if (this.multiTranslationStore) {
        this.multiTranslationStore.updateTranslation(logIndex, tgtLang, text)
        this.activeTasks--
        this.processQueue() // Continue processing queue
      }
    }
  }

  // Deliver a line to the in-app store AND broadcast it to HTTP display clients
  // (phones/projector). Used for successful translations and for fallbacks (original
  // text on failure/timeout) so a line is never silently dropped or shown as an error.
  private deliverTranslation(logIndex: number, tgtLang: string, translation: string) {
    if (!this.multiTranslationStore) return
    this.multiTranslationStore.updateTranslation(logIndex, tgtLang, translation)

    if (!is_electron()) return
    // Look up log by stable ID (not array index) to handle trimmed arrays
    const log = this.multiTranslationStore.multiLogs.find((l: any) => l.id === logIndex)
    if (!log) return
    const stream = this.multiTranslationStore.languageStreams.find(
      (s: any) => s.targetLang === tgtLang && s.enabled
    )
    if (!stream) return

    const langPayload = {
      transcript: log.transcript,
      translation,
      targetLang: tgtLang,
      languageName: stream.name,
      isFinal: log.isFinal,
      time: log.time,
    }
    this.log(`Broadcasting for ${stream.name} (${tgtLang}):`, String(translation).substring(0, 50))
    window.ipcRenderer.send('httpserver-broadcast', `{"type": "text", "data": ${JSON.stringify(langPayload)}}`)
  }

  private handleTranslationResult(data: any) {
    this.log('Received translation result:', {
      status: data.status,
      index: data.index,
      tgt_lang: data.tgt_lang,
      hasOutput: !!data.output,
      hasStore: !!this.multiTranslationStore,
    })

    // Clear timeout for this task — only decrement if the task was still active
    // (prevents double-decrement when timeout fires AND worker returns a result)
    const taskId = this.getTaskId(data.index, data.tgt_lang)
    const timeoutId = this.activeTaskIds.get(taskId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.activeTaskIds.delete(taskId)

      // Only decrement if this task was still tracked (not already timed out)
      if (data.status === 'complete' || data.status === 'error') {
        this.activeTasks = Math.max(0, this.activeTasks - 1)
        this.log(`Task completed. Active: ${this.activeTasks}/${QUEUE_CONFIG.MAX_CONCURRENT}, Queue: ${this.queue.length}`)
        this.processQueue()
      }
    } else {
      // Task already timed out — activeTasks was already decremented by the timeout handler
      this.log(`Task ${taskId} result arrived after timeout, skipping decrement`)
    }

    if (data.status === 'complete' && this.multiTranslationStore) {
      // Validate translation output structure; on malformed output fall back to the
      // original transcript so a line is never lost to an error token.
      if (!data.output || !Array.isArray(data.output) || data.output.length === 0 || !data.output[0]?.translation_text) {
        console.error('[TranslationQueue] Translation complete with invalid output, falling back to original:', data.output)
        const log = this.multiTranslationStore.multiLogs.find((l: any) => l.id === data.index)
        this.deliverTranslation(data.index, data.tgt_lang, log?.transcript || '')
        return
      }
      const translation = data.output[0].translation_text
      this.log(`Updating translation for ${data.tgt_lang}:`, translation.substring(0, 50))
      this.deliverTranslation(data.index, data.tgt_lang, translation)
    } else if (data.status === 'error' && this.multiTranslationStore) {
      // Translation failed after the worker's retries — fall back to the original
      // transcript so the congregation still sees the line (in English) instead of
      // nothing or an "[Translation Error]" token.
      console.warn(`[TranslationQueue] Translation error for ${data.tgt_lang} (index ${data.index}): ${data.error}. Falling back to original text.`)
      const log = this.multiTranslationStore.multiLogs.find((l: any) => l.id === data.index)
      this.deliverTranslation(data.index, data.tgt_lang, log?.transcript || '')
    }
  }

  clearContextHistory() {
    this.contextHistory = []
  }
}

// Export singleton instance
export const translationQueue = new TranslationQueue()
