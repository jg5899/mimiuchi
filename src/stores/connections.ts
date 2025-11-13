import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDefaultStore } from './default'
import { i18n } from '@/plugins/i18n'

export type ConnectionTypes = 'webhook' | 'websocket'

export class PropsWebSocket {
  address: string = ''
  port: number = 80
}

export class PropsWebhook {
  address_full: string = ''
}

export class Connection {
  // Display
  enabled: boolean
  icon: string
  title: string
  type: ConnectionTypes

  // Connection dialog flags
  edit_hide_title?: boolean

  // type-specific properties
  websocket?: PropsWebSocket
  webhook?: PropsWebhook

  constructor() {
    this.enabled = false
    this.icon = 'mdi-transit-connection-horizontal'
    this.title = ''
    this.type = 'websocket'
    this.websocket = new PropsWebSocket()
  }
}

export interface TypeDisplayData {
  display: string
  selectable: boolean
}

interface TypeDisplays {
  [key: string]: TypeDisplayData
}

export const useConnectionsStore = defineStore('connections', () => {
  const types: TypeDisplays = {
    websocket: {
      display: 'WebSocket',
      selectable: true,
    },
    webhook: {
      display: 'Webhook',
      selectable: true,
    },
  }

  // User-defined connections
  const user_websockets = ref<Connection[]>([])
  const user_webhooks = ref<Connection[]>([]) // user_websockets and open.user_websockets have parallel indices

  // Open connections
  const open: {
    user_websockets: (WebSocket | null)[]
  } = {
    user_websockets: [],
  }

  function reset() {
    user_websockets.value = []
    user_webhooks.value = []
  }

  // Returns a string that represents a WebSocket address
  function render_websocketaddress(address: string, port: number) {
    let rendered_address: string = address

    if (rendered_address.includes(':')) rendered_address = `[${rendered_address}]` // IPv6 address handling

    return `ws://${rendered_address}:${port}`
  }

  // Returns a reference to a WebSocket
  function connect_websocket(connection: Connection, user_connection_id?: number) {
    const defaultStore = useDefaultStore()
    let new_connection: WebSocket | null
    const rendered_address = render_websocketaddress(connection.websocket!.address, connection.websocket!.port)

    try {
      new_connection = new WebSocket(rendered_address)

      new_connection.onopen = () => {
        defaultStore.show_snackbar('success', `${i18n.t('snackbar.connections.websocket.opened')} (${rendered_address})`)
        defaultStore.broadcasting = true
        defaultStore.connections_count += 1
      }

      new_connection.onmessage = (event: any) => {
        const msg = JSON.parse(event.data)
        if (msg.event === 'connect' && msg.version !== __APP_VERSION__)
          defaultStore.show_snackbar('error', i18n.t('snackbar.version_mismatch'))
      }

      new_connection.onclose = (event) => {
        console.log(`WebSocket closed. (${rendered_address})`)

        if (defaultStore.broadcasting)
          defaultStore.show_snackbar('info', `${i18n.t('snackbar.connections.websocket.closed')} (${rendered_address}): ${event.reason}`)

        if (user_connection_id === undefined)
          new_connection = null
        else
          open.user_websockets[user_connection_id] = null

        if (event.wasClean && [1000, 1001].includes(event.code))
          defaultStore.connections_count -= 1
      }

      new_connection.onerror = (event) => {
        console.error(event)
      }

      return new_connection
    }
    catch (error) {
      console.error(error)
    }
  }


  function connect_user_websocket(user_connection_id: number) {
    const new_websocket: (WebSocket | null | undefined) = connect_websocket(user_websockets.value[user_connection_id], user_connection_id)

    if (new_websocket) open.user_websockets[user_connection_id] = new_websocket
  }

  function disconnect_user_websocket(user_connection_id: number) {
    open.user_websockets[user_connection_id]?.close(1000, 'Disconnected by user.')
    open.user_websockets[user_connection_id] = null
  }

  function toggle_broadcast() {
    const defaultStore = useDefaultStore()

    defaultStore.broadcasting = !defaultStore.broadcasting // Broadcast toggle

    if (!defaultStore.broadcasting) { // Broadcast stop
      // Close user-defined connections
      for (let i = 0; i < open.user_websockets.length; i++) {
        disconnect_user_websocket(i)
      }

      return
    }

    // Broadcast start
    const connectionsStore = useConnectionsStore()

    // Open user-defined connections
    for (let i = 0; i < connectionsStore.user_websockets.length; i++) {
      if (connectionsStore.user_websockets[i].enabled) connect_user_websocket(i)
    }
  }

  return {
    types,
    user_websockets,
    user_webhooks,
    open,
    reset,
    connect_user_websocket,
    disconnect_user_websocket,
    toggle_broadcast,
  }
})
