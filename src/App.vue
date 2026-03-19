<template>
  <v-app>
    <SystemBar v-if="is_electron()" />
    <router-view name="Header" />
    <v-main>
      <router-view />
    </v-main>
    <router-view name="Footer" />
  </v-app>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppearanceStore } from '@/stores/appearance'
import { useWordReplaceStore } from '@/stores/word_replace'
import { useSettingsStore } from '@/stores/settings'
import { useSpeechStore } from '@/stores/speech'
import { useTranslationStore } from '@/stores/translation'
import { useConnectionsStore } from '@/stores/connections'
import { useHttpServerStore } from '@/stores/httpserver'
import { useMultiTranslationStore } from '@/stores/multi_translation'
import { useSpeakerProfilesStore } from '@/stores/speaker_profiles'
import { global_langs } from '@/plugins/i18n'

import is_electron from '@/helpers/is_electron'
import { translationQueue } from '@/helpers/translation_queue'
import { startStatsReporter } from '@/helpers/stats_reporter'

import SystemBar from '@/components/appbars/SystemBar.vue'
import migrate_to_v0_5_0 from '@/migration/migrate_to_v0.5.0'

const { locale } = useI18n()

declare const window: any

const appearanceStore = useAppearanceStore()
const speechStore = useSpeechStore()
const wordReplaceStore = useWordReplaceStore()
const translationStore = useTranslationStore()
const multiTranslationStore = useMultiTranslationStore()
const settingsStore = useSettingsStore()
const connectionsStore = useConnectionsStore()
const httpServerStore = useHttpServerStore()
const speakerProfilesStore = useSpeakerProfilesStore()

const router = useRouter()

// Set up store subscriptions to save to localStorage
appearanceStore.$subscribe((_, state) => {
  localStorage.setItem('appearance', JSON.stringify(state))
})
speechStore.$subscribe((_, state) => {
  localStorage.setItem('speech', JSON.stringify(state))
})
settingsStore.$subscribe((_, state) => {
  localStorage.setItem('settings', JSON.stringify(state))
})
wordReplaceStore.$subscribe((_, state) => {
  localStorage.setItem('word_replace', JSON.stringify(state))
})
translationStore.$subscribe((_, state) => {
  localStorage.setItem('translation', JSON.stringify(state))
})
connectionsStore.$subscribe((_, state) => {
  localStorage.setItem('connections', JSON.stringify(state))
})
httpServerStore.$subscribe((_, state) => {
  localStorage.setItem('httpserver', JSON.stringify(state))
})
speakerProfilesStore.$subscribe((_, state) => {
  localStorage.setItem('speaker_profiles', JSON.stringify(state))
})
multiTranslationStore.$subscribe((_, state) => {
  localStorage.setItem('multi_translation', JSON.stringify(state))
})

// CRITICAL: Load stores from localStorage FIRST, before using them
appearanceStore.$patch(JSON.parse(localStorage.getItem('appearance') || '{}'))
speechStore.$patch(JSON.parse(localStorage.getItem('speech') || '{}'))
settingsStore.$patch(JSON.parse(localStorage.getItem('settings') || '{}'))
wordReplaceStore.$patch(JSON.parse(localStorage.getItem('word_replace') || '{}'))
translationStore.$patch(JSON.parse(localStorage.getItem('translation') || '{}'))
connectionsStore.$patch(JSON.parse(localStorage.getItem('connections') || '{}'))
httpServerStore.$patch(JSON.parse(localStorage.getItem('httpserver') || '{}'))
speakerProfilesStore.$patch(JSON.parse(localStorage.getItem('speaker_profiles') || '{}'))
multiTranslationStore.$patch(JSON.parse(localStorage.getItem('multi_translation') || '{}'))

