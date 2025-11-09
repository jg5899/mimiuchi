/**
 * Base agent class with common functionality
 */

import type { Agent, AgentResult, AgentCheck, AgentConfig, AgentStatus } from './types'

export abstract class BaseAgent implements Agent {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly description: string
  abstract readonly category: Agent['category']
  abstract readonly icon: string

  protected config: AgentConfig = {
    enabled: true,
    autoRun: false,
  }

  protected checks: AgentCheck[] = []
  protected recommendations: string[] = []
  protected startTime: Date | null = null

  configure(config: AgentConfig): void {
    this.config = { ...this.config, ...config }
  }

  async run(): Promise<AgentResult> {
    this.startTime = new Date()
    this.checks = []
    this.recommendations = []

    try {
      await this.execute()
      const endTime = new Date()
      const duration = endTime.getTime() - this.startTime.getTime()

      // Determine overall status
      const status = this.determineStatus()

      return {
        agentName: this.name,
        startTime: this.startTime,
        endTime,
        duration,
        status,
        summary: this.generateSummary(),
        checks: this.checks,
        recommendations: this.recommendations,
      }
    } catch (error: any) {
      const endTime = new Date()
      const duration = endTime.getTime() - (this.startTime?.getTime() || 0)

      this.addCheck({
        name: 'Agent Execution',
        status: 'error',
        message: `Agent failed: ${error.message}`,
        severity: 'critical',
      })

      return {
        agentName: this.name,
        startTime: this.startTime || new Date(),
        endTime,
        duration,
        status: 'error',
        summary: `Agent failed: ${error.message}`,
        checks: this.checks,
        recommendations: this.recommendations,
      }
    }
  }

  protected abstract execute(): Promise<void>

  protected addCheck(check: Omit<AgentCheck, 'timestamp'>): void {
    this.checks.push({
      ...check,
      timestamp: new Date(),
    })
  }

  protected addRecommendation(recommendation: string): void {
    this.recommendations.push(recommendation)
  }

  protected determineStatus(): AgentStatus {
    const hasError = this.checks.some(c => c.status === 'error')
    const hasWarning = this.checks.some(c => c.status === 'warning')

    if (hasError) return 'error'
    if (hasWarning) return 'warning'
    return 'success'
  }

  protected generateSummary(): string {
    const total = this.checks.length
    const errors = this.checks.filter(c => c.status === 'error').length
    const warnings = this.checks.filter(c => c.status === 'warning').length
    const success = this.checks.filter(c => c.status === 'success').length

    if (errors > 0) {
      return `${errors} error(s), ${warnings} warning(s), ${success} passed`
    } else if (warnings > 0) {
      return `${warnings} warning(s), ${success} passed`
    } else {
      return `All ${total} checks passed`
    }
  }

  protected async checkApiConnection(
    url: string,
    name: string,
    headers?: Record<string, string>
  ): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: headers || {},
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        this.addCheck({
          name,
          status: 'success',
          message: `${name} is accessible`,
          severity: 'info',
        })
        return true
      } else {
        this.addCheck({
          name,
          status: 'error',
          message: `${name} returned status ${response.status}`,
          severity: 'error',
        })
        return false
      }
    } catch (error: any) {
      this.addCheck({
        name,
        status: 'error',
        message: `Cannot connect to ${name}: ${error.message}`,
        severity: 'error',
      })
      return false
    }
  }
}
