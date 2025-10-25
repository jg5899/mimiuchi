<template>
  <v-card :title="t('settings.stt.title')" :subtitle="t('settings.stt.description')" color="transparent" flat>
    <v-divider />
    <v-card-text>
      <v-row>
        <v-col :cols="12">
          <v-select
            v-model="speechStore.stt.type"
            :label="t('settings.stt.type')"
            :items="stt_options"
            item-title="title"
            item-value="value"
            variant="outlined"
            return-object
          />
        </v-col>
      </v-row>

      <v-row v-if="speechStore.stt.type.value === 'whisper'">
        <v-col :cols="12">
          <v-text-field
            v-model="speechStore.stt.whisperApiKey"
            label="OpenAI API Key"
            type="password"
            variant="outlined"
            hint="Get your API key from platform.openai.com/api-keys"
            persistent-hint
          />
        </v-col>
        <v-col :cols="12">
          <v-switch
            v-model="speechStore.stt.whisperUseGPT4oPostProcessing"
            label="Enable GPT-4o Post-Processing"
            color="primary"
            hide-details
          />
          <p class="text-caption mt-2 ml-2">
            Refine transcripts with GPT-4o for better grammar, punctuation, and biblical term accuracy.
            Adds ~$0.02-0.04 per minute.
          </p>
        </v-col>
        <v-col :cols="12">
          <v-alert type="info" variant="tonal" density="compact">
            <div class="text-caption">
              <strong>Whisper API Pricing:</strong> ~$0.006 per minute of audio (~$0.36/hour)<br>
              <strong>GPT-4o Post-Processing:</strong> ~$0.02-0.04 per minute (optional, toggle above)<br>
              <strong>Supported Languages:</strong> 99 languages including English, Spanish, Ukrainian, Russian<br>
              <strong>Note:</strong> Audio is processed in 3-second chunks for readable real-time transcription
            </div>
          </v-alert>
        </v-col>
      </v-row>

      <v-row v-if="speechStore.stt.type.value === 'deepgram'">
        <v-col :cols="12">
          <v-text-field
            v-model="speechStore.stt.deepgramApiKey"
            label="Deepgram API Key"
            type="password"
            variant="outlined"
            hint="Get your API key from console.deepgram.com"
            persistent-hint
          />
        </v-col>
        <v-col :cols="12">
          <v-alert type="success" variant="tonal" density="compact">
            <div class="text-caption">
              <strong>✓ Recommended for Church Services</strong><br><br>
              <strong>Deepgram Nova-2 Pricing:</strong> ~$0.0043 per minute of audio (~$0.26/hour)<br>
              <strong>Features:</strong> True real-time streaming, handles music/singing, speaker diarization, custom keyword boost<br>
              <strong>Supported Languages:</strong> 30+ languages including English, Spanish, Ukrainian, Russian<br>
              <strong>How it works:</strong> Real-time WebSocket streaming - no chunking delays!
            </div>
          </v-alert>
        </v-col>
      </v-row>

      <v-row v-if="speechStore.stt.type.value === 'webspeech'">
        <v-col :cols="12">
          <v-slider
            v-model="speechStore.stt.sensitivity"
            :label="t('settings.stt.sensitivity')"
            max="1"
            color="orange"
            track-color="green"
            thumb-color="primary"
            hide-details
          />
        </v-col>
        <v-row class="mx-3 mb-4 mt-2">
          <v-col class="pa-0">
            <v-slider
              v-model="sensitivity"
              color="orange"
              :track-color="sensitivity === 0 ? `grey` : `green`"
              hide-details
              readonly
              max="1"
              height="20"
              thumb-size="4"
            >
              <template #prepend>
                <v-btn
                  color="primary"
                  width="122"
                  :loading="loading_media"
                  @click="test_sensitivity()"
                >
                  {{ stream ? t('settings.stt.sensitivity_stop') : t('settings.stt.sensitivity_start') }}
                </v-btn>
              </template>
            </v-slider>
            <div v-if="active_device" class="text-caption d-flex flex-row-reverse mr-2">
              <p class="text-glow">
                {{ t('settings.stt.device') }}{{ active_device }}
              </p>
              <v-icon class="fa fa-circle text-glow blink mr-1">
                mdi-circle
              </v-icon>
            </div>
          </v-col>
        </v-row>

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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ListItem, useSpeechStore} from '@/stores/speech'
import { WebSpeechLangs } from '@/modules/speech'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import is_electron from '@/helpers/is_electron'

