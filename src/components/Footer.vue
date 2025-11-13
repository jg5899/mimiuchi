<template>
  <v-snackbar
    v-model="defaultStore.snackbar.enabled"
    :color="defaultStore.snackbar.type"
    location="top"
    :timeout="8000"
  >
    <v-row class="align-center justify-center">
      <v-col :cols="12">
        <p v-html="defaultStore.snackbar.desc" />
      </v-col>
    </v-row>
    <template #actions>
      <v-btn variant="text" @click="defaultStore.snackbar.enabled = false">
        Close
      </v-btn>
    </template>
  </v-snackbar>
  <v-footer app class="d-flex flex-column pl-2" :height="route.name === 'home' && appearanceStore.footer_size ? 200 : 55" permanent fixed>
    <div class="d-flex w-100 align-center">
      <v-form
        class="d-flex w-100 align-center"
        @submit.prevent="onSubmit()"
      >
        <div class="d-flex w-100">
          <v-textarea
            v-if="route.name === 'home' && appearanceStore.footer_size"
            v-model="input_text"
            variant="outlined"
            :label="t('general.type_message')"
            append-inner-icon="mdi-chevron-right"
            class="mr-6 mt-1 fill-height"
            rows="6"
            hide-details
            flat
            loading
            @keyup.enter="onSubmit()"
          >
            <template #loader>
              <v-progress-linear
                :active="logsStore.loading_result || translationStore.download >= 0"
                :color="translationStore.download !== -1 ? 'warning' : 'secondary'"
                :indeterminate="translationStore.download === -1"
                :model-value="translationStore.download"
                :max="100"
                height="5"
                rounded
              />
            </template>
          </v-textarea>

          <v-text-field
            v-else
            v-model="input_text"
            density="compact"
            variant="outlined"
            :label="t('general.type_message')"
            append-inner-icon="mdi-chevron-right"
            class="mr-6"
            single-line
            hide-details
            flat
            loading
          >
            <template #loader>
              <v-progress-linear
                :active="logsStore.loading_result || translationStore.download >= 0"
                :color="translationStore.download !== -1 ? 'warning' : 'secondary'"
                :indeterminate="translationStore.download === -1"
                :model-value="translationStore.download"
                :max="100"
                height="5"
                rounded
              />
            </template>
          </v-text-field>

          <v-spacer v-if="!smAndDown" />

          <div class="d-flex justify-right">
            <!-- Speaker Profile Switcher -->
            <v-btn-toggle
              v-if="route.name === 'home'"
              v-model="speakerProfilesStore.activeProfileId"
              class="mr-4"
              mandatory
              density="compact"
              @update:model-value="switchProfile"
            >
              <v-btn
                v-for="profile in speakerProfilesStore.profiles"
                :key="profile.id"
                :value="profile.id"
                size="small"
                variant="outlined"
              >
                {{ profile.name }}
              </v-btn>
            </v-btn-toggle>

            <v-icon-btn
              class="mr-4"
              :active="defaultStore.speech.value?.listening || false"
              active-color="success"
              color="error"
              active-icon="mdi-microphone"
              icon="mdi-microphone-off"
              active-variant="outlined"
              base-variant="outlined"
              icon-size="20"
              v-ripple
              @click="toggleListen"
            />
            <v-badge
              :model-value="!!defaultStore.connections_count"
              :content="defaultStore.connections_count ? defaultStore.connections_count : undefined" color="success"
              class="mr-4"
            >
              <v-icon-btn
                :active="defaultStore.broadcasting"
                active-color="success"
                color="error"
                active-icon="mdi-broadcast"
                icon="mdi-broadcast-off"
                active-variant="outlined"
                base-variant="outlined"
                icon-size="20"
                v-ripple
                @click="connectionsStore.toggle_broadcast()"
              />
            </v-badge>
            <v-divider height="50" class="mr-4" vertical />
            <v-icon-btn
              :active="route.name === 'home'"
              active-color=""
              active-icon="mdi-cog"
              icon="mdi-home"
              active-variant="text"
              base-variant="text"
              icon-size="20"
              v-ripple
              @click="router.push({ path: (route.name === 'home') ? last_setting : '/' })"
            />
          </div>
        </div>
      </v-form>
    </div>
  </v-footer>
</template>

<script setup lang="ts">
// import {ipcRenderer} from "electron"

