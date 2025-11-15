import { defineStore } from 'pinia'

import { ref } from 'vue'
import { useLogsStore } from '@/stores/logs'
import { useSpeechStore } from '@/stores/speech'

export const useTranslationStore = defineStore('translation', () => {
  const enabled = ref(false)
  const type = ref('OpenAI')
  const source = ref('eng_Latn')
  const target = ref('jpn_Jpan')
  const download = ref(-1) // percent downloaded 0-100. -1 = done
  const show_original = ref(true)
  const display_mode = ref<'original' | 'translation' | 'both'>('translation') // What to show in main window
  const openai_api_key = ref('')
  const use_context = ref(false)
  const context_window_size = ref(3)

  function onMessageReceived(data: any) {
    const logsStore = useLogsStore()
    switch (data.status) {
      case 'progress':
        if (data.file === 'onnx/encoder_model_quantized.onnx')
          download.value = data.progress
        break
      case 'ready':
        download.value = -1
        break
      case 'update':
        logsStore.logs[data.index].translation = data.output
        logsStore.loading_result = true
        break
      case 'complete': {
        const { on_submit } = useSpeechStore()

        logsStore.logs[data.index].translation = data.output[0].translation_text
        logsStore.loading_result = false
        logsStore.logs[data.index].isTranslationFinal = true

        on_submit(logsStore.logs[data.index], data.index)
        break
      }
      case 'error':
        console.error('Translation error received:', data.error)
        logsStore.loading_result = false
        // Optionally disable translation on error to prevent further crashes
        enabled.value = false
        break
    }
  }
  return {
    enabled,
    type,
    source,
    target,
    download,
    show_original,
    display_mode,
    openai_api_key,
    use_context,
    context_window_size,
    onMessageReceived,
  }
})