declare interface MediaDevice {
  kind?: string
  label?: string
  id?: string
}

const speechStore = useSpeechStore()

const languages = WebSpeechLangs

const stt_options = ref([
  {
    title: 'Web Speech API (Free, built-in)',
    value: 'webspeech',
  },
  {
    title: 'OpenAI Whisper API (Good accuracy with GPT-4o refinement)',
    value: 'whisper',
  },
  {
    title: 'Deepgram Nova-2 (Best for real-time church audio, recommended)',
    value: 'deepgram',
  },
])

const language_choice = ref('')
const search_lang = ref('')

const active_device = ref('')
const media_devices = ref(<any>[])
const stream = ref(<any>null)
const sensitivity = ref(0)
const loading_media = ref(false)

const filtered_lang = computed(() => {
  return languages.filter(lang => `${lang.title} ${lang.value}`.toLocaleLowerCase().includes(search_lang.value.toLocaleLowerCase()))
})

watch(language_choice, (new_val) => {
  if (new_val)
    speechStore.stt.language = new_val
})

// Reinitialize speech when STT type or API key changes
watch(() => speechStore.stt.type, () => {
  speechStore.initialize_speech(speechStore.stt.language)
})

watch(() => speechStore.stt.whisperApiKey, () => {
  if (speechStore.stt.type.value === 'whisper') {
    speechStore.initialize_speech(speechStore.stt.language)
  }
})

watch(() => speechStore.stt.whisperUseGPT4oPostProcessing, () => {
  if (speechStore.stt.type.value === 'whisper') {
    speechStore.initialize_speech(speechStore.stt.language)
  }
})

watch(() => speechStore.stt.deepgramApiKey, () => {
  if (speechStore.stt.type.value === 'deepgram') {
    speechStore.initialize_speech(speechStore.stt.language)
  }
})

onUnmounted(() => {
  stop_stream()
})

onMounted(() => {
  languages.forEach((language) => {
    if (language.value === speechStore.stt.language)
      language_choice.value = language.value
  })
  get_media_devices()
})

function openURL(url: string) {
  window.open(url, '_blank')
}

async function test_sensitivity() {
  if (stream.value) {
    stop_stream()
    return
  }

  loading_media.value = true
  stream.value = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  stream.value.getTracks().forEach((track: any) => active_device.value = track.label)
  const audioContext = new AudioContext()
  const mediaStreamAudioSourceNode = audioContext.createMediaStreamSource(stream.value)
  const analyserNode = audioContext.createAnalyser()
  mediaStreamAudioSourceNode.connect(analyserNode)

  const pcmData = new Float32Array(analyserNode.fftSize)
  const onFrame = () => {
    if (!stream.value)
      return
    analyserNode.getFloatTimeDomainData(pcmData)
    let sumSquares = 0.0
    for (const amplitude of pcmData) sumSquares += amplitude * amplitude
    sensitivity.value = Math.round(Math.sqrt(sumSquares / pcmData.length) * 1000) / 1000
    window.requestAnimationFrame(onFrame)
  }
  window.requestAnimationFrame(onFrame)
  loading_media.value = false
}

function stop_stream() {
  if (stream.value) {
    stream.value.getTracks().forEach((track: any) => {
      track.stop()
      stream.value = null
      sensitivity.value = 0
      loading_media.value = false
      active_device.value = ''
    })
  }
}

async function get_media_devices() {
  media_devices.value = []
  navigator.mediaDevices.enumerateDevices().then((devices: any) => {
    devices.forEach((device: MediaDevice) => {
      if (device.kind === 'audioinput') {
        media_devices.value.push({
          kind: device.kind,
          label: device.label,
          id: device.label,
        })
      }
    })
  })
}

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
