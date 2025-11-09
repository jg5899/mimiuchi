/**
 * Agent system entry point
 * Registers all available agents
 */

import { agentRegistry } from './registry'
import { ServiceSetupValidator } from './ServiceSetupValidator'
import { APICostMonitor } from './APICostMonitor'
import { WebSocketHealthMonitor } from './WebSocketHealthMonitor'
import { SecurityAuditor } from './SecurityAuditor'

// Import additional agents as they're created
// import { TranslationQualityChecker } from './TranslationQualityChecker'
// import { ErrorPatternAnalyzer } from './ErrorPatternAnalyzer'
// import { PerformanceProfiler } from './PerformanceProfiler'
// import { MultiLanguageConsistencyChecker } from './MultiLanguageConsistencyChecker'

// Register all agents
export function registerAgents(): void {
  // Health agents
  agentRegistry.register(new ServiceSetupValidator())
  agentRegistry.register(new WebSocketHealthMonitor())

  // Cost agents
  agentRegistry.register(new APICostMonitor())

  // Security agents
  agentRegistry.register(new SecurityAuditor())

  // Quality agents
  // agentRegistry.register(new TranslationQualityChecker())

  // Performance agents
  // agentRegistry.register(new PerformanceProfiler())

  console.log(`[Agents] Registered ${agentRegistry.getAll().length} agents`)
}

// Auto-register on import
registerAgents()

// Re-export types and registry
export * from './types'
export { agentRegistry } from './registry'
export { useAgentsStore } from '@/stores/agents'
