import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export interface LanguageStream {
  id: string
  name: string
  targetLang: string
  enabled: boolean
  route: string
}

export interface TranslationLog {
  transcript: string
  translations: { [langCode: string]: string }
  isFinal: boolean
  time?: Date
}

export const useMultiTranslationStore = defineStore('multi_translation', () => {
  // Available language streams
  const languageStreams = ref<LanguageStream[]>([
    // Primary languages (enabled by default)
    {
      id: 'spanish',
      name: 'Spanish',
      targetLang: 'spa_Latn',
      enabled: true,
      route: '/spanish',
    },
    {
      id: 'ukrainian',
      name: 'Ukrainian',
      targetLang: 'ukr_Cyrl',
      enabled: true,
      route: '/ukrainian',
    },
    {
      id: 'russian',
      name: 'Russian',
      targetLang: 'rus_Cyrl',
      enabled: true,
      route: '/russian',
    },
    // Extra languages (disabled by default - toggle on as needed)
    {
      id: 'portuguese',
      name: 'Portuguese',
      targetLang: 'por_Latn',
      enabled: false,
      route: '/portuguese',
    },
    {
      id: 'french',
      name: 'French',
      targetLang: 'fra_Latn',
      enabled: false,
      route: '/french',
    },
    {
      id: 'korean',
      name: 'Korean',
      targetLang: 'kor_Hang',
      enabled: false,
      route: '/korean',
    },
    {
      id: 'mandarin',
      name: 'Mandarin Chinese',
      targetLang: 'zho_Hans',
      enabled: false,
      route: '/mandarin',
    },
    {
      id: 'tagalog',
      name: 'Tagalog',
      targetLang: 'tgl_Latn',
      enabled: false,
      route: '/tagalog',
    },
    {
      id: 'vietnamese',
      name: 'Vietnamese',
      targetLang: 'vie_Latn',
      enabled: false,
      route: '/vietnamese',
    },
    {
      id: 'arabic',
      name: 'Arabic',
      targetLang: 'arb_Arab',
      enabled: false,
      route: '/arabic',
    },
    {
      id: 'hindi',
      name: 'Hindi',
      targetLang: 'hin_Deva',
      enabled: false,
      route: '/hindi',
    },
    {
      id: 'polish',
      name: 'Polish',
      targetLang: 'pol_Latn',
      enabled: false,
      route: '/polish',
    },
  ])

  // Multi-language translation logs
  const multiLogs = ref<TranslationLog[]>([])

  // Log rotation to prevent unbounded memory growth
  const MAX_LOGS = 200 // Keep last 200 logs

  // Throttle mechanism to slow down translation updates for better readability
  const updateThrottleTime = 400 // milliseconds between updates per log entry
  const lastUpdateTimes = new Map<string, number>()

  // Get enabled language streams
  const enabledStreams = computed(() => {
    return languageStreams.value.filter(stream => stream.enabled)
  })

  // Get enabled target languages for translation
  const enabledTargetLangs = computed(() => {
    return enabledStreams.value.map(stream => stream.targetLang)
  })

  // Add a new translation log
  function addTranslationLog(transcript: string, isFinal: boolean = false) {
    const log: TranslationLog = {
      transcript,
      translations: {},
      isFinal,
      time: new Date(),
    }
    multiLogs.value.push(log)

    // Implement log rotation to prevent memory leaks
    if (multiLogs.value.length > MAX_LOGS) {
      const logsToRemove = multiLogs.value.length - MAX_LOGS
      multiLogs.value = multiLogs.value.slice(logsToRemove)

      // Clean up old throttle entries
      lastUpdateTimes.clear()

      console.log(`[MultiTranslation] Rotated logs, removed ${logsToRemove} old entries`)
    }

    return multiLogs.value.length - 1
  }

  // Update translation for a specific language in a log
  function updateTranslation(logIndex: number, langCode: string, translation: string, originalText?: string) {
    // Create log entry immediately if it doesn't exist (for WebSocket browser clients)
    // This ensures transcripts appear in real-time, without throttling
    if (!multiLogs.value[logIndex] && originalText) {
      multiLogs.value[logIndex] = {
        transcript: originalText,
        translations: {},
        isFinal: true,
        time: new Date(),
      }
    }

    // Throttle only the translation updates, not the transcript creation
    // This keeps main transcription fast while slowing down translations for readability
    const throttleKey = `${logIndex}-${langCode}`
    const now = Date.now()
    const lastUpdate = lastUpdateTimes.get(throttleKey) || 0

    // Only update if enough time has passed since last update for this specific log+language
    if (now - lastUpdate < updateThrottleTime) {
      return // Skip this update to slow down the rate
    }

    // Update the last update time
    lastUpdateTimes.set(throttleKey, now)

    // Update the translation (this is throttled)
    if (multiLogs.value[logIndex]) {
      multiLogs.value[logIndex].translations[langCode] = translation
    }
  }

  // Get logs for a specific language
  function getLogsForLanguage(langCode: string) {
    return multiLogs.value
      .filter(log => log != null)
      .map(log => ({
        transcript: log.transcript,
        translation: log.translations[langCode] || '',
        isFinal: log.isFinal,
        time: log.time,
      }))
  }

  // Toggle language stream
  function toggleLanguageStream(streamId: string) {
    const stream = languageStreams.value.find(s => s.id === streamId)
    if (stream) {
      stream.enabled = !stream.enabled
    }
  }

  // Clear logs
  async function clearLogs() {
    multiLogs.value = []
    // Also clear the regular logs store
    const { useLogsStore } = await import('@/stores/logs')
    const logsStore = useLogsStore()
    logsStore.logs = []
  }

  // Export transcripts and translations
  function exportToText(): string {
    let output = `Mimiuchi - Multi-Language Transcription Export\n`
    output += `Generated: ${new Date().toLocaleString()}\n`
    output += `Total Entries: ${multiLogs.value.length}\n`
    output += `${'='.repeat(80)}\n\n`

    multiLogs.value.forEach((log, index) => {
      const timestamp = log.time ? new Date(log.time).toLocaleTimeString() : 'N/A'
      output += `[${index + 1}] ${timestamp}\n`
      output += `Original: ${log.transcript}\n`

      const enabledLangs = enabledStreams.value
      enabledLangs.forEach(stream => {
        const translation = log.translations[stream.targetLang]
        if (translation) {
          output += `${stream.name}: ${translation}\n`
        }
      })
      output += `\n`
    })

    return output
  }

  function exportToJSON(): string {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalEntries: multiLogs.value.length,
        enabledLanguages: enabledStreams.value.map(s => ({
          code: s.targetLang,
          name: s.name
        }))
      },
      logs: multiLogs.value.map((log, index) => ({
        index: index + 1,
        timestamp: log.time,
        original: log.transcript,
        translations: log.translations,
        isFinal: log.isFinal
      }))
    }

    return JSON.stringify(exportData, null, 2)
  }

  function exportToCSV(): string {
    const enabledLangs = enabledStreams.value
    const headers = ['Index', 'Timestamp', 'Original', ...enabledLangs.map(s => s.name)]
    let csv = headers.join(',') + '\n'

    multiLogs.value.forEach((log, index) => {
      const timestamp = log.time ? new Date(log.time).toISOString() : ''
      const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`

      const row = [
        index + 1,
        escapeCsv(timestamp),
        escapeCsv(log.transcript),
        ...enabledLangs.map(s => escapeCsv(log.translations[s.targetLang] || ''))
      ]
      csv += row.join(',') + '\n'
    })

    return csv
  }

  function downloadExport(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function exportTranscripts(format: 'txt' | 'json' | 'csv' = 'txt') {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    let content: string
    let filename: string
    let mimeType: string

    switch (format) {
      case 'json':
        content = exportToJSON()
        filename = `mimiuchi-transcripts-${timestamp}.json`
        mimeType = 'application/json'
        break
      case 'csv':
        content = exportToCSV()
        filename = `mimiuchi-transcripts-${timestamp}.csv`
        mimeType = 'text/csv'
        break
      default:
        content = exportToText()
        filename = `mimiuchi-transcripts-${timestamp}.txt`
        mimeType = 'text/plain'
    }

    downloadExport(content, filename, mimeType)
    console.log(`[MultiTranslation] Exported ${multiLogs.value.length} entries as ${format}`)
  }

  // Sync multiLogs across windows using BroadcastChannel
  let skipNextUpdate = false
  let bc: BroadcastChannel | null = null

  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel('multiLogs')
    console.log('[MultiTranslation] BroadcastChannel created')

    // Watch for changes and broadcast to other windows
    watch(multiLogs, (newLogs) => {
      if (!skipNextUpdate && bc) {
        console.log('[MultiTranslation] Broadcasting to other windows, logs count:', newLogs.length)
        // Convert Vue Proxy to plain object for cloning
        const plainLogs = JSON.parse(JSON.stringify(newLogs))
        bc.postMessage({ type: 'update', logs: plainLogs })
      }
      skipNextUpdate = false
    }, { deep: true })

    // Listen for updates from other windows
    bc.onmessage = (event) => {
      if (event.data.type === 'update') {
        console.log('[MultiTranslation] Received broadcast, logs count:', event.data.logs.length)
        skipNextUpdate = true
        multiLogs.value = event.data.logs
      }
    }
  }

  return {
    languageStreams,
    multiLogs,
    enabledStreams,
    enabledTargetLangs,
    addTranslationLog,
    updateTranslation,
    getLogsForLanguage,
    toggleLanguageStream,
    clearLogs,
    exportTranscripts,
  }
})
