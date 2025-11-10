<template>
  <v-card
    id="language-stream" class="fill-height overflow-hidden language-stream"
    :color="appearanceStore.ui.color" tile
  >
    <!-- Debug overlay - tap to toggle -->
    <div v-if="showDebug" class="debug-overlay" @click="showDebug = false">
      <div class="debug-content">
        <p><strong>Debug Info</strong> (tap to hide)</p>
        <p>Language: {{ languageName }} ({{ targetLang }})</p>
        <p>WebSocket: {{ wsConnected ? '✓ Connected' : '✗ Disconnected' }}</p>
        <p>MultiLogs total: {{ multiTranslationStore.multiLogs.length }}</p>
        <p>DisplayLogs: {{ displayLogs.length }}</p>
        <p>Last update: {{ lastUpdateTime }}</p>
        <p v-if="lastTranslation">Last translation: {{ lastTranslation.substring(0, 50) }}...</p>
      </div>
    </div>

    <!-- Compact header - only show on mobile if no content yet -->
    <div v-if="displayLogs.length === 0" class="empty-state">
      <v-icon size="48" class="mb-2 text-disabled">
        mdi-translate
      </v-icon>
      <p class="text-body-2 text-disabled">{{ languageName }}</p>
      <p class="text-caption text-disabled">
        Waiting for translations...
      </p>
      <v-btn size="small" variant="outlined" class="mt-4" @click="showDebug = true">
        Show Debug Info
      </v-btn>
    </div>

    <!-- Text content - fills screen like main view -->
    <div v-else class="stream-content" ref="contentRef">
      <div
        v-for="(log, index) in displayLogs"
        :key="index"
        class="translation-line"
        :class="{
          'fade-out': log.hide,
          'final-text': log.isFinal,
          'interim-text': !log.isFinal
        }"
      >
        <span v-if="log.hide !== 2">{{ log.translation }}</span>
      </div>

      <!-- Floating debug button when content is showing -->
      <v-btn
        class="debug-button"
        icon="mdi-bug"
        size="small"
        variant="tonal"
        @click="showDebug = true"
      />
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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

// Debug overlay
const showDebug = ref(false)
const wsConnected = ref(false)
const lastTranslation = ref('')
const lastUpdateTime = ref('Never')

// Force refresh for fade/hide updates
const forceRefresh = ref(0)
let refreshInterval: ReturnType<typeof setInterval> | null = null

// Initialize translation queue for browser mode
onMounted(() => {
  console.log('[LanguageStream] Initializing translation queue')
  translationQueue.initialize(translationStore, multiTranslationStore)
  console.log('[LanguageStream] Translation queue initialized')

  // Refresh every second to update fade/hide states
  refreshInterval = setInterval(() => {
    forceRefresh.value++
  }, 1000)
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

// Slightly smaller for mobile (90%), full size for Electron
const fontSize = computed(() => {
  if (isBrowser) {
    return Math.floor(appearanceStore.text.font_size * 0.9)
  }
  return appearanceStore.text.font_size
})

const displayLogs = computed(() => {
  // Force re-computation when forceRefresh changes (for fade/hide updates)
  forceRefresh.value

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
    const filtered = logs
      .filter(log => log.translation && log.translation.trim() !== '')
      .map((log, index) => {
        // For browser/remote clients, don't apply fade/hide based on timestamps
        // since the timestamps are from the source machine and would make everything instantly "old"
        // Only apply fade/hide for Electron (local) clients
        let hide = 0

        if (!isBrowser && appearanceStore.text.enable_fade && appearanceStore.text.hide_after > 0) {
          const now = Date.now()
          const logTime = log.time ? new Date(log.time).getTime() : now
          const ageSeconds = (now - logTime) / 1000

          const fadeStart = appearanceStore.text.hide_after
          const fadeEnd = fadeStart + appearanceStore.text.fade_time

          if (ageSeconds >= fadeEnd) {
            hide = 2 // Fully hidden
          } else if (ageSeconds >= fadeStart) {
            hide = 1 // Fading out
          }
        }

        return {
          ...log,
          hide
        }
      })
      .filter(log => log.hide !== 2) // Remove fully hidden logs

    console.log('Filtered logs with translations:', filtered)

    // Only keep last 10 translations to prevent lag and reduce clutter
    return filtered.slice(-10)
  }

  // Fallback: if no multiLogs, show nothing (don't fall back to regular logs)
  console.log('No multiLogs available')
  return []
})

// Watch for translations and update debug info
watch(() => multiTranslationStore.multiLogs, (logs) => {
  if (logs.length > 0) {
    lastUpdateTime.value = new Date().toLocaleTimeString()
    const latestLog = logs[logs.length - 1]
    const translation = latestLog.translations[targetLang.value]
    if (translation) {
      lastTranslation.value = translation
    }
  }
}, { deep: true })

// Smart scroll - one line at a time, only if user is near the bottom
const contentRef = ref<HTMLElement | null>(null)
let scrollAnimationFrame: number | null = null
let previousLogCount = 0

const isNearBottom = (element: HTMLElement, threshold: number = 100): boolean => {
  const scrollBottom = element.scrollHeight - element.scrollTop - element.clientHeight
  return scrollBottom < threshold
}

const smoothScrollBy = (element: HTMLElement, distance: number, duration: number = 300) => {
  const start = element.scrollTop
  const end = start + distance
  const startTime = performance.now()

  // Cancel any ongoing animation
  if (scrollAnimationFrame !== null) {
    cancelAnimationFrame(scrollAnimationFrame)
  }

  const easeInOutQuad = (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
  }

  const animateScroll = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = easeInOutQuad(progress)

    element.scrollTop = start + distance * eased

    if (progress < 1) {
      scrollAnimationFrame = requestAnimationFrame(animateScroll)
    } else {
      scrollAnimationFrame = null
    }
  }

  scrollAnimationFrame = requestAnimationFrame(animateScroll)
}