import { computed, onMounted, onUnmounted, onUpdated, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import is_electron from '@/helpers/is_electron'

import { useAppearanceStore } from '@/stores/appearance'
import { useConnectionsStore } from '@/stores/connections'
import { useDefaultStore } from '@/stores/default'
import type { Log } from '@/stores/logs'
import { useLogsStore } from '@/stores/logs'
import { useSettingsStore } from '@/stores/settings'
import { useSpeechStore } from '@/stores/speech'
import { useTranslationStore } from '@/stores/translation'
import { useSpeakerProfilesStore } from '@/stores/speaker_profiles'
import { useMultiTranslationStore } from '@/stores/multi_translation'
import { translationQueue } from '@/helpers/translation_queue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

declare const window: any

const last_route = ref<any>(null)
const { smAndDown } = useDisplay()
const appearanceStore = useAppearanceStore()
const connectionsStore = useConnectionsStore()
const defaultStore = useDefaultStore()
const logsStore = useLogsStore()
const settingsStore = useSettingsStore()
const speechStore = useSpeechStore()
const translationStore = useTranslationStore()
const speakerProfilesStore = useSpeakerProfilesStore()
const multiTranslationStore = useMultiTranslationStore()

const input_text = ref('')
const input_index = ref<any>(null)

const windowSize = ref({
  x: 0,
  y: 0,
})

const last_setting = computed(() => {
  return (last_route.value && last_route.value.startsWith('/settings')) ? last_route.value : '/settings/general'
})

watch(input_text, () => {
  if (input_index.value === null) {
    input_index.value = logsStore.logs.length
  }
  if (settingsStore.realtime_text)
    speechStore.submit_text(input_text.value, input_index.value, false)
})

const { stt } = storeToRefs(speechStore)
watch(
  () => stt.value.language,
  (new_val) => {
    if (defaultStore.speech.value?.recognition) {
      defaultStore.speech.value.stop()
      defaultStore.speech.value.recognition.lang = new_val
    }
  },
  { deep: true },
)

onMounted(() => {
  onResize()
  reloadEvents()

  if (is_electron()) {
    // Speech
    window.ipcRenderer.on('transformers-translate-render', (event: any, data: any) => {
      translationStore.onMessageReceived(data)
    })
  }

  speechStore.initialize_speech(speechStore.stt.language)

  // Initialize translation queue
  translationQueue.initialize(translationStore, multiTranslationStore)
})

onUnmounted(() => {
  if (defaultStore.speech.value?.listening)
    toggleListen()

  if (defaultStore.broadcasting)
    connectionsStore.toggle_broadcast()

  if (is_electron()) {
    // Speech
    window.ipcRenderer.removeListener('transformers-translate-render')
  }
})

onUpdated(() => {
  reloadEvents()
  last_route.value = router.options.history.state.back
})

function switchProfile(profileId: string) {
  speakerProfilesStore.setActiveProfile(profileId)
  const profile = speakerProfilesStore.getActiveProfile()

  // Update speech recognition settings based on the active profile
  speechStore.stt.language = profile.language
  speechStore.stt.confidence = profile.confidence
  speechStore.stt.sensitivity = profile.sensitivity

  // Restart speech recognition if it's currently listening
  if (defaultStore.speech.value?.listening) {
    defaultStore.speech.value.stop()
    defaultStore.speech.value.recognition.lang = profile.language
    setTimeout(() => {
      defaultStore.speech.value.start()
    }, 100)
  } else {
    // Just update the language without restarting
    if (defaultStore.speech.value?.recognition) {
      defaultStore.speech.value.recognition.lang = profile.language
    }
  }
}

function toggleListen() {
  speechStore.toggle_listen()
}

function typing_event(event: boolean) {
  speechStore.typing_event(event)
}

async function onSubmit(log: Log | null = null) {
  if (log && !log.transcript)
    return

  if (!log) {
    log = {
      transcript: input_text.value,
      isFinal: true,
      isTranslationFinal: false,
      translate: false,
      hide: 0, // 1 = fade, 2 = hide
    }
  }

  speechStore.on_submit(log, input_index.value ?? Math.max(logsStore.logs.length - 1, 0))

  // clear chatbox
  input_text.value = ''
  input_index.value = null
}

function show_snackbar(type: string, desc: string) {
  defaultStore.snackbar.desc = desc
  defaultStore.snackbar.type = type
  defaultStore.snackbar.enabled = true
}

function onResize() {
  windowSize.value = { x: window.innerWidth, y: window.innerHeight }
}

function reloadEvents() {
}
</script>
