import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useHttpServerStore = defineStore('httpserver', () => {
  const enabled = ref(true)
  const port = ref(8080)

  // Opt-in: broadcast draft (interim) English captions to display clients as the speaker
  // talks, instead of only finalized lines. Default OFF to preserve the existing finals-only
  // behavior (which avoids caption flicker).
  const interim_captions = ref(false)

  // Cloudflare Tunnel settings
  const tunnelMode = ref<'quick' | 'named'>('named')
  const tunnelToken = ref('')
  const tunnelHostname = ref('')

  function reset() {
    enabled.value = true
    port.value = 8080
    interim_captions.value = false
    tunnelMode.value = 'named'
    tunnelToken.value = ''
    tunnelHostname.value = ''
  }

  return {
    enabled,
    port,
    interim_captions,
    tunnelMode,
    tunnelToken,
    tunnelHostname,
    reset,
  }
})
