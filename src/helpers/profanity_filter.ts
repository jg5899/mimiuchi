/**
 * Profanity Filter with Church Context Awareness
 *
 * This filter is designed for church services where STT might mishear words.
 * It uses context awareness to understand that profanity is unlikely in religious settings.
 */

interface FilterRule {
  word: string
  replacement: string
  contextual?: boolean // If true, only filter when not in valid religious context
}

// Biblical/Religious terms that are legitimate in church context
// These are NEVER filtered because the app is used in religious settings
const BIBLICAL_TERMS = ['hell', 'damn', 'damned', 'damnation']

// Actual profanity that should be filtered
// Note: Only use actual words here, not censored versions - STT outputs real words
// Replacement is empty string to completely omit the word
const CHURCH_CORRECTIONS: FilterRule[] = [
  { word: 'fuck', replacement: '' },
  { word: 'fucking', replacement: '' },
  { word: 'shit', replacement: '' },
  { word: 'bitch', replacement: '' },
  { word: 'ass', replacement: '' },
  { word: 'asshole', replacement: '' },
  { word: 'crap', replacement: '' },
  { word: 'piss', replacement: '' },
  { word: 'bastard', replacement: '' },
]

// Religious context keywords that indicate the word might be legitimate
const RELIGIOUS_CONTEXT_WORDS = [
  'god', 'jesus', 'christ', 'lord', 'heaven', 'holy', 'spirit',
  'bible', 'scripture', 'prayer', 'amen', 'hallelujah', 'blessing',
  'salvation', 'grace', 'mercy', 'faith', 'worship', 'praise',
  'eternal', 'righteous', 'sin', 'forgive', 'repent', 'resurrection',
]

/**
 * Checks if the text is in a valid religious context
 */
function isInReligiousContext(text: string): boolean {
  const lowerText = text.toLowerCase()
  return RELIGIOUS_CONTEXT_WORDS.some(word => lowerText.includes(word))
}

/**
 * Filters profanity from text with church context awareness
 *
 * @param text - The input text to filter
 * @param strictMode - If true, filters even contextual words. Default: false
 * @returns Filtered text
 */
export function filterProfanity(text: string, strictMode: boolean = false): string {
  if (!text || !text.trim()) return text

  let filteredText = text
  const lowerText = text.toLowerCase()

  // In a church context, biblical terms (hell, damn, damned) are ALWAYS legitimate
  // Only filter actual profanity
  for (const rule of CHURCH_CORRECTIONS) {
    // Filter profanity (biblical terms are NOT in CHURCH_CORRECTIONS anymore)
    const regex = new RegExp(`\\b${rule.word}\\b`, 'gi')
    filteredText = filteredText.replace(regex, rule.replacement)
  }

  return filteredText
}

/**
 * Checks if text contains profanity (excludes biblical terms)
 */
export function containsProfanity(text: string): boolean {
  if (!text || !text.trim()) return false

  const lowerText = text.toLowerCase()

  // Check for actual profanity only (biblical terms are allowed)
  return CHURCH_CORRECTIONS.some(rule => {
    const regex = new RegExp(`\\b${rule.word}\\b`, 'i')
    return regex.test(lowerText)
  })
}

/**
 * Add custom word replacements for church-specific vocabulary
 * This can be extended by users for their specific needs
 */
export class ChurchVocabularyFilter {
  private customReplacements: Map<string, string> = new Map()

  addReplacement(word: string, replacement: string) {
    this.customReplacements.set(word.toLowerCase(), replacement)
  }

  removeReplacement(word: string) {
    this.customReplacements.delete(word.toLowerCase())
  }

  apply(text: string): string {
    let result = text

    this.customReplacements.forEach((replacement, word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi')
      result = result.replace(regex, replacement)
    })

    return result
  }

  clear() {
    this.customReplacements.clear()
  }
}

export const churchVocabularyFilter = new ChurchVocabularyFilter()
