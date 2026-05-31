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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
// Exponential backoff: 400ms, 800ms, 1600ms, ...
function backoffMs(attempt: number) {
  return 400 * Math.pow(2, attempt - 1)
}

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

  const requestBody = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: data.text },
    ],
    temperature: 0.2,
    max_tokens: 500,
  })

  // Retry transient failures (429 rate-limit, 5xx, network blips) with backoff so a
  // single hiccup doesn't drop a sentence. Permanent errors (bad key, other 4xx) fail
  // fast. On exhaustion we throw; the renderer queue then falls back to the original
  // text so the congregation never loses a line to an error token.
  const MAX_ATTEMPTS = 3
  let translation = ''
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: any
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: requestBody,
      })
    } catch (netErr: any) {
      // Network-level failure (fetch threw) — retryable.
      if (attempt === MAX_ATTEMPTS) throw new Error(netErr?.message || 'Network error contacting OpenAI')
      await sleep(backoffMs(attempt))
      continue
    }

    if (response.ok) {
      const result = await response.json()
      translation = result.choices[0]?.message?.content?.trim() || ''
      if (!translation) throw new Error('Empty OpenAI translation result')
      break
    }

    // Non-OK HTTP response.
    const retryable = response.status === 429 || response.status >= 500
    let errMsg = `OpenAI translation failed (HTTP ${response.status})`
    try {
      const e = await response.json()
      errMsg = e.error?.message || errMsg
    } catch { /* non-JSON error body */ }

    if (!retryable || attempt === MAX_ATTEMPTS) throw new Error(errMsg)

    // Honor Retry-After (seconds) when the API sends it, else exponential backoff.
    const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10)
    await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : backoffMs(attempt))
    console.log(`[TranslationWorker] retrying ${data.tgt_lang} (attempt ${attempt + 1}/${MAX_ATTEMPTS}) after HTTP ${response.status}`)
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
