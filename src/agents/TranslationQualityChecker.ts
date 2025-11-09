/**
 * Translation Quality Checker Agent
 * Validates translation accuracy and theological correctness
 */

import { BaseAgent } from './BaseAgent'
import type { Agent } from './types'
import { useMultiTranslationStore } from '@/stores/multi_translation'
import { useTranslationStore } from '@/stores/translation'

interface QualityScore {
  overall: number // 0-100
  accuracy: number
  terminology: number
  consistency: number
}

export class TranslationQualityChecker extends BaseAgent implements Agent {
  readonly id = 'translation-quality-checker'
  readonly name = 'Translation Quality Checker'
  readonly description = 'Validates translation accuracy and theological correctness'
  readonly category = 'quality' as const
  readonly icon = 'mdi-translate-variant'

  private scores: Map<string, QualityScore> = new Map()

  // Biblical and liturgical terms that should be preserved or translated correctly
  private readonly THEOLOGICAL_TERMS = {
    // Core Christian terms
    'jesus': ['jesus', 'jesús', 'ісус', 'иисус'],
    'christ': ['christ', 'cristo', 'христос', 'христос'],
    'god': ['god', 'dios', 'бог', 'бог'],
    'lord': ['lord', 'señor', 'господь', 'господь'],
    'holy spirit': ['holy spirit', 'espíritu santo', 'святий дух', 'святой дух'],
    'scripture': ['scripture', 'escritura', 'писання', 'писание'],
    'gospel': ['gospel', 'evangelio', 'євангеліє', 'евангелие'],
    'salvation': ['salvation', 'salvación', 'спасіння', 'спасение'],
    'grace': ['grace', 'gracia', 'благодать', 'благодать'],
    'faith': ['faith', 'fe', 'віра', 'вера'],
    'prayer': ['prayer', 'oración', 'молитва', 'молитва'],
    'amen': ['amen', 'amén', 'амінь', 'аминь'],
    'hallelujah': ['hallelujah', 'aleluya', 'алилуя', 'аллилуйя'],

    // Church/liturgical terms
    'church': ['church', 'iglesia', 'церква', 'церковь'],
    'pastor': ['pastor', 'pastor', 'пастор', 'пастор'],
    'worship': ['worship', 'adoración', 'поклоніння', 'поклонение'],
    'blessing': ['blessing', 'bendición', 'благословення', 'благословение'],
    'communion': ['communion', 'comunión', 'причастя', 'причастие'],
    'baptism': ['baptism', 'bautismo', 'хрещення', 'крещение'],
  }

  // Common mistranslations to flag
  private readonly COMMON_ERRORS = [
    // Spanish
    { original: 'jesus', wrong: 'jesús rodriguez', correct: 'jesús' }, // Name confusion
    { original: 'grace', wrong: 'gracias', correct: 'gracia' }, // Thanks vs Grace

    // Generic issues
    { pattern: /\d+:\d+/, description: 'Scripture references should be preserved (e.g., John 3:16)' },
  ]

  protected async execute(): Promise<void> {
    await this.checkTranslationEnabled()
    await this.analyzeTranslationQuality()
    await this.checkTheologicalTerms()
    await this.checkConsistency()
    await this.generateQualityScores()
    this.generateQualityRecommendations()
  }

  private async checkTranslationEnabled(): Promise<void> {
    const translationStore = useTranslationStore()

    if (!translationStore.enabled) {
      this.addCheck({
        name: 'Translation Status',
        status: 'warning',
        message: 'Translation is disabled - no quality to check',
        severity: 'warning',
      })
      return
    }

    this.addCheck({
      name: 'Translation Status',
      status: 'success',
      message: 'Translation is enabled',
      severity: 'info',
    })
  }

