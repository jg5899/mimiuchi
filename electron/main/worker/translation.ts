import { parentPort } from 'node:worker_threads'

// Language code to full name mapping
const languageMap: Record<string, string> = {
  'eng_Latn': 'English',
  'spa_Latn': 'Spanish',
  'ukr_Cyrl': 'Ukrainian',
  'rus_Cyrl': 'Russian',
  'por_Latn': 'Portuguese',
  'fra_Latn': 'French',
  'kor_Hang': 'Korean',
  'zho_Hans': 'Mandarin Chinese',
  'jpn_Jpan': 'Japanese',
  'tgl_Latn': 'Tagalog',
  'vie_Latn': 'Vietnamese',
  'arb_Arab': 'Arabic',
  'hin_Deva': 'Hindi',
  'pol_Latn': 'Polish',
}

let apiKey: string = ''

parentPort?.on('message', async (message) => {
  if (message.type === 'set-api-key') {
    apiKey = message.apiKey
    parentPort?.postMessage({ status: 'ready' })
    return
  }

  if (message.type === 'transformers-translate' || message.type === 'transformers-translate-multi') {
    try {
      if (!apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const sourceLang = languageMap[message.data.src_lang] || message.data.src_lang
      const targetLang = languageMap[message.data.tgt_lang] || message.data.tgt_lang

      // Build system message with optional context
      let systemContent = `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}. Preserve religious terms, proper nouns, and maintain the reverent tone appropriate for church services. Return ONLY the translated text, nothing else.`

      if (message.data.context && message.data.context.trim()) {
        systemContent = `You are a professional translator. Previous context: "${message.data.context}"\n\nTranslate the following text from ${sourceLang} to ${targetLang}. Use the previous context to better understand pronouns, references, and conversational flow. Preserve religious terms, proper nouns, and maintain the reverent tone appropriate for church services. Return ONLY the translated text, nothing else.`
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemContent,
            },
            {
              role: 'user',
              content: message.data.text,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Translation failed')
      }

      const result = await response.json()
      const translation = result.choices[0]?.message?.content?.trim()

      if (!translation) {
        throw new Error('Empty translation result')
      }

      // Send back to main thread in the same format as before
      parentPort?.postMessage({
        status: 'complete',
        output: [{ translation_text: translation }],
        index: message.data.index,
        tgt_lang: message.data.tgt_lang,
      })
    } catch (error: any) {
      console.error('Translation error:', error)
      // Send error back to main thread
      parentPort?.postMessage({
        status: 'error',
        error: error.message || 'Translation failed',
        index: message.data.index,
      })
    }
  }
})
