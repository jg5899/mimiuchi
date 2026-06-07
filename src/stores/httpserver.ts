import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useHttpServerStore = defineStore('httpserver', () => {
  const enabled = ref(true)
  const port = ref(8080)

  // Cloudflare Tunnel settings
  const tunnelMode = ref<'quick' | 'named'>('named')
  const tunnelToken = ref('')
  const tunnelHostname = ref('')

  function reset() {
    enabled.value = true
    port.value = 8080
    tunnelMode.value = 'named'
    tunnelToken.value = ''
    tunnelHostname.value = ''
  }

  return {
    enabled,
    port,
    tunnelMode,
    tunnelToken,
    tunnelHostname,
    reset,
  }
})
