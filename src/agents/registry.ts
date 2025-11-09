/**
 * Agent registry - manages all available agents
 */

import type { Agent, AgentRegistry as IAgentRegistry } from './types'

class AgentRegistry implements IAgentRegistry {
  agents: Map<string, Agent> = new Map()

  register(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      console.warn(`Agent ${agent.id} is already registered, replacing...`)
    }
    this.agents.set(agent.id, agent)
    console.log(`[AgentRegistry] Registered agent: ${agent.name} (${agent.id})`)
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId)
    console.log(`[AgentRegistry] Unregistered agent: ${agentId}`)
  }

  get(agentId: string): Agent | undefined {
    return this.agents.get(agentId)
  }

  getByCategory(category: Agent['category']): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.category === category)
  }

  getAll(): Agent[] {
    return Array.from(this.agents.values())
  }
}

export const agentRegistry = new AgentRegistry()
