import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface Log {
  transcript: string // text that was said
  isFinal: boolean // is final interpretation
  translate: boolean // is there a translation
  translation?: string // translation of transcript (if exists)
  isTranslationFinal: boolean // is final translation
  hide: number // hide text from view
  time?: Date // timestamp of transcript
  pause?: boolean // if user paused
}

export const useLogsStore = defineStore('logs', () => {
  const logs = ref<Log[]>([])
  const loading_result = ref(false)
  const wait_interval = ref<undefined | ReturnType<typeof setTimeout>>(undefined)

  // Generate unique window ID to prevent self-updates
  const windowId = Math.random().toString(36).substring(7)
  let isUpdatingFromStorage = false

  // Sync logs to localStorage for cross-window communication
  watch(logs, (newLogs) => {
    // Don't sync if we're currently updating from storage
    if (isUpdatingFromStorage)
      return

    try {
      const serialized = JSON.stringify({
        windowId,
        logs: newLogs.map(log => ({
          ...log,
          time: log.time?.toISOString(),
        })),
      })
      localStorage.setItem('mimiuchi_logs', serialized)
    }
    catch (e) {
      console.error('Failed to sync logs:', e)
    }
  }, { deep: true })

  // Listen for logs from other windows (not same window)
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === 'mimiuchi_logs' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue)
          // Only update if the change came from a different window
          if (data.windowId !== windowId) {
            isUpdatingFromStorage = true
            logs.value = data.logs.map((log: any) => ({
              ...log,
              time: log.time ? new Date(log.time) : undefined,
            }))
            // Reset flag on next tick
            setTimeout(() => {
              isUpdatingFromStorage = false
            }, 0)
          }
        }
        catch (err) {
          console.error('Failed to parse logs from storage:', err)
        }
      }
    })

    // Load existing logs on mount
    try {
      const stored = localStorage.getItem('mimiuchi_logs')
      if (stored) {
        const data = JSON.parse(stored)
        // Only load if from a different window
        if (data.windowId !== windowId && data.logs) {
          isUpdatingFromStorage = true
          logs.value = data.logs.map((log: any) => ({
            ...log,
            time: log.time ? new Date(log.time) : undefined,
          }))
          setTimeout(() => {
            isUpdatingFromStorage = false
          }, 0)
        }
      }
    }
    catch (e) {
      console.error('Failed to load logs from storage:', e)
    }
  }

  function exportLogs() {
    const now = new Date()
    let text = ''
    logs.value.forEach(log => text += `[${log.time?.toISOString()}] ${log.transcript}\n`)
    const blob = new Blob([text], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    const filename = `transcript_${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}.txt`
    a.setAttribute('href', url)
    a.setAttribute('download', filename)
    a.click()
  }

  return {
    logs,
    loading_result,
    wait_interval,
    exportLogs,
  }
})
