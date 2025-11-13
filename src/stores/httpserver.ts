import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useHttpServerStore = defineStore('httpserver', () => {
  const enabled = ref(false)
  const port = ref(8080)

  function reset() {
    enabled.value = false
    port.value = 8080
  }

  return {
    enabled,
    port,
    reset,
  }
})
