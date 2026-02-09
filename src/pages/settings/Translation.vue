<template>
  <v-card
    title="Single Language Translation" subtitle="Configure translation to one target language at a time"
    color="transparent" flat
  >
    <v-divider />
    <v-card-text>
      <v-row>
        <v-col :cols="12">
          <v-alert type="info" variant="outlined" class="mb-2">
            <strong>Single vs Multi-Language:</strong> This page configures single-language translation (one target language).
            For simultaneous multi-language streams, use Settings > Multi-Language.
          </v-alert>
        </v-col>
        <v-col>
          <v-chip variant="outlined" label color="error" size="large">
            <v-icon start icon="mdi-alert" />
            {{ t('settings.translation.warning') }}
          </v-chip>
        </v-col>
        <v-col :cols="12">
          <v-card flat>
            <v-list-item :title="t('settings.translation.enabled')">
              <template #append>
                <v-switch
                  v-model="translationStore.enabled"
                  color="primary"
                  hide-details
                  inset
                />
              </template>
            </v-list-item>
          </v-card>
        </v-col>
        <v-col :cols="12">
          <v-text-field
            v-model="translationStore.openai_api_key"
            label="OpenAI API Key"
            placeholder="sk-..."
            variant="outlined"
            type="password"
            :hint="openaiKeyHint"
            persistent-hint
            :color="openaiKeyColor"
            :error="translationStore.enabled && !translationStore.openai_api_key"
            :error-messages="translationStore.enabled && !translationStore.openai_api_key ? ['API key required when translations are enabled'] : []"
          >
            <template #prepend-inner>
              <v-icon icon="mdi-key" />
            </template>
          </v-text-field>
        </v-col>
        <v-col :cols="12" :sm="6">
          <v-autocomplete
            v-model="translationStore.source"
            :label="t('settings.translation.source')"
            :items="translation_options"
            item-title="title"
            item-value="value"
            auto-select-first
            :hint="`${t('settings.translation.speech_lang')}${stt_language}`"
            persistent-hint
          />
        </v-col>
        <v-col :cols="12" :sm="6">
          <v-autocomplete
            v-model="translationStore.target"
            :label="t('settings.translation.target')"
            :items="translation_options"
            item-title="title"
            item-value="value"
            auto-select-first
            hide-details
          />
        </v-col>
        <v-col :cols="12">
          <v-card flat>
            <v-list-item :title="t('settings.translation.show_original')">
              <template #append>
                <v-switch
                  v-model="translationStore.show_original"
                  color="primary"
                  hide-details
                  inset
                />
              </template>
            </v-list-item>
          </v-card>
        </v-col>
        <v-col :cols="12">
          <v-card flat>
            <v-list-item>
              <template #default>
                <v-list-item-title>
                  Use Contextual Translation
                  <v-tooltip location="top">
                    <template #activator="{ props }">
                      <v-icon
                        v-bind="props"
                        icon="mdi-information"
                        size="small"
                        class="ml-1"
                      />
                    </template>
                    <div style="max-width: 300px;">
                      Provides previous sentences as context for better translation quality.
                      Improves pronoun resolution and conversational flow.
                      Note: Uses more API tokens (higher cost).
                    </div>
                  </v-tooltip>
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption text-warning">
                  Better quality, higher cost
                </v-list-item-subtitle>
              </template>
              <template #append>
                <v-switch
                  v-model="translationStore.use_context"
                  color="primary"
                  hide-details
                  inset
                />
              </template>
            </v-list-item>
          </v-card>
        </v-col>
        <v-col v-if="translationStore.use_context" :cols="12">
          <v-slider
            v-model="translationStore.context_window_size"
            :min="1"
            :max="5"
            :step="1"
            label="Context Window Size"
            hint="Number of previous sentences to include (1-5)"
            persistent-hint
            thumb-label
            show-ticks="always"
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTranslationStore } from '@/stores/translation'
import { useSpeechStore } from '@/stores/speech'
import translation_options from '@/constants/translation_options'

const { t } = useI18n()

const translationStore = useTranslationStore()
const speechStore = useSpeechStore()

const stt_language = speechStore.stt.language

const openaiKeyColor = computed(() => {
  if (translationStore.enabled && !translationStore.openai_api_key) return 'error'
  if (translationStore.openai_api_key) return 'success'
  return undefined
})

const openaiKeyHint = computed(() => {
  if (translationStore.enabled && !translationStore.openai_api_key) return 'Required - get your key from platform.openai.com/api-keys'
  return 'Get your key from platform.openai.com/api-keys - uses GPT-4o-mini for translation'
})
</script>
