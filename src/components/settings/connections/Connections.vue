<template>
  <v-card :title="t('settings.connections.title')" color="transparent" flat>
    <template #subtitle>
      <i18n-t keypath="settings.connections.description" tag="label" scope="global">
        <template #icon>
          <v-icon color="success">
            mdi-broadcast
          </v-icon>
        </template>
      </i18n-t>
    </template>
    <ConnectionDialog
      v-model="dialog"
      :mode="dialog_mode"
      :connection="dialog_connection"
      :user-connection-id="dialog_user_connection_id"
    />
    <v-divider />
    <!-- Connection Info - Shows network details when broadcasting -->
    <v-card-text v-if="is_electron()">
      <ConnectionInfo />
    </v-card-text>

    <!-- HTTP Display Server - Electron only -->
    <v-card-text v-if="is_electron()">
      <v-row>
        <v-col :cols="12">
          <v-card>
            <v-list-item>
              <template #prepend>
                <v-icon icon="mdi-monitor-screenshot" size="30" color="secondary" class="mr-4" />
              </template>
              <v-list-item-title>{{ t('settings.connections.http_server.title') }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ httpServerRunning
                  ? t('settings.connections.http_server.running', { port: httpServerPort })
                  : t('settings.connections.http_server.stopped') }}
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  v-if="httpServerRunning"
                  class="mr-4"
                  variant="text"
                  icon="mdi-open-in-new"
                  @click="openDisplayClient"
                />
                <v-switch
                  v-model="httpServerEnabled"
                  color="primary"
                  inset
                  hide-details
                  @update:model-value="toggleHttpServer"
                />
              </template>
            </v-list-item>
            <!-- Port Configuration -->
            <v-card-text v-if="!httpServerRunning">
              <v-text-field
                v-model.number="httpServerStore.port"
                type="number"
                label="Port"
                :min="1024"
                :max="65535"
                :rules="portRules"
                variant="outlined"
                density="compact"
                hide-details="auto"
                hint="Port number (1024-65535)"
              />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>

    <v-divider v-if="is_electron()" />
    <v-card-text v-if="!is_electron()">
      <v-row>
        <!-- User-defined connections -->
        <!-- WebSockets -->
        <v-col
          v-for="(connection, i) in connectionsStore.user_websockets"
          :cols="12"
        >
          <v-card class="py-2" flat>
            <v-list-item
              :title="connectionsStore.user_websockets[i].title"
              :subtitle="display_subtitle(connectionsStore.user_websockets[i].type)"
            >
              <template #prepend>
                <v-icon
                  :icon="connectionsStore.user_websockets[i].icon"
                  size="30"
                  color="secondary"
                  class="mr-4"
                />
              </template>
              <v-spacer />
              <template #append>
                <v-btn
                  class="mr-4"
                  icon variant="text"
                  @click.stop="edit_connection(connectionsStore.user_websockets[i], i)"
                >
                  <v-icon>mdi-cog</v-icon>
                </v-btn>
                <v-switch
                  v-model="connection.enabled"
                  color="primary"
                  inset
                  hide-details
                  @update:model-value="toggle_open_user_websocket(i)"
                />
              </template>
            </v-list-item>
          </v-card>
        </v-col>
        <!-- Webhooks -->
        <v-col
          v-for="(connection, i) in connectionsStore.user_webhooks"
          :cols="12"
        >
          <v-card class="py-2" flat>
            <v-list-item
              :title="connectionsStore.user_webhooks[i].title"
              :subtitle="display_subtitle(connectionsStore.user_webhooks[i].type)"
            >
              <template #prepend>
                <v-icon
                  :icon="connectionsStore.user_webhooks[i].icon"
                  size="30"
                  color="secondary"
                  class="mr-4"
                />
              </template>
              <v-spacer />
              <template #append>
                <v-btn
                  class="mr-4"
                  icon variant="text"
                  @click.stop="edit_connection(connectionsStore.user_webhooks[i], i)"
                >
                  <v-icon>mdi-cog</v-icon>
                </v-btn>
                <v-switch
                  v-model="connectionsStore.user_webhooks[i].enabled"
                  color="primary"
                  inset
                  hide-details
                />
              </template>
            </v-list-item>
          </v-card>
        </v-col>
      </v-row>
      <p class="mt-6">
        <i18n-t keypath="settings.connections.action.add" tag="label" scope="global">
          <template #icon>
            <v-icon
              color="primary"
              size="small"
            >
              mdi-plus-circle-outline
            </v-icon>
          </template>
        </i18n-t>
      </p>
      <v-card class="mt-4" color="transparent" flat>
        <v-card-actions>
          <v-btn
            color="primary"
            variant="outlined"
            size="small"
            icon="mdi-plus"
            @click="add_user_connection()"
          />
        </v-card-actions>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDefaultStore } from '@/stores/default'
