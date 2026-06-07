<template>
  <v-card :title="t('settings.stt.title')" :subtitle="t('settings.stt.description')" color="transparent" flat>
    <v-divider />
    <v-card-text>
      <v-row>
        <v-col :cols="12">
          <v-text-field
            v-model="speechStore.stt.deepgramApiKey"
            label="Deepgram API Key"
            type="password"
            variant="outlined"
            :hint="apiKeyHint"
            persistent-hint
            :color="apiKeyColor"
            :error="!speechStore.stt.deepgramApiKey"
            :error-messages="!speechStore.stt.deepgramApiKey ? ['API key required for speech recognition'] : []"
          />
        </v-col>
        <v-col :cols="12">
          <v-select
            v-model="speechStore.stt.inputDeviceId"
            :items="micItems"
            item-title="label"
            item-value="deviceId"
            label="Microphone / input device"
            variant="outlined"
            persistent-hint
            hint="Pick the actual mic or soundboard feed. Avoid virtual devices (Loopback, NDI, Aggregate) — they often carry no speech, which produces blank captions."
            prepend-inner-icon="mdi-microphone"
          >
            <template #append>
              <v-btn variant="text" icon="mdi-refresh" size="small" aria-label="Refresh device list" @click="loadMics" />
            </template>
          </v-select>
        </v-col>
        <v-col :cols="12">
          <v-alert type="success" variant="tonal" density="compact">
            <div class="text-caption">
              <strong>Deepgram Nova-3</strong><br><br>
              <strong>Pricing:</strong> ~$0.0077 per minute of audio (~$0.46/hour)<br>
              <strong>Features:</strong> True real-time streaming, handles music/singing, speaker diarization, custom keyword boost<br>
              <strong>Supported Languages:</strong> 30+ languages including English, Spanish, Ukrainian, Russian<br>
              <strong>How it works:</strong> Real-time WebSocket streaming - no chunking delays!
            </div>
          </v-alert>
        </v-col>
      </v-row>

      <v-row>
        <v-col :cols="12">
          <v-radio-group
            v-if="Object.keys(speechStore.pinned_languages).length > 0" v-model="speechStore.stt.language"
            :label="t('settings.stt.pinned_languages')"
          >
            <v-card
              v-for="language in speechStore.pinned_languages" class="language-card pa-2 mb-2"
              :color="language.value === speechStore.stt.language ? 'primary' : 'default'"
              @click="speechStore.stt.language = language.value"
            >
              <v-radio :label="language.title" :value="language.value">
                <template #label>
                  <div class="d-flex flex-grow-1 justify-space-between me-2">
                    <div>{{ language.title }}</div>
                    <div class="pin-icon">
                      <v-icon
                        v-if="!is_pinned_language(language)" class="pin-icon-not-pinned"
                        @click.prevent="pin_language(language)"
                      >
                        mdi-star-outline
                      </v-icon>
                      <v-icon v-else class="pin-icon-pinned" @click.prevent="unpin_language(language)">
                        mdi-star
                      </v-icon>
                    </div>
                  </div>
                </template>
              </v-radio>
            </v-card>
          </v-radio-group>
          <v-radio-group v-model="speechStore.stt.language" :label="t('settings.stt.language')">
            <v-text-field
              v-model="search_lang" class="mb-2" label="Search" variant="outlined" single-line
              hide-details
            />
            <v-card
              v-for="(language) in filtered_lang" class="language-card pa-2 mb-2"
              :color="language.value === speechStore.stt.language ? 'primary' : 'default'"
              @click="speechStore.stt.language = language.value"
            >
              <v-radio :label="language.title" :value="language.value">
                <template #label>
                  <div class="d-flex flex-grow-1 justify-space-between me-2">
                    <div>{{ language.title }}</div>
                    <div class="pin-icon">
                      <v-icon
                        v-if="!is_pinned_language(language)" class="pin-icon-not-pinned"
                        @click.prevent="pin_language(language)"
                      >
                        mdi-star-outline
                      </v-icon>
                      <v-icon v-else class="pin-icon-pinned" @click.prevent="unpin_language(language)">
                        mdi-star
                      </v-icon>
                    </div>
                  </div>
                </template>
              </v-radio>
            </v-card>
          </v-radio-group>
        </v-col>
        <v-divider />
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ListItem, useSpeechStore} from '@/stores/speech'
import sttLanguages from '@/constants/stt_languages'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const speechStore = useSpeechStore()

const apiKeyColor = computed(() => {
  if (!speechStore.stt.deepgramApiKey) return 'error'
  return 'success'
})

const apiKeyHint = computed(() => {
  if (!speechStore.stt.deepgramApiKey) return 'Required - get your API key from console.deepgram.com'
  return 'API key set - get your key from console.deepgram.com'
})

const languages = sttLanguages

const language_choice = ref('')
const search_lang = ref('')

// Microphone / input device picker. '' = System Default.
const micItems = ref<{ deviceId: string, label: string }[]>([{ deviceId: '', label: 'System Default' }])

async function loadMics() {
  try {
    // A getUserMedia call is required before device labels are exposed by the browser.
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
      probe.getTracks().forEach(t => t.stop())
    } catch { /* labels may stay hidden if denied; still list device ids */ }

    const devices = await navigator.mediaDevices.enumerateDevices()
    const inputs = devices
      .filter(d => d.kind === 'audioinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
    micItems.value = [{ deviceId: '', label: 'System Default' }, ...inputs]
  } catch (e) {
    console.error('[STT] Failed to enumerate audio input devices', e)
  }
}

const filtered_lang = computed(() => {
  return languages.filter(lang => `${lang.title} ${lang.value}`.toLocaleLowerCase().includes(search_lang.value.toLocaleLowerCase()))
})

watch(language_choice, (new_val) => {
  if (new_val)
    speechStore.stt.language = new_val
})

watch(() => speechStore.stt.deepgramApiKey, () => {
  speechStore.initialize_speech(speechStore.stt.language)
})

// Re-create the Deepgram instance when the selected input device changes so the new
// device is picked up (the device is read at construction time in getUserMedia).
watch(() => speechStore.stt.inputDeviceId, () => {
  speechStore.initialize_speech(speechStore.stt.language)
})

onMounted(() => {
  languages.forEach((language) => {
    if (language.value === speechStore.stt.language)
      language_choice.value = language.value
  })
  loadMics()
})

function pin_language(selected_language: ListItem) {
  speechStore.pin_language(selected_language)
}

function unpin_language(selected_language: ListItem) {
  speechStore.unpin_language(selected_language)
}

function is_pinned_language(selected_language: ListItem) {
  return speechStore.is_pinned_language(selected_language)
}
</script>

<style>
.language-card .v-selection-control .v-label {
  width: 100%;
}

.language-card .pin-icon-not-pinned:before {
  display: none !important;
}

.language-card:hover .pin-icon-not-pinned:before {
  display: inline-block !important;
}

/* v-hover is unreliable and doesn't respond to layout changes. */
.pin-icon-pinned:hover:before {
  content: "\F1564" !important; /* mdi-star-minus */
}

.pin-icon-not-pinned:hover:before {
  content: "\F1567" !important; /* mdi-star-plus-outline */
}
</style>
