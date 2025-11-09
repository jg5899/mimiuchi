/**
 * API Cost Monitor Agent
 * Tracks and analyzes API usage costs
 */

import { BaseAgent } from './BaseAgent'
import type { Agent } from './types'
import { useMultiTranslationStore } from '@/stores/multi_translation'
import { useLogsStore } from '@/stores/logs'
import { useSpeechStore } from '@/stores/speech'

interface CostBreakdown {
  stt: {
    provider: string
    minutes: number
    cost: number
  }
  translation: {
    provider: string
    requests: number
    languages: number
    cost: number
  }
  total: number
}

export class APICostMonitor extends BaseAgent implements Agent {
  readonly id = 'api-cost-monitor'
  readonly name = 'API Cost Monitor'
  readonly description = 'Tracks API usage and calculates costs'
  readonly category = 'cost' as const
  readonly icon = 'mdi-currency-usd'

  // Pricing (as of 2025)
  private readonly PRICING = {
    deepgram: 0.0043, // per minute
    whisper: 0.006, // per minute
    whisper_gpt4o_postprocess: 0.03, // per minute (additional)
    openai_gpt4o_mini_input: 0.15 / 1_000_000, // per token
    openai_gpt4o_mini_output: 0.60 / 1_000_000, // per token
    avg_translation_tokens: 300, // average tokens per translation (input + output)
  }

  private costBreakdown: CostBreakdown = {
    stt: { provider: '', minutes: 0, cost: 0 },
    translation: { provider: '', requests: 0, languages: 0, cost: 0 },
    total: 0,
  }

  protected async execute(): Promise<void> {
    await this.analyzeSTTCosts()
    await this.analyzeTranslationCosts()
    await this.calculateProjectedCosts()
    this.generateCostRecommendations()
  }

  private async analyzeSTTCosts(): Promise<void> {
    const speechStore = useSpeechStore()
    const logsStore = useLogsStore()

    const sttType = speechStore.stt.type.value
    const transcriptCount = logsStore.logs.length

    // Estimate session duration (assuming ~2 seconds per transcript entry)
    const estimatedMinutes = (transcriptCount * 2) / 60

    let cost = 0
    let provider = sttType || 'none'

    if (sttType === 'deepgram') {
      cost = estimatedMinutes * this.PRICING.deepgram
      provider = 'Deepgram Nova-2'
    } else if (sttType === 'whisper') {
      cost = estimatedMinutes * this.PRICING.whisper
      provider = 'OpenAI Whisper'

      // Add GPT-4o post-processing cost if enabled
      if (speechStore.stt.whisperUseGPT4oPostProcessing) {
        cost += estimatedMinutes * this.PRICING.whisper_gpt4o_postprocess
        provider += ' + GPT-4o'
      }
    } else if (sttType === 'webspeech') {
      cost = 0
      provider = 'Web Speech API (Free)'
    }

    this.costBreakdown.stt = {
      provider,
      minutes: estimatedMinutes,
      cost,
    }

    if (cost > 0) {
      this.addCheck({
        name: 'STT Costs',
        status: cost > 1 ? 'warning' : 'success',
        message: `${provider}: ${estimatedMinutes.toFixed(1)} min = $${cost.toFixed(2)}`,
        severity: cost > 1 ? 'warning' : 'info',
        details: this.costBreakdown.stt,
      })
    } else {
      this.addCheck({
        name: 'STT Costs',
        status: 'success',
        message: `${provider}: $0.00 (free)`,
        severity: 'info',
      })
    }
  }

