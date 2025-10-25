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
      <div
        v-for="(log, index) in displayLogs"
        :key="index"
        :class="{ 'final-text': log.isFinal, 'interim-text': !log.isFinal }"
        class="stream-log"
      >
        {{ log.translation || log.transcript }}&nbsp;&nbsp;
      </div>

      <div class="text-center text-disabled mt-8">
        <v-icon size="64" class="mb-4">
          mdi-translate
        </v-icon>
        <p v-if="displayLogs.length === 0">Waiting for transcriptions...</p>
        <p v-else>{{ displayLogs.length }} logs found</p>
        <p class="text-caption">
          Start speaking in the main app
        </p>
        <p class="text-caption mt-4 text-info">
          Debug Info:
        </p>
        <p class="text-caption">
          Language ID: {{ languageId }}
        </p>
        <p class="text-caption">
          Language Name: {{ languageName }}
        </p>
        <p class="text-caption">
          Target Lang: {{ targetLang }}
        </p>
        <p class="text-caption">
          MultiLogs count: {{ multiTranslationStore.multiLogs.length }}
        </p>
        <p class="text-caption">
          Regular logs count: {{ logsStore.logs.length }}
        </p>
        <p class="text-caption">
          Display logs count: {{ displayLogs.length }}
        </p>
      </div>

      <div v-if="displayLogs.length > 0 && !displayLogs[0].translation" class="text-center text-warning mt-2 mb-4">
        <v-chip color="info" size="small" variant="outlined">
          <v-icon start size="small">mdi-information</v-icon>
          Showing {{ languageName }} original text (translation in progress...)
        </v-chip>
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
    return multiTranslationStore.getLogsForLanguage(targetLang.value)
  }

  // Fallback: show regular logs with translation (for backward compatibility)
  // This happens if translation was enabled on Home page before opening streams
  return logsStore.logs.map(log => ({
    transcript: log.transcript,
    translation: log.translation || '',
    isFinal: log.isFinal,
    time: log.time,
  }))
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
