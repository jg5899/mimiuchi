import { useMultiTranslationStore } from '@/stores/multi_translation'
import { useTranslationStore } from '@/stores/translation'
import is_electron from '@/helpers/is_electron'

declare const window: any

interface TranslationTask {
  text: string
  srcLang: string
  tgtLang: string
  logIndex: number
}

class TranslationQueue {
  private queue: TranslationTask[] = []
  private isProcessing = false
  private translationStore: any = null
  private multiTranslationStore: any = null

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

  addTask(text: string, srcLang: string, tgtLang: string, logIndex: number) {
    this.queue.push({ text, srcLang, tgtLang, logIndex })
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  addMultiLanguageTasks(text: string, srcLang: string, logIndex: number) {
    console.log('[TranslationQueue] addMultiLanguageTasks called:', { text, srcLang, logIndex })
    if (!this.multiTranslationStore) {
      console.log('[TranslationQueue] No multiTranslationStore!')
      return
    }

    const enabledLangs = this.multiTranslationStore.enabledTargetLangs
    console.log('[TranslationQueue] Enabled languages:', enabledLangs)
    enabledLangs.forEach((tgtLang: string) => {
      console.log('[TranslationQueue] Adding task for language:', tgtLang)
      this.addTask(text, srcLang, tgtLang, logIndex)
    })
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true
    const task = this.queue.shift()

    if (!task)
      return

    if (is_electron()) {
      // Send translation request to Electron worker
      window.ipcRenderer.send('transformers-translate-multi', {
        text: task.text,
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
    console.log('[TranslationQueue] Received translation result:', data)
    if (data.status === 'complete' && this.multiTranslationStore) {
      const translation = data.output[0].translation_text
      console.log('[TranslationQueue] Updating translation:', { index: data.index, lang: data.tgt_lang, translation })
      this.multiTranslationStore.updateTranslation(data.index, data.tgt_lang, translation)
      console.log('[TranslationQueue] MultiLogs after update:', this.multiTranslationStore.multiLogs)
    }
  }

  clearQueue() {
    this.queue = []
    this.isProcessing = false
  }
}

// Export singleton instance
export const translationQueue = new TranslationQueue()