  private async analyzeTranslationCosts(): Promise<void> {
    const multiTranslationStore = useMultiTranslationStore()
    const enabledLanguages = multiTranslationStore.enabledStreams
    const logCount = multiTranslationStore.multiLogs.length

    if (enabledLanguages.length === 0 || logCount === 0) {
      this.addCheck({
        name: 'Translation Costs',
        status: 'success',
        message: 'No translations performed: $0.00',
        severity: 'info',
      })
      return
    }

    // Estimate translation requests (each log × each language)
    const translationRequests = logCount * enabledLanguages.length

    // Estimate token cost
    const estimatedCost = translationRequests * this.PRICING.avg_translation_tokens * (
      this.PRICING.openai_gpt4o_mini_input + this.PRICING.openai_gpt4o_mini_output
    )

    this.costBreakdown.translation = {
      provider: 'OpenAI GPT-4o-mini',
      requests: translationRequests,
      languages: enabledLanguages.length,
      cost: estimatedCost,
    }

    this.addCheck({
      name: 'Translation Costs',
      status: estimatedCost > 2 ? 'warning' : 'success',
      message: `${enabledLanguages.length} language(s), ${translationRequests} requests = $${estimatedCost.toFixed(2)}`,
      severity: estimatedCost > 2 ? 'warning' : 'info',
      details: this.costBreakdown.translation,
    })
  }

  private async calculateProjectedCosts(): Promise<void> {
    const total = this.costBreakdown.stt.cost + this.costBreakdown.translation.cost

    this.costBreakdown.total = total

    // Project monthly costs (assuming 4 services per month, 1 hour each)
    const avgServiceLength = 60 // minutes
    const servicesPerMonth = 4
    const currentSessionLength = this.costBreakdown.stt.minutes

    const scaleFactor = currentSessionLength > 0
      ? avgServiceLength / currentSessionLength
      : 1

    const projectedPerService = total * scaleFactor
    const projectedMonthly = projectedPerService * servicesPerMonth

    this.addCheck({
      name: 'Total Session Cost',
      status: total > 5 ? 'error' : total > 2 ? 'warning' : 'success',
      message: `Current session: $${total.toFixed(2)}`,
      severity: total > 5 ? 'error' : total > 2 ? 'warning' : 'info',
      details: { total, breakdown: this.costBreakdown },
    })

    this.addCheck({
      name: 'Projected Monthly Cost',
      status: projectedMonthly > 50 ? 'error' : projectedMonthly > 20 ? 'warning' : 'success',
      message: `Estimated: $${projectedMonthly.toFixed(2)}/month (${servicesPerMonth} services)`,
      severity: projectedMonthly > 50 ? 'error' : projectedMonthly > 20 ? 'warning' : 'info',
      details: {
        perService: projectedPerService,
        monthly: projectedMonthly,
        servicesPerMonth,
      },
    })
  }

  private generateCostRecommendations(): void {
    const { stt, translation, total } = this.costBreakdown

    // STT recommendations
    if (stt.provider.includes('Whisper') && stt.provider.includes('GPT-4o')) {
      this.addRecommendation('💡 Disable GPT-4o post-processing to save ~80% on STT costs')
    }

    if (stt.provider === 'OpenAI Whisper' && stt.cost > 0.5) {
      this.addRecommendation('💡 Switch to Deepgram Nova-2 to save 28% on STT costs ($0.0043/min vs $0.006/min)')
    }

    if (stt.provider === 'Deepgram Nova-2' || stt.provider.includes('Whisper')) {
      this.addRecommendation('💡 Use Web Speech API (free) for lower accuracy but $0 cost')
    }

    // Translation recommendations
    if (translation.languages > 3) {
      const savings = ((translation.languages - 3) / translation.languages * translation.cost).toFixed(2)
      this.addRecommendation(`💡 Reduce from ${translation.languages} to 3 languages to save ~$${savings} per session`)
    }

    if (translation.cost > stt.cost && stt.cost > 0) {
      const ratio = (translation.cost / stt.cost).toFixed(1)
      this.addRecommendation(`💡 Translation costs are ${ratio}x higher than STT - consider reducing languages`)
    }

    // Budget warnings
    if (total > 5) {
      this.addRecommendation(`⚠️ Current session cost ($${total.toFixed(2)}) is high - review settings`)
    }

    // Cost-saving summary
    if (translation.languages > 0 && stt.provider !== 'Web Speech API (Free)') {
      const withWebSpeech = translation.cost
      const savings = total - withWebSpeech
      if (savings > 0.5) {
        this.addRecommendation(`💰 Potential savings: Use Web Speech API to reduce costs by $${savings.toFixed(2)} per session`)
      }
    }
  }
}
