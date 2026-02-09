<template>
  <v-card title="Speaker Profiles" subtitle="Manage speaker profiles with custom settings and vocabulary" color="transparent" flat>
    <v-divider />
    <v-card-text>
      <v-row>
        <v-col :cols="12">
          <v-select
            v-model="speakerProfilesStore.activeProfileId"
            label="Active Profile"
            :items="profileItems"
            item-title="name"
            item-value="id"
            variant="outlined"
            hint="The currently active speaker profile for transcription"
            persistent-hint
            @update:model-value="onActiveProfileChange"
          />
        </v-col>
        <v-col :cols="12">
          <v-select
            v-model="selectedProfileId"
            label="Select Profile to Edit"
            :items="profileItems"
            item-title="name"
            item-value="id"
            variant="outlined"
          />
        </v-col>
      </v-row>

      <v-row v-if="selectedProfile">
        <v-col :cols="12">
          <v-text-field
            v-model="selectedProfile.name"
            label="Profile Name"
            variant="outlined"
            hide-details
          />
        </v-col>

        <v-col :cols="12">
          <v-select
            v-model="selectedProfile.language"
            label="Language"
            :items="languages"
            item-title="title"
            item-value="value"
            variant="outlined"
          />
        </v-col>

        <v-col :cols="12" :sm="6">
          <v-slider
            v-model="selectedProfile.confidence"
            label="Confidence Threshold"
            min="0"
            max="1"
            step="0.1"
            thumb-label
            color="primary"
          />
        </v-col>

        <v-col :cols="12" :sm="6">
          <v-slider
            v-model="selectedProfile.sensitivity"
            label="Sensitivity"
            min="0"
            max="1"
            step="0.1"
            thumb-label
            color="primary"
          />
        </v-col>

        <v-col :cols="12">
          <v-divider class="my-4" />
          <h3 class="mb-4">
            Custom Vocabulary
          </h3>
          <p class="text-caption mb-4">
            Add custom word replacements specific to this speaker (e.g., names, technical terms)
          </p>

          <v-row>
            <v-col :cols="12" :sm="5">
              <v-text-field
                v-model="newOriginal"
                label="Original Word/Phrase"
                variant="outlined"
                hide-details
              />
            </v-col>
            <v-col :cols="12" :sm="5">
              <v-text-field
                v-model="newReplacement"
                label="Replacement"
                variant="outlined"
                hide-details
              />
            </v-col>
            <v-col :cols="12" :sm="2">
              <v-btn
                color="primary"
                block
                @click="addVocabularyEntry"
              >
                Add
              </v-btn>
            </v-col>
          </v-row>

          <v-list v-if="selectedProfile.customVocabulary.length > 0" class="mt-4">
            <v-list-item
              v-for="(entry, index) in selectedProfile.customVocabulary"
              :key="index"
            >
              <template #prepend>
                <v-icon>mdi-swap-horizontal</v-icon>
              </template>
              <v-list-item-title>
                {{ entry.original }} → {{ entry.replacement }}
              </v-list-item-title>
              <template #append>
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  @click="removeVocabularyEntry(index)"
                />
              </template>
            </v-list-item>
          </v-list>
          <v-alert v-else type="info" variant="outlined" class="mt-4">
            No custom vocabulary entries yet. Add some above!
          </v-alert>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSpeakerProfilesStore } from '@/stores/speaker_profiles'
import { useSpeechStore } from '@/stores/speech'
import sttLanguages from '@/constants/stt_languages'

const speakerProfilesStore = useSpeakerProfilesStore()
const speechStore = useSpeechStore()
const languages = sttLanguages

const selectedProfileId = ref(speakerProfilesStore.activeProfileId)
const newOriginal = ref('')
const newReplacement = ref('')

const profileItems = computed(() => {
  return speakerProfilesStore.profiles.map(p => ({
    id: p.id,
    name: p.name,
  }))
})

const selectedProfile = computed(() => {
  return speakerProfilesStore.profiles.find(p => p.id === selectedProfileId.value)
})

function addVocabularyEntry() {
  if (newOriginal.value && newReplacement.value && selectedProfileId.value) {
    speakerProfilesStore.addVocabularyEntry(
      selectedProfileId.value,
      newOriginal.value,
      newReplacement.value,
    )
    newOriginal.value = ''
    newReplacement.value = ''
  }
}

function removeVocabularyEntry(index: number) {
  if (selectedProfileId.value) {
    speakerProfilesStore.removeVocabularyEntry(selectedProfileId.value, index)
  }
}

function onActiveProfileChange(newProfileId: string) {
  // Set the active profile in the store
  speakerProfilesStore.setActiveProfile(newProfileId)

  // Re-initialize speech with the new profile's settings
  speechStore.initialize_speech(speechStore.stt.language)
}

watch(selectedProfile, (newProfile) => {
  if (newProfile) {
    speakerProfilesStore.updateProfile(newProfile.id, newProfile)
  }
}, { deep: true })
</script>
