import { parentPort } from 'node:worker_threads'

// Global error handlers for worker thread
process.on('uncaughtException', (error) => {
  console.error('[TranslationWorker] Uncaught exception:', error)
  parentPort?.postMessage({
    status: 'error',
    error: error.message || 'Worker uncaught exception',
  })
})

process.on('unhandledRejection', (reason) => {
  console.error('[TranslationWorker] Unhandled rejection:', reason)
  parentPort?.postMessage({
    status: 'error',
    error: String(reason) || 'Worker unhandled rejection',
  })
})

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
  'ron_Latn': 'Romanian',
}

// DeepL language code mapping (simpler than OpenAI)
const deeplLangMap: Record<string, string> = {
  'eng_Latn': 'EN',
  'spa_Latn': 'ES',
  'ukr_Cyrl': 'UK',
  'rus_Cyrl': 'RU',
  'por_Latn': 'PT',
  'fra_Latn': 'FR',
  'kor_Hang': 'KO',
  'zho_Hans': 'ZH',
  'jpn_Jpan': 'JA',
  'pol_Latn': 'PL',
  'ron_Latn': 'RO',
}

let apiKey: string = ''
let deeplApiKey: string = ''
let translationProvider: string = 'OpenAI' // 'OpenAI' or 'DeepL'

parentPort?.on('message', async (message) => {
  if (message.type === 'set-api-key') {
    apiKey = message.apiKey
    console.log('[TranslationWorker] OpenAI API key set, length:', apiKey?.length)
    parentPort?.postMessage({ status: 'ready' })
    return
  }

  if (message.type === 'set-deepl-api-key') {
    deeplApiKey = message.apiKey
    console.log('[TranslationWorker] DeepL API key set, length:', deeplApiKey?.length)
    parentPort?.postMessage({ status: 'ready' })
    return
  }

  if (message.type === 'set-translation-provider') {
    translationProvider = message.provider
    console.log('[TranslationWorker] Translation provider set to:', translationProvider)
    parentPort?.postMessage({ status: 'ready' })
    return
  }

  if (message.type === 'transformers-translate' || message.type === 'transformers-translate-multi') {
    console.log('[TranslationWorker] Received translation request:', {
      type: message.type,
      text: message.data.text?.substring(0, 50),
      src_lang: message.data.src_lang,
      tgt_lang: message.data.tgt_lang,
      index: message.data.index,
      hasApiKey: !!apiKey,
    })

    try {
      // Route to appropriate translation provider
      if (translationProvider === 'DeepL') {
        await translateWithDeepL(message.data)
        return
      } else {
        await translateWithOpenAI(message.data)
        return
      }
    } catch (error: any) {
      console.error('[TranslationWorker] Translation error:', error)
      // Send error back to main thread
      parentPort?.postMessage({
        status: 'error',
        error: error.message || 'Translation failed',
        index: message.data.index,
      })
    }
  }
})

// DeepL translation function
async function translateWithDeepL(data: any) {
  try {
    if (!deeplApiKey) {
      console.error('[TranslationWorker] No DeepL API key configured!')
      throw new Error('DeepL API key not configured')
    }

    const targetLang = deeplLangMap[data.tgt_lang]
    if (!targetLang) {
      throw new Error(`Unsupported language for DeepL: ${data.tgt_lang}`)
    }

    // DeepL API endpoint (use free API for now)
    const apiUrl = deeplApiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate'

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `DeepL-Auth-Key ${deeplApiKey}`,
      },
      body: JSON.stringify({
        text: [data.text],
        target_lang: targetLang,
        formality: 'default',
        preserve_formatting: true,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'DeepL translation failed')
    }

    const result = await response.json()
    const translation = result.translations[0]?.text

    if (!translation) {
      throw new Error('Empty DeepL translation result')
    }

    console.log('[TranslationWorker] DeepL translation complete:', {
      index: data.index,
      tgt_lang: data.tgt_lang,
      translation: translation.substring(0, 50),
    })

    // Send back in same format as OpenAI
    parentPort?.postMessage({
      status: 'complete',
      output: [{ translation_text: translation }],
      index: data.index,
      tgt_lang: data.tgt_lang,
    })
  } catch (error: any) {
    throw error
  }
}

// OpenAI translation function (refactored from inline code)
async function translateWithOpenAI(data: any) {
  try {
    if (!apiKey) {
      console.error('[TranslationWorker] No OpenAI API key configured!')
      throw new Error('OpenAI API key not configured')
    }

    const sourceLang = languageMap[data.src_lang] || data.src_lang
    const targetLang = languageMap[data.tgt_lang] || data.tgt_lang

    // Build system message with optional context
    let systemContent = `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}. Preserve religious terms, proper nouns, and maintain the reverent tone appropriate for church services. Return ONLY the translated text, nothing else.`

    if (data.context && data.context.trim()) {
      systemContent = `You are a professional translator. Previous context: "${data.context}"\n\nTranslate the following text from ${sourceLang} to ${targetLang}. Use the previous context to better understand pronouns, references, and conversational flow. Preserve religious terms, proper nouns, and maintain the reverent tone appropriate for church services. Return ONLY the translated text, nothing else.`
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
            content: data.text,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'OpenAI translation failed')
    }

    const result = await response.json()
    const translation = result.choices[0]?.message?.content?.trim()

    if (!translation) {
      throw new Error('Empty OpenAI translation result')
    }

    console.log('[TranslationWorker] OpenAI translation complete:', {
      index: data.index,
      tgt_lang: data.tgt_lang,
      translation: translation.substring(0, 50),
    })

    // Send back to main thread in the same format as before
    parentPort?.postMessage({
      status: 'complete',
      output: [{ translation_text: translation }],
      index: data.index,
      tgt_lang: data.tgt_lang,
    })
  } catch (error: any) {
    throw error
  }
}
