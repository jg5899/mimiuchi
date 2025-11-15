<template>
  <v-card
    id="log-list" v-resize="onResize" class="fill-height pa-4 overflow-auto log-list"
    :color="appearanceStore.ui.color" :height="height - (appearanceStore.footer_size ? 200 : 55)" tile
  >
    <!-- Language Selector - Only show when translation is enabled -->
    <v-row v-if="translationStore.enabled && is_electron()" class="mb-4">
      <v-col cols="12">
        <v-select
          v-model="translationStore.target"
          :items="availableLanguages"
          label="Translation Language"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="onLanguageChange"
        >
          <template #prepend-inner>
            <v-icon>mdi-translate</v-icon>
          </template>
        </v-select>
      </v-col>
    </v-row>

    <!-- Display Mode Selector - Only show when translation is enabled -->
    <v-row v-if="translationStore.enabled && is_electron()" class="mb-2">
      <v-col cols="12">
        <v-btn-toggle
          v-model="translationStore.display_mode"
          color="primary"
          variant="outlined"
          divided
          density="compact"
          mandatory
        >
          <v-btn value="original" size="small">
            <v-icon start>mdi-text</v-icon>
            Original Only
          </v-btn>
          <v-btn value="translation" size="small">
            <v-icon start>mdi-translate</v-icon>
            Translation Only
          </v-btn>
          <v-btn value="both" size="small">
            <v-icon start>mdi-format-list-bulleted</v-icon>
            Both (Split)
          </v-btn>
        </v-btn-toggle>
      </v-col>
    </v-row>

    <div>
      <a
        v-for="(log, index) in logsStore.logs"
        :key="index"
        :class="{ 'fade-out': log.hide, 'final-text': log.isFinal || log.isTranslationFinal, 'interim-text': !log.isFinal || (!log.isTranslationFinal && log.translate) }"
      >
        <a v-if="log.hide !== 2">
          <span v-if="translationStore.enabled && translationStore.display_mode === 'original'">
            {{ log.transcript }}&nbsp;&nbsp;
          </span>
          <span v-else-if="translationStore.enabled && translationStore.display_mode === 'translation' && log.translation">
            {{ log.translation }}&nbsp;&nbsp;
          </span>
          <span v-else-if="translationStore.enabled && translationStore.display_mode === 'both' && log.translation">
            <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
              <div style="opacity: 0.7;">{{ log.transcript }}</div>
              <div>{{ log.translation }}</div>
            </div>
          </span>
          <span v-else>
            {{ log.transcript }}&nbsp;&nbsp;
          </span>
        </a>
        <v-expand-transition v-show="log.pause">
          <div>
            <v-col class="pa-0" />
          </div>
        </v-expand-transition>
      </a>
    </div>

    <WelcomeOverlay :overlay="overlay_main" :page="overlay_page" />
  </v-card>
</template>

<script setup lang="ts">
// import {ipcRenderer} from "electron"
import { useDisplay, useTheme } from 'vuetify'

import { computed, onMounted, ref } from 'vue'
import is_electron from '@/helpers/is_electron'

import WelcomeOverlay from '@/components/overlays/WelcomeOverlay.vue'

import { useSettingsStore } from '@/stores/settings'
import { useAppearanceStore } from '@/stores/appearance'
import { useLogsStore } from '@/stores/logs'
import { useTranslationStore } from '@/stores/translation'

declare const window: any

const { height } = useDisplay()
const theme = useTheme()

const settingsStore = useSettingsStore()
const appearanceStore = useAppearanceStore()
const logsStore = useLogsStore()
const translationStore = useTranslationStore()

// Available translation languages
const availableLanguages = ref([
  { title: 'Spanish (Español)', value: 'spa_Latn' },
  { title: 'Ukrainian (Українська)', value: 'ukr_Cyrl' },
  { title: 'Russian (Русский)', value: 'rus_Cyrl' },
  { title: 'Portuguese (Português)', value: 'por_Latn' },
  { title: 'French (Français)', value: 'fra_Latn' },
  { title: 'Korean (한국어)', value: 'kor_Hang' },
  { title: 'Mandarin (中文)', value: 'zho_Hans' },
  { title: 'Tagalog', value: 'tgl_Latn' },
  { title: 'Vietnamese (Tiếng Việt)', value: 'vie_Latn' },
  { title: 'Arabic (العربية)', value: 'arb_Arab' },
  { title: 'Hindi (हिन्दी)', value: 'hin_Deva' },
  { title: 'Polish (Polski)', value: 'pol_Latn' },
])

function onLanguageChange(newLang: string) {
  console.log('Translation language changed to:', newLang)
  // The translation will automatically update via the store reactivity
}

const font_size = `${appearanceStore.text.font_size}px`
const fade_time = `${appearanceStore.text.fade_time}s`
const text_color = appearanceStore.text.color
const interim_color = appearanceStore.text.interim_color

const font_name = appearanceStore.text.font.name
const font_subtype = appearanceStore.text.font.sub_type

const outline_size = `${appearanceStore.text.outline ? appearanceStore.text.outline_size : 0}px`
const outline_color = appearanceStore.text.outline_color

const overlay_main = ref(false)
const overlay_page = ref(0)

const windowSize = ref({
  x: 0,
  y: 0,
})

const outer_size = computed(() => {
  let value = 55
  if (is_electron()) value += 35
  if (appearanceStore.footer_size) value += 145
  return `${value}px`
})

onMounted(() => {
  if (appearanceStore.current_theme in theme.themes.value)
    theme.global.name.value = appearanceStore.current_theme // Set the theme from the user's settings.
  else
    theme.global.name.value = 'midnight_purple'

  overlay_main.value = settingsStore.welcome
  onResize()
})

function onResize() {
  windowSize.value = { x: window.innerWidth, y: window.innerHeight }
}
</script>

<style>
html {
  overflow-y: hidden;
}

.log-list {
  display: flex;
  flex-direction: column-reverse;
  font-family: v-bind(font_name);
  font-style: v-bind('font_subtype.style');
  font-weight: v-bind('font_subtype.weight');
  font-size: v-bind(font_size);
  overflow-y: auto;
  max-height: calc(100vh - v-bind(outer_size));
  -webkit-text-stroke: v-bind(outline_size) v-bind(outline_color);
  paint-order: stroke fill;
}

.log-list::-webkit-scrollbar {
  display: none;
  /* for Chrome, Safari and Opera */
}

.final-text {
  color: v-bind(text_color);
}

.interim-text {
  color: v-bind(interim_color);
}

.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.8s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

.fade-out {
  animation: fadeOut ease v-bind(fade_time);
  -webkit-animation: fadeOut ease v-bind(fade_time);
  -moz-animation: fadeOut ease v-bind(fade_time);
  -o-animation: fadeOut ease v-bind(fade_time);
  -ms-animation: fadeOut ease v-bind(fade_time);
  animation-fill-mode: forwards;
}

@keyframes fadeOut {
  0% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

@-moz-keyframes fadeOut {
  0% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

@-webkit-keyframes fadeOut {
  0% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

@-o-keyframes fadeOut {
  0% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

@-ms-keyframes fadeOut {
  0% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}
</style>