watch(displayLogs, async (newLogs, oldLogs) => {
  await nextTick()

  if (contentRef.value && isNearBottom(contentRef.value, 100)) {
    // Only scroll if new items were added (not just updates to existing items)
    const newItemsAdded = newLogs.length > (oldLogs?.length || 0)

    if (newItemsAdded) {
      // Get the last translation line element to measure its height
      const lines = contentRef.value.querySelectorAll('.translation-line')
      const lastLine = lines[lines.length - 1] as HTMLElement

      if (lastLine) {
        // Scroll by the height of the newly added line
        const lineHeight = lastLine.offsetHeight
        smoothScrollBy(contentRef.value, lineHeight, 300)
      }
    }
  }
}, { deep: true })

// Cleanup on unmount
onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  if (scrollAnimationFrame !== null) {
    cancelAnimationFrame(scrollAnimationFrame)
  }
})

// No need to sync - translations are automatically populated by the translation_queue system
// which listens to 'transformers-translate-render-multi' events and updates multiLogs
</script>

<style scoped>
.language-stream {
  font-family: v-bind('appearanceStore.text.font.name');
  font-style: v-bind('appearanceStore.text.font.sub_type.style');
  font-weight: v-bind('appearanceStore.text.font.sub_type.weight');
  font-size: v-bind('`${fontSize}px`');
  text-align: left;
  line-height: 1.5;
  padding: 16px;
  overflow-y: auto;
  position: relative;
}

.debug-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.debug-content {
  background: #1e1e1e;
  color: #fff;
  padding: 20px;
  border-radius: 8px;
  max-width: 500px;
  width: 100%;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.6;
}

.debug-content p {
  margin: 8px 0;
}

.debug-button {
  position: fixed !important;
  bottom: 20px;
  right: 20px;
  z-index: 100;
  opacity: 0.7;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 32px;
}

.stream-content {
  display: block;
  height: 100vh;
  padding: 16px;
  padding-bottom: 80px; /* Space for debug button */
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
}

.stream-content::-webkit-scrollbar {
  display: none;
}

.translation-line {
  display: block;
  margin-bottom: 12px;
  line-height: 1.5;
}

.final-text {
  color: v-bind('appearanceStore.text.color');
}

.interim-text {
  color: v-bind('appearanceStore.text.interim_color');
  opacity: 0.7;
}

.fade-out {
  opacity: 0;
  transition: opacity v-bind('`${appearanceStore.text.fade_time}s`') ease;
}
</style>
