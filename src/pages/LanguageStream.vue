<template>
  <v-card
    id="language-stream" class="fill-height pa-4 overflow-auto language-stream"
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
      <!-- Continuous flowing text display, just like Home page -->
      <div>
        <span
          v-for="(log, index) in displayLogs"
          :key="index"
          :class="{ 'final-text': log.isFinal, 'interim-text': !log.isFinal }"
        >
          {{ log.translation }}&nbsp;&nbsp;
        </span>
      </div>

      <!-- Show message if no logs -->
      <div v-if="displayLogs.length === 0" class="text-center text-disabled mt-8">
        <v-icon size="64" class="mb-4">
          mdi-translate
        </v-icon>
        <p>Waiting for transcriptions...</p>
        <p class="text-caption">
          Start speaking in the main app
        </p>
      </div>

    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppearanceStore } from '@/stores/appearance'
import { useMultiTranslationStore } from '@/stores/multi_translation'
import { useLogsStore } from '@/stores/logs'

const route = useRoute()
const appearanceStore = useAppearanceStore()
const multiTranslationStore = useMultiTranslationStore()
const logsStore = useLogsStore()

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

const displayLogs = computed(() => {
  // Get translations for this specific language
  if (!targetLang.value) {
    return []
  }

  console.log('DisplayLogs computed, targetLang:', targetLang.value)
  console.log('MultiLogs length:', multiTranslationStore.multiLogs.length)
  console.log('Regular logs length:', logsStore.logs.length)

  // If we have multiLogs, use them (proper multi-language system)
  if (multiTranslationStore.multiLogs.length > 0) {
    const allLogs = multiTranslationStore.getLogsForLanguage(targetLang.value)

    // Filter to only show:
    // 1. Final results (reduce clutter from interim updates)
    // 2. Logs that have a translation for this language (no empty strings)
    const finalLogsWithTranslation = allLogs.filter(log =>
      log.isFinal && log.translation && log.translation.trim() !== ''
    )

    console.log(`Filtered to ${finalLogsWithTranslation.length} final logs with translation for ${targetLang.value}`)
    console.log('Sample log:', finalLogsWithTranslation[finalLogsWithTranslation.length - 1])

    // Limit to most recent 50 entries to prevent performance issues
    return finalLogsWithTranslation.slice(-50)
  }

  // Fallback: if no multiLogs yet, return empty array
  // (Don't fall back to regular logs - those don't have multi-language translations)
  return []
})

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
  font-size: v-bind('`${appearanceStore.text.font_size}px`');
  overflow-y: auto;
  max-height: 100vh;
}

.stream-content {
  flex: 1;
  display: flex;
  flex-direction: column-reverse;
  line-height: 1.6;
  word-wrap: break-word;
}

.final-text {
  color: v-bind('appearanceStore.text.color');
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