import { Connection, useConnectionsStore } from '@/stores/connections'
import { useHttpServerStore } from '@/stores/httpserver'
import ConnectionDialog from '@/components/settings/connections/dialogs/ConnectionDialog.vue'
import ConnectionInfo from '@/components/ConnectionInfo.vue'
import is_electron from '@/helpers/is_electron'

const { t } = useI18n()

declare const window: any

const connectionsStore = useConnectionsStore()
const defaultStore = useDefaultStore()
const httpServerStore = useHttpServerStore()

const dialog = ref(false)
const dialog_mode = ref<'add' | 'edit'>('add')
const dialog_connection = ref<(Connection)>(new Connection())
const dialog_user_connection_id = ref<number>(-1)

// HTTP Server state
const httpServerEnabled = ref(false)
const httpServerRunning = ref(false)
const httpServerPort = ref(8080)

// Port validation rules
const portRules = [
  (v: number) => !!v || 'Port is required',
  (v: number) => (v >= 1024 && v <= 65535) || 'Port must be between 1024 and 65535',
  (v: number) => Number.isInteger(v) || 'Port must be a whole number',
]

function display_subtitle(currentConnectionType: string) {
  return connectionsStore.types[currentConnectionType].display
}

function edit_connection(connection: Connection, userConnectionID?: number) {
  dialog_mode.value = 'edit'
  dialog_connection.value = connection

  if (userConnectionID === undefined) dialog_user_connection_id.value = -1
  else dialog_user_connection_id.value = userConnectionID

  dialog.value = true
}

function add_user_connection() {
  dialog_connection.value = new Connection()
  dialog_mode.value = 'add'
  dialog.value = true
}

function toggle_open_user_websocket(userConnectionID: number) {
  if (defaultStore.broadcasting) {
    if (connectionsStore.user_websockets[userConnectionID].enabled)
      connectionsStore.connect_user_websocket(userConnectionID)
    else
      connectionsStore.disconnect_user_websocket(userConnectionID)
  }
}

// HTTP Server functions
async function checkHttpServerStatus() {
  if (!is_electron()) return

  try {
    const status = await window.ipcRenderer.invoke('httpserver-status')
    httpServerRunning.value = status.running
    httpServerPort.value = status.port || 8080
    httpServerEnabled.value = status.running
  } catch (error) {
    console.error('Failed to check HTTP server status:', error)
  }
}

async function toggleHttpServer() {
  if (!is_electron()) return

  try {
    if (httpServerEnabled.value) {
      // Start server
      const result = await window.ipcRenderer.invoke('httpserver-start', {
        port: httpServerStore.port
      })
      if (result.success) {
        httpServerRunning.value = true
        httpServerPort.value = result.port
        httpServerStore.enabled = true
        defaultStore.show_snackbar('success', `HTTP server started on port ${result.port}`)
      } else {
        console.error('Failed to start HTTP server:', result.error)
        httpServerEnabled.value = false

        // Show user-friendly error message
        let errorMsg = 'Failed to start HTTP server'
        if (result.error.includes('EADDRINUSE')) {
          errorMsg = `Port ${httpServerStore.port} is already in use. Please choose a different port.`
        } else if (result.error.includes('EACCES')) {
          errorMsg = `Port ${httpServerStore.port} requires administrator privileges. Please use a port above 1024.`
        } else {
          errorMsg = `Failed to start server: ${result.error}`
        }
        defaultStore.show_snackbar('error', errorMsg)
      }
    } else {
      // Stop server
      const result = await window.ipcRenderer.invoke('httpserver-stop')
      if (result.success) {
        httpServerRunning.value = false
        httpServerStore.enabled = false
        defaultStore.show_snackbar('info', 'HTTP server stopped')
      } else {
        console.error('Failed to stop HTTP server:', result.error)
        httpServerEnabled.value = true
        defaultStore.show_snackbar('error', `Failed to stop server: ${result.error}`)
      }
    }
  } catch (error) {
    console.error('HTTP server toggle error:', error)
    httpServerEnabled.value = !httpServerEnabled.value
    defaultStore.show_snackbar('error', 'An unexpected error occurred')
  }
}

function openDisplayClient() {
  if (httpServerRunning.value && is_electron()) {
    window.ipcRenderer.send('open-external-url', `http://localhost:${httpServerPort.value}`)
  }
}

onMounted(async () => {
  await checkHttpServerStatus()
})
</script>