  private async analyzeTranslationQuality(): Promise<void> {
    const multiTranslationStore = useMultiTranslationStore()
    const logs = multiTranslationStore.multiLogs
    const enabledStreams = multiTranslationStore.enabledStreams

    if (logs.length === 0) {
      this.addCheck({
        name: 'Translation Sample Size',
        status: 'warning',
        message: 'No translations to analyze - start a session first',
        severity: 'warning',
      })
      return
    }

    this.addCheck({
      name: 'Translation Sample Size',
      status: 'success',
      message: `Analyzing ${logs.length} transcripts across ${enabledStreams.length} language(s)`,
      severity: 'info',
      details: {
        logCount: logs.length,
        languages: enabledStreams.map(s => s.name)
      },
    })

    // Check for empty translations
    let emptyCount = 0
    enabledStreams.forEach(stream => {
      logs.forEach(log => {
        const translation = log.translations[stream.targetLang]
        if (!translation || translation.trim() === '') {
          emptyCount++
        }
      })
    })

    const expectedCount = logs.length * enabledStreams.length
    const successRate = ((expectedCount - emptyCount) / expectedCount * 100).toFixed(1)

    if (emptyCount > 0) {
      this.addCheck({
        name: 'Translation Completion',
        status: emptyCount > expectedCount * 0.1 ? 'error' : 'warning',
        message: `${emptyCount} missing translations (${successRate}% success rate)`,
        severity: emptyCount > expectedCount * 0.1 ? 'error' : 'warning',
        details: { emptyCount, expectedCount, successRate },
      })

      if (emptyCount > expectedCount * 0.1) {
        this.addRecommendation('⚠️ More than 10% of translations are missing - check API connectivity')
      }
    } else {
      this.addCheck({
        name: 'Translation Completion',
        status: 'success',
        message: '100% translation success rate',
        severity: 'info',
      })
    }
  }

  private async checkTheologicalTerms(): Promise<void> {
    const multiTranslationStore = useMultiTranslationStore()
    const logs = multiTranslationStore.multiLogs
    const enabledStreams = multiTranslationStore.enabledStreams

    let correctTerms = 0
    let totalTerms = 0
    const issues: string[] = []

    logs.forEach((log, logIndex) => {
      const originalLower = log.transcript.toLowerCase()

      // Check each theological term
      Object.entries(this.THEOLOGICAL_TERMS).forEach(([english, translations]) => {
        if (!originalLower.includes(english)) return

        totalTerms++

        enabledStreams.forEach((stream, langIndex) => {
          const translation = log.translations[stream.targetLang]
          if (!translation) return

          const translationLower = translation.toLowerCase()
          const expectedTerm = translations[langIndex + 1] // 0 is English, 1+ are other langs

          if (expectedTerm && translationLower.includes(expectedTerm)) {
            correctTerms++
          } else {
            issues.push(
              `Log ${logIndex + 1}: "${english}" in ${stream.name} should contain "${expectedTerm}"`
            )
          }
        })
      })
    })

    if (totalTerms === 0) {
      this.addCheck({
        name: 'Theological Terminology',
        status: 'success',
        message: 'No theological terms detected in sample',
        severity: 'info',
      })
      return
    }

    const accuracy = (correctTerms / totalTerms * 100).toFixed(1)

    if (issues.length > 0) {
      this.addCheck({
        name: 'Theological Terminology',
        status: issues.length > totalTerms * 0.2 ? 'error' : 'warning',
        message: `${correctTerms}/${totalTerms} terms correct (${accuracy}%)`,
        severity: issues.length > totalTerms * 0.2 ? 'error' : 'warning',
        details: { correctTerms, totalTerms, accuracy, issues: issues.slice(0, 5) },
      })

      if (issues.length > totalTerms * 0.2) {
        this.addRecommendation('❌ Theological terms have >20% errors - review translation quality')
      } else {
        this.addRecommendation('⚠️ Some theological terms may be mistranslated - spot check')
      }
    } else {
      this.addCheck({
        name: 'Theological Terminology',
        status: 'success',
        message: `All ${totalTerms} theological terms translated correctly`,
        severity: 'info',
      })
    }
  }

