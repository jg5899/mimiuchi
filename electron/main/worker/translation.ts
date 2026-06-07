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

let apiKey: string = ''

parentPort?.on('message', async (message) => {
  if (message.type === 'set-api-key') {
    apiKey = message.apiKey
    console.log('[TranslationWorker] OpenAI API key set, length:', apiKey?.length)
    parentPort?.postMessage({ status: 'ready' })
    return
  }

  // Ignore legacy DeepL/provider messages gracefully
  if (message.type === 'set-deepl-api-key' || message.type === 'set-translation-provider') {
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
      await translateWithOpenAI(message.data)
    } catch (error: any) {
      console.error('[TranslationWorker] Translation error:', error)
      parentPort?.postMessage({
        status: 'error',
        error: error.message || 'Translation failed',
        index: message.data.index,
        tgt_lang: message.data.tgt_lang,
      })
    }
  }
})

async function translateWithOpenAI(data: any) {
  if (!apiKey) {
    console.error('[TranslationWorker] No OpenAI API key configured!')
    throw new Error('OpenAI API key not configured')
  }

  const sourceLang = languageMap[data.src_lang] || data.src_lang
  const targetLang = languageMap[data.tgt_lang] || data.tgt_lang

  // Build system message with optional context
  let systemContent = `You are an expert biblical translator for live church services. Translate from ${sourceLang} to ${targetLang}.

CRITICAL Guidelines:
- Use formal, literal translation style (like ESV in English, LBLA in Spanish, Almeida in Portuguese)
- When translating Bible verses, use exact biblical vocabulary from formal translations
- Preserve theological terms precisely: "righteousness", "salvation", "grace", "redemption", "sanctification"
- Keep Scripture references (e.g., "John 3:16") unchanged
- Maintain reverent, formal register appropriate for worship

Return ONLY the translation, nothing else.`

  if (data.context && data.context.trim()) {
    systemContent = `You are an expert biblical translator for live church services. Translate from ${sourceLang} to ${targetLang}.

Previous context: "${data.context}"

CRITICAL Guidelines:
- Use formal, literal translation style (like ESV in English, LBLA in Spanish, Almeida in Portuguese)
- When translating Bible verses, use exact biblical vocabulary from formal translations
- Preserve theological terms precisely: "righteousness", "salvation", "grace", "redemption", "sanctification"
- Keep Scripture references (e.g., "John 3:16") unchanged
- Maintain reverent, formal register appropriate for worship
- Use context to correctly handle pronouns and references

Return ONLY the translation, nothing else.`
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
      temperature: 0.2,
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

  parentPort?.postMessage({
    status: 'complete',
    output: [{ translation_text: translation }],
    index: data.index,
    tgt_lang: data.tgt_lang,
  })
}
