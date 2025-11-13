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
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDefaultStore } from '@/stores/default'
import { Connection, useConnectionsStore } from '@/stores/connections'
import ConnectionDialog from '@/components/settings/connections/dialogs/ConnectionDialog.vue'
import is_electron from '@/helpers/is_electron'

const { t } = useI18n()

declare const window: any

const connectionsStore = useConnectionsStore()
const defaultStore = useDefaultStore()

const dialog = ref(false)
const dialog_mode = ref<'add' | 'edit'>('add')
const dialog_connection = ref<(Connection)>(new Connection())
const dialog_user_connection_id = ref<number>(-1)

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
</script>