  private async checkConsistency(): Promise<void> {
    const multiTranslationStore = useMultiTranslationStore()
    const logs = multiTranslationStore.multiLogs
    const enabledStreams = multiTranslationStore.enabledStreams

    // Track how the same phrase is translated
    const phraseMap = new Map<string, Map<string, string[]>>() // phrase -> lang -> [translations]

    logs.forEach(log => {
      const phrase = log.transcript.toLowerCase().trim()
      if (phrase.length < 5) return // Skip very short phrases

      if (!phraseMap.has(phrase)) {
        phraseMap.set(phrase, new Map())
      }

      enabledStreams.forEach(stream => {
        const translation = log.translations[stream.targetLang]
        if (!translation) return

        const langMap = phraseMap.get(phrase)!
        if (!langMap.has(stream.targetLang)) {
          langMap.set(stream.targetLang, [])
        }

        langMap.get(stream.targetLang)!.push(translation)
      })
    })

    // Find inconsistencies (same phrase translated differently)
    let inconsistencies = 0
    const examples: string[] = []

    phraseMap.forEach((langMap, phrase) => {
      langMap.forEach((translations, lang) => {
        const unique = new Set(translations)
        if (unique.size > 1) {
          inconsistencies++
          if (examples.length < 3) {
            examples.push(
              `"${phrase}" translated ${unique.size} different ways in ${lang}`
            )
          }
        }
      })
    })

    if (inconsistencies > 0) {
      this.addCheck({
        name: 'Translation Consistency',
        status: 'warning',
        message: `${inconsistencies} phrase(s) translated inconsistently`,
        severity: 'warning',
        details: { inconsistencies, examples },
      })
      this.addRecommendation('💡 Consider adding custom vocabulary for consistent translations')
    } else {
      this.addCheck({
        name: 'Translation Consistency',
        status: 'success',
        message: 'Translations are consistent across repeated phrases',
        severity: 'info',
      })
    }
  }

  private async generateQualityScores(): Promise<void> {
    const multiTranslationStore = useMultiTranslationStore()
    const enabledStreams = multiTranslationStore.enabledStreams

    enabledStreams.forEach(stream => {
      // Calculate scores based on checks
      const completionCheck = this.checks.find(c => c.name === 'Translation Completion')
      const terminologyCheck = this.checks.find(c => c.name === 'Theological Terminology')
      const consistencyCheck = this.checks.find(c => c.name === 'Translation Consistency')

      let accuracyScore = 100
      let terminologyScore = 100
      let consistencyScore = 100

      // Deduct points for issues
      if (completionCheck?.status === 'error') accuracyScore -= 30
      else if (completionCheck?.status === 'warning') accuracyScore -= 10

      if (terminologyCheck?.status === 'error') terminologyScore -= 40
      else if (terminologyCheck?.status === 'warning') terminologyScore -= 15

      if (consistencyCheck?.status === 'warning') consistencyScore -= 20

      const overall = Math.round((accuracyScore + terminologyScore + consistencyScore) / 3)

      this.scores.set(stream.targetLang, {
        overall,
        accuracy: accuracyScore,
        terminology: terminologyScore,
        consistency: consistencyScore,
      })
    })

    // Report overall quality
    const avgScore = Array.from(this.scores.values())
      .reduce((sum, score) => sum + score.overall, 0) / this.scores.size

    this.addCheck({
      name: 'Overall Translation Quality',
      status: avgScore >= 80 ? 'success' : avgScore >= 60 ? 'warning' : 'error',
      message: `Quality Score: ${avgScore.toFixed(0)}/100`,
      severity: avgScore >= 80 ? 'info' : avgScore >= 60 ? 'warning' : 'error',
      details: Object.fromEntries(this.scores),
    })
  }

  private generateQualityRecommendations(): void {
    const avgScore = Array.from(this.scores.values())
      .reduce((sum, score) => sum + score.overall, 0) / this.scores.size

    if (avgScore >= 90) {
      this.addRecommendation('✅ Excellent translation quality!')
    } else if (avgScore >= 80) {
      this.addRecommendation('✓ Good translation quality - minor improvements possible')
    } else if (avgScore >= 60) {
      this.addRecommendation('⚠️ Translation quality is acceptable but could be improved')
    } else {
      this.addRecommendation('❌ Translation quality needs improvement - review settings')
    }

    // Specific recommendations based on scores
    this.scores.forEach((score, lang) => {
      if (score.terminology < 70) {
        this.addRecommendation(`📖 Add church-specific vocabulary for ${lang} translations`)
      }
      if (score.consistency < 70) {
        this.addRecommendation(`🔄 Enable custom vocabulary to improve ${lang} consistency`)
      }
      if (score.accuracy < 70) {
        this.addRecommendation(`⚙️ Check ${lang} translation configuration and API connectivity`)
      }
    })

    // General recommendations
    this.addRecommendation('💡 Regularly review translated content for theological accuracy')
    this.addRecommendation('💡 Consider having native speakers spot-check translations')
  }
}
