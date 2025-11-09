/**
 * Agent system types and interfaces
 */

export type AgentStatus = 'idle' | 'running' | 'success' | 'warning' | 'error'
export type AgentSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface AgentCheck {
  name: string
  status: AgentStatus
  message: string
  severity?: AgentSeverity
  details?: any
  timestamp?: Date
}

export interface AgentResult {
  agentName: string
  startTime: Date
  endTime?: Date
  duration?: number
  status: AgentStatus
  summary: string
  checks: AgentCheck[]
  recommendations: string[]
  metadata?: any
}

export interface AgentConfig {
  enabled: boolean
  autoRun?: boolean
  interval?: number // Auto-run interval in ms
  options?: Record<string, any>
}

export interface Agent {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly category: 'health' | 'cost' | 'quality' | 'security' | 'performance'
  readonly icon: string

  run(): Promise<AgentResult>
  stop?(): void
  configure?(config: AgentConfig): void
}

export interface AgentRegistry {
  agents: Map<string, Agent>
  register(agent: Agent): void
  unregister(agentId: string): void
  get(agentId: string): Agent | undefined
  getByCategory(category: Agent['category']): Agent[]
  getAll(): Agent[]
}
