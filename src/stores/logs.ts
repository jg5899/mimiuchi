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
  const MAX_LOGS = 100
  const logs = ref<Log[]>([])
  const loading_result = ref(false)
  const wait_interval = ref<undefined | ReturnType<typeof setTimeout>>(undefined)

  // Generate unique window ID to prevent self-updates
  const windowId = Math.random().toString(36).substring(7)
  let isUpdatingFromStorage = false
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // Debounced localStorage sync function
  const syncToLocalStorage = (newLogs: Log[]) => {
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
  }

  // Sync logs to localStorage with debouncing to reduce UI jank
  watch(logs, (newLogs) => {
    // Don't sync if we're currently updating from storage
    if (isUpdatingFromStorage)
      return

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    // Debounce writes by 500ms to avoid syncing on every interim update
    debounceTimer = setTimeout(() => {
      syncToLocalStorage(newLogs)
      debounceTimer = null
    }, 500)
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

  // Apply rolling window to prevent memory bloat during long sessions
  function trimLogs() {
    if (logs.value.length > MAX_LOGS) {
      const itemsToRemove = logs.value.length - MAX_LOGS
      logs.value.splice(0, itemsToRemove)
      console.log('[Logs] Trimmed logs array, removed', itemsToRemove, 'old entries. Current length:', logs.value.length)
    }
  }

  return {
    logs,
    loading_result,
    wait_interval,
    exportLogs,
    trimLogs,
  }
})
