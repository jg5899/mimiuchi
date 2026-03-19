import { useLogsStore } from '@/stores/logs'
import { useMultiTranslationStore } from '@/stores/multi_translation'
import { useDefaultStore } from '@/stores/default'
import is_electron from '@/helpers/is_electron'

let interval: ReturnType<typeof setInterval> | null = null

declare const window: any

export function startStatsReporter() {
  if (!is_electron() || interval) return

  interval = setInterval(() => {
    const logsStore = useLogsStore()
    const multiStore = useMultiTranslationStore()
    const defaultStore = useDefaultStore()

    const speech = defaultStore.speech.value

    const stats = {
      stt: {
        engine: speech?.constructor?.name?.toLowerCase() || 'none',
        model: 'nova-3',
        listening: speech?.listening || false
      },
      translation: {
        provider: 'openai',
        languages: multiStore.enabledStreams.map((s: any) => s.name),
        queue_pending: 0
      },
      session: {
        words_transcribed: logsStore.wordsTranscribed,
        translations_served: multiStore.translationsServed
      }
    }

    window.ipcRenderer?.send('stats-update', stats)
  }, 2000)
}

export function stopStatsReporter() {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}
