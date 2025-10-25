import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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
    return multiLogs.value.length - 1
  }

  // Update translation for a specific language in a log
  function updateTranslation(logIndex: number, langCode: string, translation: string) {
    if (multiLogs.value[logIndex]) {
      multiLogs.value[logIndex].translations[langCode] = translation
    }
  }

  // Get logs for a specific language
  function getLogsForLanguage(langCode: string) {
    return multiLogs.value.map(log => ({
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
  function clearLogs() {
    multiLogs.value = []
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
  }
})
