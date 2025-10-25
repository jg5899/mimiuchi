<template>
  <v-card
    title="Multi-Language Streams" subtitle="Configure simultaneous translation output streams"
    color="transparent" flat
  >
    <v-divider />
    <v-card-text>
      <v-alert type="info" variant="outlined" class="mb-4">
        Open language stream URLs in separate windows/tabs to display multiple translations simultaneously.
        Each stream will show transcriptions and translations in real-time.
      </v-alert>

      <v-row>
        <v-col :cols="12">
          <h3 class="mb-2">
            Available Language Streams
          </h3>
          <p class="text-caption text-disabled mb-4">
            Toggle streams on/off and copy URLs to open in new windows
          </p>
        </v-col>
      </v-row>

      <v-row>
        <v-col
          v-for="stream in multiTranslationStore.languageStreams"
          :key="stream.id"
          :cols="12"
          :sm="6"
        >
          <v-card variant="outlined" :color="stream.enabled ? 'primary' : 'default'">
            <v-card-title class="d-flex align-center justify-space-between">
              {{ stream.name }}
              <v-switch
                v-model="stream.enabled"
                color="primary"
                hide-details
                inset
                @update:model-value="multiTranslationStore.toggleLanguageStream(stream.id)"
              />
            </v-card-title>
            <v-card-text>
              <v-text-field
                :model-value="getStreamUrl(stream.route)"
                label="Stream URL"
                readonly
                variant="outlined"
                density="compact"
                hide-details
              >
                <template #append-inner>
                  <v-btn
                    icon="mdi-content-copy"
                    variant="text"
                    size="small"
                    @click="copyToClipboard(getStreamUrl(stream.route))"
                  />
                  <v-btn
                    icon="mdi-open-in-new"
                    variant="text"
                    size="small"
                    @click="openStream(stream.route)"
                  />
                </template>
              </v-text-field>
              <p class="text-caption mt-2">
                Target: <code>{{ stream.targetLang }}</code>
              </p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-divider class="my-6" />

      <v-row>
        <v-col :cols="12">
          <h3 class="mb-2">
            Translation Settings
          </h3>
          <p class="text-caption text-disabled mb-4">
            Configure how translations work across all streams
          </p>
        </v-col>
      </v-row>

      <v-row>
        <v-col :cols="12">
          <v-card flat>
            <v-list-item title="Enable multi-language translation">
              <template #subtitle>
                Translate transcriptions to all enabled language streams
              </template>
              <template #append>
                <v-switch
                  v-model="multiLanguageEnabled"
                  color="primary"
                  hide-details
                  inset
                />
              </template>
            </v-list-item>
          </v-card>
        </v-col>

        <v-col :cols="12">
          <v-alert type="warning" variant="outlined">
            <strong>Note:</strong> Translation requires Electron version. For web version,
            language streams will display the original transcription. Enable translation in
            Settings > Translation to use this feature.
          </v-alert>
        </v-col>
      </v-row>

      <v-divider class="my-6" />

      <v-row>
        <v-col :cols="12">
          <h3 class="mb-2">
            Quick Actions
          </h3>
        </v-col>
        <v-col :cols="12">
          <v-btn
            color="primary"
            prepend-icon="mdi-window-restore"
            @click="openAllStreams"
          >
            Open All Enabled Streams
          </v-btn>
          <v-btn
            color="error"
            variant="outlined"
            class="ml-2"
            prepend-icon="mdi-delete"
            @click="clearLogs"
          >
            Clear All Logs
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMultiTranslationStore } from '@/stores/multi_translation'

const multiTranslationStore = useMultiTranslationStore()
const multiLanguageEnabled = ref(true)

function getStreamUrl(route: string): string {
  const baseUrl = window.location.origin + window.location.pathname
  return baseUrl.replace(/\/$/, '') + route
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

function openStream(route: string) {
  window.open(route, '_blank')
}

function openAllStreams() {
  multiTranslationStore.enabledStreams.forEach((stream) => {
    openStream(stream.route)
  })
}

function clearLogs() {
  if (confirm('Are you sure you want to clear all translation logs?')) {
    multiTranslationStore.clearLogs()
  }
}
</script>