// Seed settings: on first launch, load pre-configured keys from seed file
// Created by install.sh — only applies if localStorage has no keys yet
if (is_electron() && !localStorage.getItem('_seed_applied')) {
  try {
    const seedPath = window.ipcRenderer ? null : null // resolved via IPC below
    window.ipcRenderer?.invoke('load-seed-settings').then((seed: any) => {
      if (seed) {
        console.log('[App] Applying seed settings from install')
        if (seed.speech) speechStore.$patch(seed.speech)
        if (seed.translation) translationStore.$patch(seed.translation)
        if (seed.httpserver) httpServerStore.$patch(seed.httpserver)
        localStorage.setItem('_seed_applied', 'true')
      }
    }).catch(() => {})
  } catch { /* no seed file, normal first run */ }
}

// NOW initialize translation queue with stores (after they're loaded from localStorage)
translationQueue.initialize(translationStore, multiTranslationStore)
console.log('[App.vue] Translation queue initialized with stores:', {
  hasTranslationStore: !!translationStore,
  hasMultiStore: !!multiTranslationStore,
  hasOpenAIKey: !!translationStore.openai_api_key,
  apiKeyLength: translationStore.openai_api_key?.length || 0,
})

// Initialize translation worker with API key if in Electron (after stores loaded!)
if (is_electron() && translationStore.openai_api_key) {
  console.log('[App.vue] Sending OpenAI API key to worker on startup, length:', translationStore.openai_api_key.length)
  window.ipcRenderer.send('set-translation-api-key', translationStore.openai_api_key)
} else if (is_electron()) {
  console.warn('[App.vue] No OpenAI API key found on startup - translations will fail until key is set')
}

if (is_electron())
  router.push('/')

// Migration code – start
if (settingsStore.config_version < 1) {
  migrate_to_v0_5_0()
  settingsStore.config_version = 1
}
// Enable HTTP server by default (one-time migration)
if (settingsStore.config_version < 2) {
  httpServerStore.enabled = true
  settingsStore.config_version = 2
}
// Migration code – end

// Auto-start HTTP server if enabled
if (is_electron() && httpServerStore.enabled) {
  console.log('[App.vue] Auto-starting HTTP server on port', httpServerStore.port)
  window.ipcRenderer.invoke('httpserver-start', { port: httpServerStore.port })
    .then(() => {
      console.log('[App.vue] HTTP server auto-started successfully on port', httpServerStore.port)
    })
    .catch((error: Error) => {
      console.error('[App.vue] Failed to auto-start HTTP server:', error)
    })
}

settingsStore.languages = global_langs

onUnmounted(() => {
})
onMounted(() => {
  locale.value = settingsStore.language
  settingsStore.$subscribe((language, state) => {
    locale.value = settingsStore.language
  })

  startStatsReporter()

  // Handle remote commands from manager service
  window.ipcRenderer?.on('manager-command', (_event: any, cmd: any) => {
    if (cmd.action === 'toggle_server') {
      if (cmd.enabled) {
        window.ipcRenderer?.invoke('httpserver-start', { port: httpServerStore.port })
      } else {
        window.ipcRenderer?.invoke('httpserver-stop')
      }
    }
    if (cmd.action === 'toggle_tunnel') {
      if (cmd.enabled) {
        const config: any = { httpPort: httpServerStore.port }
        if (httpServerStore.tunnelMode === 'named' && httpServerStore.tunnelToken) {
          config.token = httpServerStore.tunnelToken
          if (httpServerStore.tunnelHostname) {
            config.customHostname = httpServerStore.tunnelHostname.startsWith('http')
              ? httpServerStore.tunnelHostname
              : `https://${httpServerStore.tunnelHostname}`
          }
        }
        window.ipcRenderer?.invoke('cloudflare-tunnel-start', config)
      } else {
        window.ipcRenderer?.invoke('cloudflare-tunnel-stop')
      }
    }
    if (cmd.action === 'toggle_mic') {
      speechStore.toggle_listen()
    }
  })
})
</script>

<style>
.pointer {
  cursor: pointer;
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background-color: transparent; /* rgb(var(--v-theme-primary)); */
}

::-webkit-scrollbar-thumb {
  background: #4e4e4e; /* #a9a4e5 */
  border-radius: 10px;
}

/* blink keyframe */
.text-glow {
  color: rgba(var(--v-theme-secondary))
}

.blink {
  animation: blinker 1s cubic-bezier(.5, 0, 1, 1) infinite alternate;
}

@keyframes blinker {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
