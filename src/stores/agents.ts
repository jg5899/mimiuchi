/**
 * Agent results store - tracks agent execution history and results
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AgentResult } from '@/agents/types'
import { agentRegistry } from '@/agents/registry'

export const useAgentsStore = defineStore('agents', () => {
  // Agent execution results
  const results = ref<AgentResult[]>([])
  const runningAgents = ref<Set<string>>(new Set())
  const MAX_RESULTS = 50 // Keep last 50 results

  // Get latest result for a specific agent
  const getLatestResult = (agentId: string) => {
    return computed(() => {
      return results.value
        .filter(r => r.agentName === agentId)
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0]
    })
  }

  // Get all results for a specific agent
  const getAgentResults = (agentId: string) => {
    return computed(() => {
      return results.value
        .filter(r => r.agentName === agentId)
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    })
  }

  // Check if agent is currently running
  const isAgentRunning = (agentId: string) => {
    return computed(() => runningAgents.value.has(agentId))
  }

  // Run an agent by ID
  async function runAgent(agentId: string): Promise<AgentResult | null> {
    const agent = agentRegistry.get(agentId)
    if (!agent) {
      console.error(`[AgentsStore] Agent ${agentId} not found`)
      return null
    }

    if (runningAgents.value.has(agentId)) {
      console.warn(`[AgentsStore] Agent ${agentId} is already running`)
      return null
    }

    runningAgents.value.add(agentId)
    console.log(`[AgentsStore] Running agent: ${agent.name}`)

    try {
      const result = await agent.run()
      results.value.unshift(result)

      // Trim old results
      if (results.value.length > MAX_RESULTS) {
        results.value = results.value.slice(0, MAX_RESULTS)
      }

      console.log(`[AgentsStore] Agent ${agent.name} completed:`, result.status)
      return result
    } catch (error: any) {
      console.error(`[AgentsStore] Agent ${agent.name} failed:`, error)
      return null
    } finally {
      runningAgents.value.delete(agentId)
    }
  }

  // Run multiple agents
  async function runAgents(agentIds: string[]): Promise<AgentResult[]> {
    const promises = agentIds.map(id => runAgent(id))
    const results = await Promise.all(promises)
    return results.filter((r): r is AgentResult => r !== null)
  }

  // Run all agents in a category
  async function runCategory(category: 'health' | 'cost' | 'quality' | 'security' | 'performance'): Promise<AgentResult[]> {
    const agents = agentRegistry.getByCategory(category)
    return runAgents(agents.map(a => a.id))
  }

  // Run all agents
  async function runAll(): Promise<AgentResult[]> {
    const agents = agentRegistry.getAll()
    return runAgents(agents.map(a => a.id))
  }

  // Clear results
  function clearResults(): void {
    results.value = []
  }

  // Get summary statistics
  const summary = computed(() => {
    const recentResults = results.value.slice(0, 10)
    return {
      total: recentResults.length,
      success: recentResults.filter(r => r.status === 'success').length,
      warning: recentResults.filter(r => r.status === 'warning').length,
      error: recentResults.filter(r => r.status === 'error').length,
      lastRun: recentResults[0]?.endTime,
    }
  })

  return {
    results,
    runningAgents,
    summary,
    getLatestResult,
    getAgentResults,
    isAgentRunning,
    runAgent,
    runAgents,
    runCategory,
    runAll,
    clearResults,
  }
})
