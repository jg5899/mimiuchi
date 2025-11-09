<template>
  <v-card title="Diagnostic Tools" subtitle="Run automated checks and health monitors" color="transparent" flat>
    <v-divider />
    <v-card-text>
      <!-- Quick Actions -->
      <v-row>
        <v-col :cols="12">
          <h3 class="mb-2">
            Quick Actions
          </h3>
        </v-col>
        <v-col :cols="12">
          <v-btn
            color="primary"
            prepend-icon="mdi-play-circle"
            :loading="agentsStore.runningAgents.size > 0"
            @click="runPreServiceCheck"
          >
            Run Pre-Service Check
          </v-btn>
          <v-btn
            color="secondary"
            variant="outlined"
            prepend-icon="mdi-security"
            class="ml-2"
            :loading="agentsStore.isAgentRunning('security-auditor').value"
            @click="runSecurityAudit"
          >
            Security Audit
          </v-btn>
        </v-col>
      </v-row>

      <v-divider class="my-6" />

      <!-- Available Agents by Category -->
      <v-row>
        <v-col :cols="12">
          <h3 class="mb-4">
            Available Diagnostic Agents
          </h3>
        </v-col>

        <!-- Health Agents -->
        <v-col :cols="12">
          <h4 class="text-subtitle-1 mb-2">
            <v-icon>mdi-heart-pulse</v-icon> Health & System Checks
          </h4>
          <v-list>
            <v-list-item
              v-for="agent in healthAgents"
              :key="agent.id"
              :prepend-icon="agent.icon"
              :title="agent.name"
              :subtitle="agent.description"
            >
              <template #append>
                <v-btn
                  size="small"
                  color="primary"
                  :loading="agentsStore.isAgentRunning(agent.id).value"
                  @click="runAgent(agent.id)"
                >
                  Run
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-col>

        <!-- Cost Agents -->
        <v-col :cols="12">
          <h4 class="text-subtitle-1 mb-2">
            <v-icon>mdi-currency-usd</v-icon> Cost Analysis
          </h4>
          <v-list>
            <v-list-item
              v-for="agent in costAgents"
              :key="agent.id"
              :prepend-icon="agent.icon"
              :title="agent.name"
              :subtitle="agent.description"
            >
              <template #append>
                <v-btn
                  size="small"
                  color="primary"
                  :loading="agentsStore.isAgentRunning(agent.id).value"
                  @click="runAgent(agent.id)"
                >
                  Run
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-col>

        <!-- Security Agents -->
        <v-col :cols="12">
          <h4 class="text-subtitle-1 mb-2">
            <v-icon>mdi-shield-check</v-icon> Security
          </h4>
          <v-list>
            <v-list-item
              v-for="agent in securityAgents"
              :key="agent.id"
              :prepend-icon="agent.icon"
              :title="agent.name"
              :subtitle="agent.description"
            >
              <template #append>
                <v-btn
                  size="small"
                  color="primary"
                  :loading="agentsStore.isAgentRunning(agent.id).value"
                  @click="runAgent(agent.id)"
                >
                  Run
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-col>
      </v-row>

      <v-divider class="my-6" />

      <!-- Latest Results -->
      <v-row v-if="agentsStore.results.length > 0">
        <v-col :cols="12">
          <h3 class="mb-4">
            Latest Results
          </h3>
        </v-col>
        <v-col :cols="12">
          <v-expansion-panels>
            <v-expansion-panel
              v-for="result in agentsStore.results.slice(0, 5)"
              :key="`${result.agentName}-${result.startTime}`"
            >
              <v-expansion-panel-title>
                <div class="d-flex align-center">
                  <v-icon :color="getStatusColor(result.status)" class="mr-2">
                    {{ getStatusIcon(result.status) }}
                  </v-icon>
                  <div>
                    <div class="font-weight-bold">
                      {{ result.agentName }}
                    </div>
                    <div class="text-caption text-disabled">
                      {{ formatDate(result.startTime) }} • {{ result.duration }}ms
                    </div>
                  </div>
                </div>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <div class="mb-4">
                  <strong>Summary:</strong> {{ result.summary }}
                </div>

                <v-list density="compact">
                  <v-list-subheader>Checks</v-list-subheader>
                  <v-list-item
                    v-for="(check, index) in result.checks"
                    :key="index"
                    :prepend-icon="getStatusIcon(check.status)"
                    :title="check.name"
                    :subtitle="check.message"
                  >
                    <template #prepend>
                      <v-icon :color="getStatusColor(check.status)">
                        {{ getStatusIcon(check.status) }}
                      </v-icon>
                    </template>
                  </v-list-item>
                </v-list>

                <div v-if="result.recommendations.length > 0" class="mt-4">
                  <strong>Recommendations:</strong>
                  <v-list density="compact">
                    <v-list-item
                      v-for="(rec, index) in result.recommendations"
                      :key="index"
                      prepend-icon="mdi-lightbulb-outline"
                    >
                      {{ rec }}
                    </v-list-item>
                  </v-list>
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-col>

        <v-col :cols="12">
          <v-btn
            variant="outlined"
            prepend-icon="mdi-delete"
            @click="agentsStore.clearResults()"
          >
            Clear Results
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAgentsStore } from '@/stores/agents'
import { agentRegistry } from '@/agents'
import type { AgentStatus } from '@/agents/types'

const agentsStore = useAgentsStore()

const healthAgents = computed(() => agentRegistry.getByCategory('health'))
const costAgents = computed(() => agentRegistry.getByCategory('cost'))
const securityAgents = computed(() => agentRegistry.getByCategory('security'))

async function runAgent(agentId: string) {
  await agentsStore.runAgent(agentId)
}

async function runPreServiceCheck() {
  await agentsStore.runAgent('service-setup-validator')
}

async function runSecurityAudit() {
  await agentsStore.runAgent('security-auditor')
}

function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'error':
      return 'error'
    default:
      return 'grey'
  }
}

function getStatusIcon(status: AgentStatus): string {
  switch (status) {
    case 'success':
      return 'mdi-check-circle'
    case 'warning':
      return 'mdi-alert'
    case 'error':
      return 'mdi-close-circle'
    case 'running':
      return 'mdi-loading'
    default:
      return 'mdi-circle-outline'
  }
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString()
}
</script>
