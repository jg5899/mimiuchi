/**
 * Display Presets Store
 * Manages saved display configurations for different church scenarios
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAppearanceStore } from './appearance'

export interface DisplayPreset {
  id: string
  name: string
  description: string
  icon: string
  settings: {
    // Text appearance
    font_size: number
    font_family: string
    text_color: string
    background_color: string
    text_align: string

    // Display behavior
    show_original: boolean
    auto_scroll: boolean
    fade_enabled: boolean
    fade_time: number
    hide_after: number

    // Layout
    max_lines: number
    line_height: number
    padding: number
  }
  isBuiltIn: boolean
  createdAt?: Date
  updatedAt?: Date
}

// Built-in presets for common church scenarios
const BUILTIN_PRESETS: DisplayPreset[] = [
  {
    id: 'sanctuary-main',
    name: 'Sanctuary Main Screen',
    description: 'Large, clear text for main sanctuary projection',
    icon: 'mdi-church',
    isBuiltIn: true,
    settings: {
      font_size: 48,
      font_family: 'Roboto',
      text_color: '#FFFFFF',
      background_color: '#000000',
      text_align: 'center',
      show_original: true,
      auto_scroll: true,
      fade_enabled: false,
      fade_time: 2,
      hide_after: 30,
      max_lines: 3,
      line_height: 1.5,
      padding: 40,
    },
  },
  {
    id: 'overflow-room',
    name: 'Overflow Room',
    description: 'Comfortable reading on smaller displays',
    icon: 'mdi-monitor',
    isBuiltIn: true,
    settings: {
      font_size: 36,
      font_family: 'Roboto',
      text_color: '#FFFFFF',
      background_color: '#1E1E1E',
      text_align: 'left',
      show_original: true,
      auto_scroll: true,
      fade_enabled: true,
      fade_time: 3,
      hide_after: 45,
      max_lines: 5,
      line_height: 1.4,
      padding: 30,
    },
  },
  {
    id: 'mobile-view',
    name: 'Mobile Devices',
    description: 'Optimized for phones and tablets',
    icon: 'mdi-cellphone',
    isBuiltIn: true,
    settings: {
      font_size: 20,
      font_family: 'Roboto',
      text_color: '#000000',
      background_color: '#FFFFFF',
      text_align: 'left',
      show_original: true,
      auto_scroll: true,
      fade_enabled: false,
      fade_time: 2,
      hide_after: 60,
      max_lines: 10,
      line_height: 1.6,
      padding: 16,
    },
  },
  {
    id: 'translation-only',
    name: 'Translation Display',
    description: 'Translation-only for language-specific rooms',
    icon: 'mdi-translate',
    isBuiltIn: true,
    settings: {
      font_size: 42,
      font_family: 'Roboto',
      text_color: '#FFFFFF',
      background_color: '#1A237E',
      text_align: 'center',
      show_original: false,
      auto_scroll: true,
      fade_enabled: false,
      fade_time: 2,
      hide_after: 40,
      max_lines: 4,
      line_height: 1.5,
      padding: 35,
    },
  },
  {
    id: 'hearing-accessible',
    name: 'Hearing Accessibility',
    description: 'High contrast, large text for accessibility',
    icon: 'mdi-ear-hearing',
    isBuiltIn: true,
    settings: {
      font_size: 56,
      font_family: 'OpenDyslexic',
      text_color: '#FFFF00',
      background_color: '#000000',
      text_align: 'left',
      show_original: true,
      auto_scroll: false,
      fade_enabled: false,
      fade_time: 2,
      hide_after: 120,
      max_lines: 2,
      line_height: 1.8,
      padding: 50,
    },
  },
]

export const useDisplayPresetsStore = defineStore('display_presets', () => {
  const customPresets = ref<DisplayPreset[]>([])
  const currentPresetId = ref<string | null>(null)

  // All presets (built-in + custom)
  const allPresets = computed(() => [...BUILTIN_PRESETS, ...customPresets.value])

  // Get preset by ID
  function getPreset(id: string): DisplayPreset | undefined {
    return allPresets.value.find(p => p.id === id)
  }

  // Apply preset to appearance store
  function applyPreset(id: string) {
    const preset = getPreset(id)
    if (!preset) {
      console.error(`Preset not found: ${id}`)
      return false
    }

    const appearanceStore = useAppearanceStore()

    // Apply settings to appearance store
    appearanceStore.text.font_size = preset.settings.font_size
    appearanceStore.text.font_family = preset.settings.font_family
    appearanceStore.colors.text = preset.settings.text_color
    appearanceStore.colors.background = preset.settings.background_color
    appearanceStore.text.text_align = preset.settings.text_align
    appearanceStore.text.enable_fade = preset.settings.fade_enabled
    appearanceStore.text.fade_time = preset.settings.fade_time
    appearanceStore.text.hide_after = preset.settings.hide_after

    currentPresetId.value = id

    console.log(`Applied preset: ${preset.name}`)
    return true
  }

  // Save current settings as custom preset
  function saveCustomPreset(name: string, description: string, icon: string = 'mdi-star') {
    const appearanceStore = useAppearanceStore()

    const newPreset: DisplayPreset = {
      id: `custom-${Date.now()}`,
      name,
      description,
      icon,
      isBuiltIn: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        font_size: appearanceStore.text.font_size,
        font_family: appearanceStore.text.font_family,
        text_color: appearanceStore.colors.text,
        background_color: appearanceStore.colors.background,
        text_align: appearanceStore.text.text_align,
        show_original: true, // Get from translation store
        auto_scroll: true, // Default
        fade_enabled: appearanceStore.text.enable_fade,
        fade_time: appearanceStore.text.fade_time,
        hide_after: appearanceStore.text.hide_after,
        max_lines: 10, // Default
        line_height: 1.5, // Default
        padding: 30, // Default
      },
    }

    customPresets.value.push(newPreset)
    console.log(`Saved custom preset: ${name}`)
    return newPreset.id
  }

  // Update existing custom preset
  function updateCustomPreset(id: string, name: string, description: string) {
    const preset = customPresets.value.find(p => p.id === id)
    if (!preset) {
      console.error(`Custom preset not found: ${id}`)
      return false
    }

    preset.name = name
    preset.description = description
    preset.updatedAt = new Date()

    console.log(`Updated preset: ${name}`)
    return true
  }

  // Delete custom preset
  function deleteCustomPreset(id: string) {
    const index = customPresets.value.findIndex(p => p.id === id)
    if (index === -1) {
      console.error(`Custom preset not found: ${id}`)
      return false
    }

    customPresets.value.splice(index, 1)

    // Clear current if deleted
    if (currentPresetId.value === id) {
      currentPresetId.value = null
    }

    console.log(`Deleted preset: ${id}`)
    return true
  }

  // Get current preset
  const currentPreset = computed(() => {
    if (!currentPresetId.value) return null
    return getPreset(currentPresetId.value)
  })

  // Reset to default (no preset)
  function clearPreset() {
    currentPresetId.value = null
  }

  return {
    // State
    customPresets,
    currentPresetId,

    // Computed
    allPresets,
    currentPreset,

    // Actions
    getPreset,
    applyPreset,
    saveCustomPreset,
    updateCustomPreset,
    deleteCustomPreset,
    clearPreset,
  }
})
