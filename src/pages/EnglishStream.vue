<template>
  <v-card
    id="english-stream" class="fill-height pa-4 overflow-auto english-stream"
    :color="appearanceStore.ui.color" tile
  >
    <div class="stream-header mb-4">
      <h1 class="text-h4 text-center">
        English
      </h1>
      <p class="text-caption text-center text-disabled">
        Original Transcription
        <span v-if="!isConnected" class="text-warning">(Connecting...)</span>
      </p>
    </div>

    <div class="stream-content">
      <!-- Current interim from local store (only works in Electron windows) -->
      <div v-if="logsStore.currentInterim" class="interim-text">
        <span>{{ logsStore.currentInterim }}&nbsp;&nbsp;</span>
      </div>

      <!-- Display logs - either from localStorage (Electron) or WebSocket (mobile browser) -->
      <span
        v-for="(log, index) in displayLogs"
        :key="'log-' + index"
        class="final-text"
      >
        {{ log.transcript }}&nbsp;&nbsp;
      </span>

      <!-- Show message if no logs -->
      <div v-if="displayLogs.length === 0 && !logsStore.currentInterim" class="text-center text-disabled mt-8">
        <v-icon size="64" class="mb-4">
          mdi-microphone
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppearanceStore } from '@/stores/appearance'
import { useLogsStore } from '@/stores/logs'
import is_electron from '@/helpers/is_electron'

interface Log {
  transcript: string
  isFinal: boolean
  time?: string
}

const appearanceStore = useAppearanceStore()
const logsStore = useLogsStore()

// WebSocket connection for browser clients
const ws = ref<WebSocket | null>(null)
const isConnected = ref(false)
const wsLogs = ref<Log[]>([])

// Reconnection management
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const reconnectDelay = 2000
let isUnmounted = false

// Display logs: use localStorage logs in Electron, WebSocket logs in browser
const displayLogs = computed(() => {
  if (is_electron()) {
    // In Electron, use localStorage-synced logs
    return logsStore.logs.filter(log => log.isFinal && log.transcript && log.transcript.trim() !== '').slice(-50)
  } else {
    // In browser, use WebSocket-received logs
    return wsLogs.value.slice(-50)
  }
})

function connectWebSocket() {
  // Only connect via WebSocket in browser (not Electron)
  if (is_electron()) return

  // Don't connect if component has been unmounted
  if (isUnmounted) return

  // Determine WebSocket URL - use same host but port 8080
  const wsHost = window.location.hostname || 'localhost'
  const wsUrl = `ws://${wsHost}:8080`

  console.log('[EnglishStream] Connecting to WebSocket:', wsUrl)

  try {
    ws.value = new WebSocket(wsUrl)

    ws.value.onopen = () => {
      console.log('[EnglishStream] WebSocket connected')
      isConnected.value = true

      // Subscribe to English (no targetLang means we get all non-targeted broadcasts)
      // We don't need to subscribe to a specific language - English transcripts are broadcast without targetLang
    }

    ws.value.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        if (message.type === 'text' && message.data) {
          const log = message.data

          // Only show messages that are English transcripts (no targetLang = original English)
          // Skip translation-specific messages (those have targetLang set)
          if (!log.targetLang && log.transcript && log.isFinal) {
            console.log('[EnglishStream] Received transcript:', log.transcript.substring(0, 50))
            wsLogs.value.push({
              transcript: log.transcript,
              isFinal: log.isFinal,
              time: log.time,
            })

            // Limit to 50 most recent
            if (wsLogs.value.length > 50) {
              wsLogs.value.shift()
            }
          }
        }
      } catch (error) {
        console.error('[EnglishStream] Error parsing message:', error)
      }
    }

    ws.value.onclose = () => {
      console.log('[EnglishStream] WebSocket disconnected')
      isConnected.value = false
      ws.value = null

      // Auto-reconnect
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          connectWebSocket()
        }, reconnectDelay)
      }
    }

    ws.value.onerror = (error) => {
      console.error('[EnglishStream] WebSocket error:', error)
    }
  } catch (error) {
    console.error('[EnglishStream] Failed to create WebSocket:', error)
  }
}

onMounted(() => {
  connectWebSocket()
})

onUnmounted(() => {
  // Mark as unmounted to prevent any pending reconnection attempts
  isUnmounted = true

  // Clear reconnect timer BEFORE closing socket to prevent reconnection after unmount
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws.value) {
    // Remove event handlers to prevent reconnection attempts
    ws.value.onclose = null
    ws.value.onerror = null
    ws.value.onmessage = null
    ws.value.onopen = null
    ws.value.close()
    ws.value = null
  }
})
</script>

<style scoped>
.english-stream {
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
  opacity: 0.8;
}

.stream-header {
  position: sticky;
  top: 0;
  background: inherit;
  z-index: 1;
  padding: 16px 0;
}
</style>
