<template>
  <v-card
    id="language-stream" ref="streamContentRef" class="fill-height pa-4 overflow-auto language-stream"
    :color="appearanceStore.ui.color" tile
  >
    <div class="stream-header mb-4">
      <h1 class="text-h4 text-center">
        {{ languageName }}
      </h1>
      <p class="text-caption text-center text-disabled">
        Stream: {{ route.params.lang }}
      </p>
    </div>

    <div class="stream-content">
      <div
        v-for="(log, index) in displayLogs"
        :key="index"
        :class="{ 'final-text': log.isFinal, 'interim-text': !log.isFinal }"
        class="stream-log"
      >
        {{ log.translation }}&nbsp;&nbsp;
      </div>

      <div v-if="displayLogs.length === 0" class="text-center text-disabled mt-8">
        <v-icon size="64" class="mb-4">
          mdi-translate
        </v-icon>
        <p>Waiting for translations...</p>
        <p class="text-caption">
          Start speaking in the main app
        </p>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppearanceStore } from '@/stores/appearance'
import { useMultiTranslationStore } from '@/stores/multi_translation'
import { useLogsStore } from '@/stores/logs'
import { useTranslationStore } from '@/stores/translation'
import { translationQueue } from '@/helpers/translation_queue'
import is_electron from '@/helpers/is_electron'

console.log('[LanguageStream] COMPONENT IS LOADING!!!')

const route = useRoute()
console.log('[LanguageStream] Route params:', route.params)
console.log('[LanguageStream] Route path:', route.path)

const appearanceStore = useAppearanceStore()
const multiTranslationStore = useMultiTranslationStore()
const logsStore = useLogsStore()
const translationStore = useTranslationStore()

// Check if running in browser (not Electron)
const isBrowser = !is_electron()

// Initialize translation queue for browser mode
onMounted(() => {
  console.log('[LanguageStream] Initializing translation queue')
  translationQueue.initialize(translationStore, multiTranslationStore)
  console.log('[LanguageStream] Translation queue initialized')
})

const streamContentRef = ref<HTMLElement | null>(null)

const languageId = computed(() => route.params.lang as string)

const languageStream = computed(() => {
  return multiTranslationStore.languageStreams.find(s => s.id === languageId.value)
})

const languageName = computed(() => {
  return languageStream.value?.name || 'Unknown Language'
})

const targetLang = computed(() => {
  return languageStream.value?.targetLang || ''
})

// Smaller font size for browser, normal size for Electron
const fontSize = computed(() => {
  if (isBrowser) {
    return Math.max(12, appearanceStore.text.font_size * 0.6) // 60% of normal size, minimum 12px
  }
  return appearanceStore.text.font_size
})

const displayLogs = computed(() => {
  // Get translations for this specific language
  if (!targetLang.value) {
    return []
  }

  console.log('DisplayLogs computed, targetLang:', targetLang.value)
  console.log('MultiLogs length:', multiTranslationStore.multiLogs.length)

  // If we have multiLogs, use them (proper multi-language system)
  if (multiTranslationStore.multiLogs.length > 0) {
    const logs = multiTranslationStore.getLogsForLanguage(targetLang.value)
    console.log('Logs from getLogsForLanguage:', logs)
    // Only show logs that have a translation (filter out untranslated text)
    const filtered = logs.filter(log => log.translation && log.translation.trim() !== '')

    // Note: The 400ms throttle in multi_translation store already prevents rapid updates
    // Combined with 3-second scroll cooldown, this provides stable viewing on browsers

    console.log('Filtered logs with translations:', filtered)
    return filtered
  }

  // Fallback: if no multiLogs, show nothing (don't fall back to regular logs)
  console.log('No multiLogs available')
  return []
})

// Auto-scroll to bottom when new logs appear
// Much slower scroll for browser to improve mobile readability
let scrollTimeout: ReturnType<typeof setTimeout> | null = null
watch(displayLogs, async () => {
  await nextTick()

  // For browser, use long cooldown to prevent constant scrolling
  if (isBrowser) {
    if (scrollTimeout) return // Skip if we're in cooldown

    scrollTimeout = setTimeout(() => {
      scrollTimeout = null
    }, 3000) // 3 second cooldown between scrolls for browser
  }

  if (streamContentRef.value?.$el) {
    const element = streamContentRef.value.$el
    element.scrollTo({
      top: element.scrollHeight,
      behavior: isBrowser ? 'smooth' : 'auto' // Smooth for browser, instant for Electron
    })
  }
}, { deep: true })

// No need to sync - translations are automatically populated by the translation_queue system
// which listens to 'transformers-translate-render-multi' events and updates multiLogs
</script>

<style scoped>
.language-stream {
  display: flex;
  flex-direction: column;
  font-family: v-bind('appearanceStore.text.font.name');
  font-style: v-bind('appearanceStore.text.font.sub_type.style');
  font-weight: v-bind('appearanceStore.text.font.sub_type.weight');
  font-size: v-bind('`${fontSize}px`');
  overflow-y: auto;
  max-height: 100vh;
}

.stream-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.stream-log {
  margin-bottom: 8px;
  padding: 4px;
}

.final-text {
  color: v-bind('appearanceStore.text.color');
  opacity: 1;
}

.interim-text {
  color: v-bind('appearanceStore.text.interim_color');
  opacity: 0.7;
}

.stream-header {
  position: sticky;
  top: 0;
  background: inherit;
  z-index: 1;
  padding: 16px 0;
}
</style>
