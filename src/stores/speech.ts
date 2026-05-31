import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSettingsStore } from './settings'
import { useDefaultStore } from '@/stores/default'
import { useLogsStore } from '@/stores/logs'
import { useAppearanceStore } from '@/stores/appearance'
import { useTranslationStore } from '@/stores/translation'
import { useConnectionsStore } from '@/stores/connections'
import { useWordReplaceStore } from '@/stores/word_replace'
import { useSpeakerProfilesStore } from '@/stores/speaker_profiles'
import { useMultiTranslationStore } from '@/stores/multi_translation'
import { translationQueue } from '@/helpers/translation_queue'
import is_electron from '@/helpers/is_electron'
import { i18n } from '@/plugins/i18n'
import { Deepgram } from '@/modules/speech'
import webhook from '@/helpers/webhook'

import { filterProfanity } from '@/helpers/profanity_filter'

export interface ListItem {
  title: string
  value: string
}

interface PinnedLanguages {
  [key: string]: ListItem
}

declare const window: any

export const useSpeechStore = defineStore('speech', () => {
  const stt_init = {
    type: {
      title: 'Deepgram Nova-2 (Best for real-time church audio, recommended)',
      value: 'deepgram',
    },
    language: 'en-US',
    confidence: 0.9,
    sensitivity: 0.0,
    deepgramApiKey: '',
  }

  const stt = ref(structuredClone(stt_init))

  const tts_init = {
    enabled: false,
    type: 'webspeech',
    voice: '',
    rate: 1,
    pitch: 1,
  }

  const tts = ref(structuredClone(tts_init))

  const pinned_languages = ref<PinnedLanguages>({})

  function reset() {
    stt.value = structuredClone(stt_init)
    tts.value = structuredClone(tts_init)
    pinned_languages.value = {}
  }

  function initialize_speech(language: string) {
    const defaultStore = useDefaultStore()
    const speakerProfilesStore = useSpeakerProfilesStore()

    console.log('initialize_speech called', {
      type: stt.value.type.value,
      language,
      hasDeepgramKey: !!stt.value.deepgramApiKey,
    })

    try {
      // Get the active speaker profile's custom vocabulary for keyword boost
      const activeProfile = speakerProfilesStore.getActiveProfile()
      const customKeywords = activeProfile?.customVocabulary?.map(v => v.replacement) || []

      console.log('About to create Deepgram instance with:', {
        language,
        hasApiKey: !!stt.value.deepgramApiKey,
        customKeywords,
      })

      defaultStore.speech.value = new Deepgram(
        language,
        stt.value.deepgramApiKey,
        customKeywords,
      )

      console.log('Created Deepgram instance successfully', {
        hasRecognition: !!defaultStore.speech.value.recognition,
        hasApiKey: !!defaultStore.speech.value.apiKey,
        apiKeyLength: defaultStore.speech.value.apiKey?.length,
        customKeywords: customKeywords.length,
      })
    }
    catch (error) {
      console.error('Error creating Deepgram instance:', error)
    }
  }

  function toggle_listen() {
    const defaultStore = useDefaultStore()

    console.log('toggle_listen called', {
      speechValue: defaultStore.speech.value,
      speechType: typeof defaultStore.speech.value,
      hasRecognition: !!defaultStore.speech.value?.recognition,
      hasApiKey: !!defaultStore.speech.value?.apiKey,
      apiKeyLength: defaultStore.speech.value?.apiKey?.length,
      sttType: stt.value.type.value
    })

    // Check if speech.value exists
    if (!defaultStore.speech.value) {
      console.error('Speech object not initialized!')
      defaultStore.show_snackbar('error', 'Speech system not initialized. Please refresh the app.')
      return
    }

    // recognition not supported
    if (!defaultStore.speech.value.recognition) {
      // listening = false
      console.error('No recognition support!')
      defaultStore.show_snackbar('error', i18n.t('snackbar.no_speech'))
      return
    }

    defaultStore.speech.value.listening = !defaultStore.speech.value.listening

    defaultStore.speech.value.onend = () => {
      // restart if auto stopped
      if (defaultStore.speech.value.listening) {
        if (defaultStore.speech.value.last_error === 'network') {
          defaultStore.speech.value.try_restart_interval = setTimeout(() => {
            defaultStore.speech.value.start()
          }, 2000)

          return
        }

        defaultStore.speech.value.start()
      }
    }

    defaultStore.speech.value.onerror = (event: any) => {
      let desc = ''

      defaultStore.speech.value.last_error = event.error

      switch (event.error) {
        case 'no-speech': // No speech was detected
          return
        case 'aborted':
          desc = i18n.t('snackbar.speech_recognition_error_event.aborted')
          defaultStore.speech.value.listening = false
          defaultStore.speech.value.stop()
          break
        case 'no-api-key':
          // Deepgram-specific: missing/invalid key — terminal config error.
          desc = 'Deepgram API key missing or invalid — check Settings → Speech-to-Text.'
          defaultStore.speech.value.listening = false
          defaultStore.speech.value.stop()
          break
        case 'audio-capture':
          // Deepgram-specific: getUserMedia failed (mic permission / device).
          desc = 'Microphone unavailable — check mic permissions and the selected input device.'
          defaultStore.speech.value.listening = false
          defaultStore.speech.value.stop()
          break
        case 'websocket':
          // Deepgram-specific: transient WebSocket error. Do NOT stop() or clear
          // `listening` here — the socket's onclose handler auto-reconnects with
          // exponential backoff, and stopping would disable that recovery. Just warn.
          defaultStore.show_snackbar('warning', 'Deepgram connection hiccup — reconnecting…')
          return
        case 'max-reconnect':
          // Deepgram-specific: reconnection gave up after repeated failures — terminal.
          desc = 'Lost connection to Deepgram after several retries — check the internet, then toggle the mic to restart captions.'
          defaultStore.speech.value.listening = false
          defaultStore.speech.value.stop()
          break
        case 'network':
          desc = i18n.t('snackbar.speech_recognition_error_event.network')
          defaultStore.speech.value.stop()
          break
        case 'not-allowed':
          desc = i18n.t('snackbar.speech_recognition_error_event.not_allowed')
          defaultStore.speech.value.listening = false
          defaultStore.speech.value.stop()
          break
        case 'service-not-allowed':
          desc = i18n.t('snackbar.speech_recognition_error_event.service_not_allowed')
          defaultStore.speech.value.listening = false
          defaultStore.speech.value.stop()
          break
        case 'bad-grammar':
          desc = i18n.t('snackbar.speech_recognition_error_event.bad_grammar')
          defaultStore.speech.value.listening = false
          defaultStore.speech.value.stop()
          break
        case 'language-not-supported':
          desc = i18n.t('snackbar.speech_recognition_error_event.language_not_supported')
          break
        default:
          desc = i18n.t('snackbar.speech_recognition_error_event.unknown')
          break
      }

      defaultStore.show_snackbar('error', desc)
    }

    defaultStore.speech.value.onresult = (transcript: string, isFinal: boolean) => {
      const logsStore = useLogsStore()

      if (!isFinal) {
        // Interim result: update via debounced setter (prevents rapid flickering)
        logsStore.setInterim(transcript)
        return
      }

      // Final result: only process if there's actual text
      // Don't clear interim for empty finals (silence) - keep showing last text
      if (!transcript || !transcript.trim()) {
        return
      }

      const log = {
        transcript,
        isFinal,
        isTranslationFinal: false,
        translate: false,
        hide: 0, // 1 = fade, 2 = hide
      }

      // Add to logs FIRST, then clear interim (prevents flash where text disappears)
      on_submit(log, logsStore.logs.length)
      logsStore.clearInterim()
    }

    defaultStore.speech.value.onstart = () => {
      if (defaultStore.speech.value.last_error === 'network') {
        clearTimeout(defaultStore.speech.value.try_restart_interval)
      }
    }

    if (defaultStore.speech.value.listening) {
      // Auto-enable broadcasting when the mic starts so an operator can't run a live
      // service that captions nothing to the phones/projector. The operator can still
      // toggle it off afterward (and is warned if they do — see toggle_broadcast).
      if (!defaultStore.broadcasting) {
        const connectionsStore = useConnectionsStore()
        connectionsStore.toggle_broadcast()
      }
      defaultStore.speech.value.start()
    }
    else {
      defaultStore.speech.value.stop()
    }
  }

  function submit_text(input_text: string, input_index: number, isFinal: boolean) {
    const connectionsStore = useConnectionsStore()
    const logsStore = useLogsStore()
    const defaultStore = useDefaultStore()

    post_to_user_webhooks(input_text, isFinal)

    if (input_text) {
      if (input_index === logsStore.logs.length - 1) {
        logsStore.logs[input_index].transcript = input_text
      }
      else {
        const log = {
          transcript: input_text,
          isFinal: false,
          isTranslationFinal: false,
          translate: false,
          hide: 0, // 1 = fade, 2 = hide
        }
        logsStore.logs.push(log)
      }

      const wsPayload = JSON.stringify(logsStore.logs[input_index])
      const rendered_payload = `{"type": "text", "data": ${wsPayload}}`

      for (const openConnection of connectionsStore.open.user_websockets) {
        if (openConnection) openConnection.send(rendered_payload)
      }

      // Broadcast to HTTP server display clients ONLY for final results (prevents blinking)
      if (defaultStore.broadcasting && is_electron() && isFinal) {
        window.ipcRenderer.send('httpserver-broadcast', rendered_payload)
      }
    }
    else if (input_index === logsStore.logs.length - 1) {
      logsStore.logs[input_index].transcript = input_text
    }
  }

  function typing_event(event: boolean) {
    const defaultStore = useDefaultStore()

    if (is_electron() && !defaultStore.typing_limited) {
      defaultStore.typing_limited = true
      window.ipcRenderer.send('typing-text-event', event)
      setTimeout(() => defaultStore.typing_limited = false, 6 * 1000)
    }
  }

  async function speak(input: string) {
    const { speech } = useDefaultStore()
    speech.speak(input)
  }

  async function on_submit(log: any, index: number) {
    if (!log.transcript.trim()) // If the submitted input is only whitespace, do nothing. This may occur if the user only submitted whitespace.
      return

    const { text } = useAppearanceStore()
    const connectionsStore = useConnectionsStore()
    const defaultStore = useDefaultStore()
    const logsStore = useLogsStore()
    const settingsStore = useSettingsStore()
    const translationStore = useTranslationStore()
    const { replace_words } = useWordReplaceStore()
    const multiTranslationStore = useMultiTranslationStore()

    logsStore.loading_result = true

    // Apply speaker profile custom vocabulary first
    const speakerProfilesStore = useSpeakerProfilesStore()
    log.transcript = speakerProfilesStore.applyVocabulary(speakerProfilesStore.activeProfileId, log.transcript)

    // word replace
    log.transcript = replace_words(log.transcript)

    // Apply profanity filter with church context awareness
    log.transcript = filterProfanity(log.transcript, false) // false = not strict mode, allows contextual religious words

    if (!log.transcript.trim()) { // If the processed input is only whitespace, do nothing. This may occur if the entire log transcript was replaced with whitespace.
      logsStore.loading_result = false

      return
    }

    // scroll to bottom
    const loglist = document.getElementById('log-list')
    if (loglist)
      loglist.scrollTop = loglist.scrollHeight

    // Determine if we're updating existing entry or adding new
    let i: number
    if (index < logsStore.logs.length && logsStore.logs[index]) {
      // Update existing entry (e.g., from footer text edit)
      logsStore.logs[index] = log
      i = index
    }
    else {
      // Add new entry (final speech result or new text submission)
      logsStore.logs.push(log)
      i = logsStore.logs.length - 1
    }

    // Apply rolling window to prevent memory bloat during long sessions
    // Only trim when adding final transcriptions to avoid disrupting interim updates
    if (log.isFinal) {
      logsStore.trimLogs()
    }

    // new line delay
    if (logsStore.wait_interval)
      clearTimeout(logsStore.wait_interval)
    if (text.new_line_delay >= 0 && logsStore.logs.length > 0) {
      logsStore.wait_interval = setTimeout(() => {
        if (logsStore.logs.length > 0) {
          logsStore.logs[logsStore.logs.length - 1].pause = true
        }
      }, text.new_line_delay * 1000)
    }

    // finalized text
    if (log.isFinal) {
      logsStore.loading_result = false

      // Add to multi-translation system
      const logIndex = multiTranslationStore.addTranslationLog(log.transcript, true)
      logsStore.countWords(log.transcript)

      // Multi-language translation - works independently of main translation toggle
      // ONLY translate final results to reduce API usage (skip interim results)
      if (is_electron() && multiTranslationStore.enabledStreams.length > 0 && !log.translate && log.isFinal) {
        if (translationStore.openai_api_key) {
          window.ipcRenderer.send('set-translation-api-key', translationStore.openai_api_key)
        } else {
          console.warn('[Speech] No OpenAI API key set! Translations will fail.')
        }

        // Queue translations for all enabled languages
        translationQueue.addMultiLanguageTasks(
          log.transcript,
          translationStore.source,
          logIndex,
        )
      }

      // Single translation - only when main translation toggle is enabled
      // Skip if multi-language is active to avoid duplicate translations
      if (is_electron() && translationStore.enabled && !log.translate && !log.translation && multiTranslationStore.enabledStreams.length === 0) {
        // Bounds check after trim
        if (i < logsStore.logs.length && logsStore.logs[i]) {
          logsStore.logs[i].translate = true
        }

        // Send API key to worker if it's set (in case multi-language didn't run)
        if (translationStore.openai_api_key) {
          window.ipcRenderer.send('set-translation-api-key', translationStore.openai_api_key)
        }

        // Standard single translation
        window.ipcRenderer.send('transformers-translate', {
          text: log.transcript,
          src_lang: translationStore.source,
          tgt_lang: translationStore.target,
          index: i,
        })
      }

      // Bounds check after trim - prevent accessing undefined index
      if (i < logsStore.logs.length && logsStore.logs[i]) {
        // timestamp
        logsStore.logs[i].time = new Date()
        // text-to-speech
        if (tts.value.enabled && tts.value.voice)
          speak(log.transcript)
      }

      // fadeout text
      if (text.enable_fade) {
        setTimeout(() => {
          // Bounds check in async callback
          if (i >= logsStore.logs.length || !logsStore.logs[i] || !logsStore.logs[i].pause)
            return

          let pauses = 0
          let currentIndex = i
          // fade out all text since last pause
          while (currentIndex >= 0 && pauses < 2) {
            // Bounds check - log may have been trimmed
            const currentLog = logsStore.logs[currentIndex]
            if (!currentLog) break

            currentLog.hide = 1
            // Capture reference to the log object instead of using index
            // This prevents race condition if array is trimmed before nested timeout fires
            const logRef = currentLog
            setTimeout(() => {
              logRef.hide = 2
            }, text.fade_time * 1000)

            if (currentLog.pause)
              pauses += 1
            currentIndex -= 1
          }
        }, text.hide_after * 1000)
      }
    }

    // send text via WebSockets and webhooks
    // Only broadcast final results and translations to prevent interim noise
    if (defaultStore.broadcasting && (log.isFinal || log.translation)) {
      const wsPayload = JSON.stringify(log)
      const fullMessage = `{"type": "text", "data": ${wsPayload}}`

      // Send to user WebSockets
      for (const openConnection of connectionsStore.open.user_websockets) {
        if (openConnection) openConnection.send(fullMessage)
      }

      // Broadcast English transcripts to HTTP server display clients (for mobile /english stream)
      // Note: Translation broadcasts are handled in translation_queue.ts when translations complete
      if (is_electron() && log.isFinal && !log.translation) {
        window.ipcRenderer.send('httpserver-broadcast', fullMessage)
      }

      // Post to user webhooks
      post_to_user_webhooks(log.transcript, true)
    }
  }

  interface Voice {
    lang: string
    name: string
    local_service: boolean
  }
  function load_voices(option: string): Voice[] {
    const synth = window.speechSynthesis
    return synth.getVoices().map((lang: SpeechSynthesisVoice) => ({
      lang: lang.lang,
      name: lang.name,
      local_service: lang.localService,
    } as Voice))
  }

  function pin_language(selected_language: ListItem) {
    const pins = pinned_languages

    // Pin
    pins.value[selected_language.title] = selected_language

    // Alphabetically sort
    const sortedKeys = Object.keys(pins.value).sort()
    const sortedPins = {} as PinnedLanguages

    sortedKeys.forEach((key) => {
      sortedPins[key] = pins.value[key]
    })

    pinned_languages.value = sortedPins
  }

  function unpin_language(selected_language: ListItem) {
    const pins = pinned_languages

    // Unpin
    delete pins.value[selected_language.title]
  }

  function is_pinned_language(selected_language: ListItem) {
    const pins = pinned_languages

    return pins.value.hasOwnProperty(selected_language.title)
  }

  function post_to_user_webhooks(text: any, is_final: boolean) {
    const connectionsStore = useConnectionsStore()

    for (const wh of connectionsStore.user_webhooks) {
      if (wh.enabled) {
        console.log(`Webhook (${wh.title}) is posting to ${wh.webhook!.address_full}.`)
        webhook.post(wh.webhook!.address_full, { transcript: text, isFinal: is_final })
      }
    }
  }

  return {
    stt,
    tts,
    pinned_languages,
    reset,
    initialize_speech,
    toggle_listen,
    submit_text,
    typing_event,
    speak,
    on_submit,
    load_voices,
    pin_language,
    unpin_language,
    is_pinned_language,
  }
})
