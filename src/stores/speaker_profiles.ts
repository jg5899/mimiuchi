import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface SpeakerProfile {
  id: string
  name: string
  language: string
  confidence: number
  sensitivity: number
  customVocabulary: Array<{ original: string, replacement: string }>
  whisperPrompt: string // Custom context prompt for Whisper API
  enabled: boolean
}

export const useSpeakerProfilesStore = defineStore('speaker_profiles', () => {
  const profiles = ref<SpeakerProfile[]>([
    {
      id: 'general',
      name: 'General',
      language: 'en-US',
      confidence: 0.9,
      sensitivity: 0.0,
      customVocabulary: [],
      whisperPrompt: 'Church service with scripture readings, prayers, hymns, and sermon. Proper nouns include God, Jesus, Christ, Holy Spirit, Bible, Amen.',
      enabled: true,
    },
    {
      id: 'speaker_a',
      name: 'Speaker A',
      language: 'en-US',
      confidence: 0.9,
      sensitivity: 0.0,
      customVocabulary: [],
      whisperPrompt: 'Church pastor preaching sermon with scripture references, theological terms, and biblical names.',
      enabled: false,
    },
    {
      id: 'speaker_b',
      name: 'Speaker B',
      language: 'en-US',
      confidence: 0.9,
      sensitivity: 0.0,
      customVocabulary: [],
      whisperPrompt: 'Worship leader speaking about songs, hymns, and leading congregational singing.',
      enabled: false,
    },
  ])

  const activeProfileId = ref('general')

  function getActiveProfile(): SpeakerProfile {
    return profiles.value.find(p => p.id === activeProfileId.value) || profiles.value[0]
  }

  function setActiveProfile(profileId: string) {
    const profile = profiles.value.find(p => p.id === profileId)
    if (profile) {
      activeProfileId.value = profileId
      // Mark all as disabled except the active one
      profiles.value.forEach((p) => {
        p.enabled = p.id === profileId
      })
    }
  }

  function updateProfile(profileId: string, updates: Partial<SpeakerProfile>) {
    const index = profiles.value.findIndex(p => p.id === profileId)
    if (index !== -1) {
      profiles.value[index] = { ...profiles.value[index], ...updates }
    }
  }

  function addVocabularyEntry(profileId: string, original: string, replacement: string) {
    const profile = profiles.value.find(p => p.id === profileId)
    if (profile) {
      profile.customVocabulary.push({ original, replacement })
    }
  }

  function removeVocabularyEntry(profileId: string, index: number) {
    const profile = profiles.value.find(p => p.id === profileId)
    if (profile && profile.customVocabulary[index]) {
      profile.customVocabulary.splice(index, 1)
    }
  }

  function applyVocabulary(profileId: string, text: string): string {
    const profile = profiles.value.find(p => p.id === profileId)
    if (!profile)
      return text

    let result = text
    profile.customVocabulary.forEach((entry) => {
      const regex = new RegExp(entry.original, 'gi')
      result = result.replace(regex, entry.replacement)
    })
    return result
  }

  return {
    profiles,
    activeProfileId,
    getActiveProfile,
    setActiveProfile,
    updateProfile,
    addVocabularyEntry,
    removeVocabularyEntry,
    applyVocabulary,
  }
})
