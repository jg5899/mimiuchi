<template>
  <v-card title="Display Presets" subtitle="Quick configurations for different scenarios" color="transparent" flat>
    <v-divider />
    <v-card-text>
      <!-- Current Preset Info -->
      <v-row v-if="presetsStore.currentPreset">
        <v-col :cols="12">
          <v-alert type="info" variant="tonal" prominent>
            <v-alert-title>
              <v-icon :icon="presetsStore.currentPreset.icon" /> Currently Using: {{ presetsStore.currentPreset.name }}
            </v-alert-title>
            <div class="text-body-2 mt-2">
              {{ presetsStore.currentPreset.description }}
            </div>
            <template #append>
              <v-btn
                size="small"
                variant="outlined"
                @click="presetsStore.clearPreset()"
              >
                Clear Preset
              </v-btn>
            </template>
          </v-alert>
        </v-col>
      </v-row>

      <!-- Built-in Presets -->
      <v-row>
        <v-col :cols="12">
          <h3 class="mb-3">
            <v-icon icon="mdi-star-circle" /> Built-in Presets
          </h3>
        </v-col>

        <v-col
          v-for="preset in builtInPresets"
          :key="preset.id"
          :cols="12"
          :sm="6"
          :md="4"
        >
          <v-card
            :color="presetsStore.currentPresetId === preset.id ? 'primary' : undefined"
            :variant="presetsStore.currentPresetId === preset.id ? 'tonal' : 'outlined'"
            hover
          >
            <v-card-title>
              <v-icon :icon="preset.icon" /> {{ preset.name }}
            </v-card-title>
            <v-card-subtitle class="text-wrap">
              {{ preset.description }}
            </v-card-subtitle>
            <v-card-text>
              <div class="text-caption">
                Font: {{ preset.settings.font_size }}px {{ preset.settings.font_family }}<br>
                Alignment: {{ preset.settings.text_align }}<br>
                Max Lines: {{ preset.settings.max_lines }}
              </div>
            </v-card-text>
            <v-card-actions>
              <v-btn
                color="primary"
                :variant="presetsStore.currentPresetId === preset.id ? 'flat' : 'outlined'"
                block
                @click="applyPreset(preset.id)"
              >
                <v-icon icon="mdi-check" v-if="presetsStore.currentPresetId === preset.id" />
                {{ presetsStore.currentPresetId === preset.id ? 'Applied' : 'Apply Preset' }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <v-divider class="my-6" />

      <!-- Custom Presets -->
      <v-row>
        <v-col :cols="12">
          <h3 class="mb-3">
            <v-icon icon="mdi-account-star" /> Custom Presets
          </h3>
        </v-col>

        <v-col :cols="12" v-if="customPresets.length === 0">
          <v-alert type="info" variant="outlined">
            No custom presets yet. Configure your display settings in the Appearance tab, then save them as a preset below.
          </v-alert>
        </v-col>

        <v-col
          v-for="preset in customPresets"
          :key="preset.id"
          :cols="12"
          :sm="6"
          :md="4"
        >
          <v-card
            :color="presetsStore.currentPresetId === preset.id ? 'primary' : undefined"
            :variant="presetsStore.currentPresetId === preset.id ? 'tonal' : 'outlined'"
            hover
          >
            <v-card-title>
              <v-icon :icon="preset.icon" /> {{ preset.name }}
            </v-card-title>
            <v-card-subtitle class="text-wrap">
              {{ preset.description }}
            </v-card-subtitle>
            <v-card-text>
              <div class="text-caption">
                Font: {{ preset.settings.font_size }}px {{ preset.settings.font_family }}<br>
                Created: {{ formatDate(preset.createdAt) }}
              </div>
            </v-card-text>
            <v-card-actions>
              <v-btn
                color="primary"
                :variant="presetsStore.currentPresetId === preset.id ? 'flat' : 'outlined'"
                @click="applyPreset(preset.id)"
              >
                Apply
              </v-btn>
              <v-spacer />
              <v-btn
                icon="mdi-delete"
                size="small"
                variant="text"
                @click="deletePreset(preset.id)"
              />
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <v-divider class="my-6" />

      <!-- Save Current Settings -->
      <v-row>
        <v-col :cols="12">
          <h3 class="mb-3">
            <v-icon icon="mdi-content-save" /> Save Current Settings
          </h3>
        </v-col>
        <v-col :cols="12" :md="8">
          <v-card variant="outlined">
            <v-card-text>
              <v-text-field
                v-model="newPresetName"
                label="Preset Name"
                hint="e.g., 'Sunday Morning', 'Youth Service'"
                persistent-hint
                prepend-inner-icon="mdi-format-text"
                variant="outlined"
                class="mb-4"
              />
              <v-textarea
                v-model="newPresetDescription"
                label="Description"
                hint="Brief description of when to use this preset"
                persistent-hint
                prepend-inner-icon="mdi-text"
                variant="outlined"
                rows="2"
              />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn
                color="primary"
                prepend-icon="mdi-content-save"
                :disabled="!newPresetName"
                @click="saveCurrentAsPreset"
              >
                Save as Preset
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>

    <!-- Success Snackbar -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      timeout="3000"
    >
      {{ snackbarMessage }}
      <template #actions>
        <v-btn
          variant="text"
          @click="showSnackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDisplayPresetsStore } from '@/stores/display_presets'

const presetsStore = useDisplayPresetsStore()

const newPresetName = ref('')
const newPresetDescription = ref('')
const showSnackbar = ref(false)
const snackbarMessage = ref('')
const snackbarColor = ref('success')

const builtInPresets = computed(() => presetsStore.allPresets.filter(p => p.isBuiltIn))
const customPresets = computed(() => presetsStore.allPresets.filter(p => !p.isBuiltIn))

function applyPreset(id: string) {
  const success = presetsStore.applyPreset(id)
  if (success) {
    snackbarMessage.value = 'Preset applied successfully!'
    snackbarColor.value = 'success'
    showSnackbar.value = true
  } else {
    snackbarMessage.value = 'Failed to apply preset'
    snackbarColor.value = 'error'
    showSnackbar.value = true
  }
}

function saveCurrentAsPreset() {
  if (!newPresetName.value.trim()) return

  const id = presetsStore.saveCustomPreset(
    newPresetName.value.trim(),
    newPresetDescription.value.trim()
  )

  if (id) {
    snackbarMessage.value = `Preset "${newPresetName.value}" saved!`
    snackbarColor.value = 'success'
    showSnackbar.value = true

    // Clear form
    newPresetName.value = ''
    newPresetDescription.value = ''
  } else {
    snackbarMessage.value = 'Failed to save preset'
    snackbarColor.value = 'error'
    showSnackbar.value = true
  }
}

function deletePreset(id: string) {
  if (confirm('Are you sure you want to delete this preset?')) {
    const success = presetsStore.deleteCustomPreset(id)
    if (success) {
      snackbarMessage.value = 'Preset deleted'
      snackbarColor.value = 'success'
      showSnackbar.value = true
    }
  }
}

function formatDate(date?: Date) {
  if (!date) return 'Unknown'
  return new Date(date).toLocaleDateString()
}
</script>
