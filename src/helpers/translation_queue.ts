import { useMultiTranslationStore } from '@/stores/multi_translation'
import { useTranslationStore } from '@/stores/translation'
import is_electron from '@/helpers/is_electron'

declare const window: any

interface TranslationTask {
  text: string
  srcLang: string
  tgtLang: string
  logIndex: number
  context?: string
}

class TranslationQueue {
  private queue: TranslationTask[] = []
  private isProcessing = false
  private translationStore: any = null
  private multiTranslationStore: any = null
  private contextHistory: string[] = []

  constructor() {
    if (is_electron()) {
      // Set up listener for translation results
      window.ipcRenderer?.on('transformers-translate-render-multi', (event: any, data: any) => {
        this.handleTranslationResult(data)
      })
    }
  }

  initialize(translationStore: any, multiTranslationStore: any) {
    this.translationStore = translationStore
    this.multiTranslationStore = multiTranslationStore
  }

  addTask(text: string, srcLang: string, tgtLang: string, logIndex: number, context?: string) {
    this.queue.push({ text, srcLang, tgtLang, logIndex, context })
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  addMultiLanguageTasks(text: string, srcLang: string, logIndex: number) {
    console.log('[TranslationQueue] addMultiLanguageTasks called:', {
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
    console.log('[TranslationQueue] Enabled languages:', enabledLangs)

    enabledLangs.forEach((tgtLang: string) => {
      console.log(`[TranslationQueue] Adding task for ${tgtLang}`)
      this.addTask(text, srcLang, tgtLang, logIndex, contextString)
    })

    // Add current text to contextHistory
    if (this.translationStore.use_context) {
      this.contextHistory.push(text)
      // Trim contextHistory to max size (keep double the window size for buffer)
      const maxHistorySize = (this.translationStore.context_window_size || 3) * 2
      if (this.contextHistory.length > maxHistorySize) {
        this.contextHistory = this.contextHistory.slice(-maxHistorySize)
      }
    }
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false
      console.log('[TranslationQueue] Queue empty, stopping processing')
      return
    }

    this.isProcessing = true
    const task = this.queue.shift()

    if (!task)
      return

    console.log('[TranslationQueue] Processing task:', {
      text: task.text.substring(0, 50),
      srcLang: task.srcLang,
      tgtLang: task.tgtLang,
      logIndex: task.logIndex,
      isElectron: is_electron(),
    })

    if (is_electron()) {
      // Send translation request to Electron worker
      console.log('[TranslationQueue] Sending to Electron worker via IPC')
      window.ipcRenderer.send('transformers-translate-multi', {
        text: task.text,
        context: task.context || '',
        src_lang: task.srcLang,
        tgt_lang: task.tgtLang,
        index: task.logIndex,
      })

      // Wait a bit before processing next task to avoid overwhelming the worker
      setTimeout(() => this.processQueue(), 500)
    }
    else {
      // For web version, just store the original text
      if (this.multiTranslationStore) {
        this.multiTranslationStore.updateTranslation(task.logIndex, task.tgtLang, task.text)
      }
      this.processQueue()
    }
  }

  private handleTranslationResult(data: any) {
    console.log('[TranslationQueue] Received translation result:', {
      status: data.status,
      index: data.index,
      tgt_lang: data.tgt_lang,
      hasOutput: !!data.output,
      hasStore: !!this.multiTranslationStore,
    })

    if (data.status === 'complete' && this.multiTranslationStore) {
      // Validate translation output structure
      if (!data.output || !Array.isArray(data.output) || data.output.length === 0 || !data.output[0]?.translation_text) {
        console.error('[TranslationQueue] Translation complete with invalid output:', data.output)
        this.multiTranslationStore.updateTranslation(data.index, data.tgt_lang, '[Translation Error]')
        return
      }
      const translation = data.output[0].translation_text
      console.log(`[TranslationQueue] Updating translation for ${data.tgt_lang}:`, translation.substring(0, 50))
      this.multiTranslationStore.updateTranslation(data.index, data.tgt_lang, translation)

      // CRITICAL: Broadcast the translation to HTTP server display clients
      if (is_electron()) {
        const log = this.multiTranslationStore.multiLogs[data.index]
        if (log) {
          const stream = this.multiTranslationStore.languageStreams.find(
            (s: any) => s.targetLang === data.tgt_lang && s.enabled
          )

          if (stream) {
            const langPayload = {
              transcript: log.transcript,
              translation: translation,
              targetLang: data.tgt_lang,
              languageName: stream.name,
              isFinal: log.isFinal,
              time: log.time,
            }
            const langMessage = `{"type": "text", "data": ${JSON.stringify(langPayload)}}`
            console.log(`[TranslationQueue] Broadcasting translation for ${stream.name} (${data.tgt_lang}):`, translation.substring(0, 50))
            window.ipcRenderer.send('httpserver-broadcast', langMessage)
          }
        }
      }
    }
  }

  clearQueue() {
    this.queue = []
    this.isProcessing = false
  }

  clearContextHistory() {
    this.contextHistory = []
  }
}

// Export singleton instance
export const translationQueue = new TranslationQueue()
