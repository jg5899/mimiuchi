<template>
  <v-card v-if="showConnectionInfo" color="transparent" flat class="mb-4">
    <v-card-title class="text-subtitle-1 font-weight-bold">
      <v-icon class="mr-2" color="primary">mdi-network-outline</v-icon>
      {{ t('settings.connections.info.title') }}
    </v-card-title>
    <v-card-subtitle class="text-caption">
      {{ t('settings.connections.info.description') }}
    </v-card-subtitle>
    <v-divider class="my-2" />
    <v-card-text>
      <v-list density="compact" class="pa-0">
        <!-- WebSocket URLs -->
        <v-list-subheader v-if="websocketUrls.length > 0" class="px-0">
          <v-icon size="small" class="mr-1">mdi-access-point-network</v-icon>
          WebSocket URLs
        </v-list-subheader>
        <v-list-item
          v-for="(url, index) in websocketUrls"
          :key="`ws-${index}`"
          class="px-0"
        >
          <v-list-item-title class="text-body-2 font-mono">
            {{ url }}
          </v-list-item-title>
          <template #append>
            <v-btn
              icon
              size="small"
              variant="text"
              @click="copyToClipboard(url)"
            >
              <v-icon size="small">
                {{ copiedUrl === url ? 'mdi-check' : 'mdi-content-copy' }}
              </v-icon>
            </v-btn>
          </template>
        </v-list-item>

        <!-- HTTP URLs (if enabled) -->
        <template v-if="httpUrls.length > 0">
          <v-divider class="my-2" />
          <v-list-subheader class="px-0">
            <v-icon size="small" class="mr-1">mdi-web</v-icon>
            HTTP URLs
          </v-list-subheader>
          <v-list-item
            v-for="(url, index) in httpUrls"
            :key="`http-${index}`"
            class="px-0"
          >
            <v-list-item-title class="text-body-2 font-mono">
              {{ url }}
            </v-list-item-title>
            <template #append>
              <v-btn
                icon
                size="small"
                variant="text"
                @click="copyToClipboard(url)"
              >
                <v-icon size="small">
                  {{ copiedUrl === url ? 'mdi-check' : 'mdi-content-copy' }}
                </v-icon>
              </v-btn>
            </template>
          </v-list-item>
        </template>

        <!-- Local IP Addresses -->
        <v-divider class="my-2" />
        <v-list-subheader class="px-0">
          <v-icon size="small" class="mr-1">mdi-ip-network</v-icon>
          {{ t('settings.connections.info.local_addresses') }}
        </v-list-subheader>
        <v-list-item
          v-for="(iface, index) in networkInterfaces"
          :key="`ip-${index}`"
          class="px-0"
        >
          <v-list-item-title class="text-body-2">
            <span class="font-weight-medium">{{ iface.name }}:</span>
            <span class="font-mono ml-2">{{ iface.address }}</span>
            <v-chip
              v-if="iface.family === 'IPv6'"
              size="x-small"
              class="ml-2"
              color="info"
            >
              IPv6
            </v-chip>
          </v-list-item-title>
        </v-list-item>

        <!-- No interfaces message -->
        <v-list-item v-if="networkInterfaces.length === 0" class="px-0">
          <v-list-item-title class="text-body-2 text-medium-emphasis">
            {{ t('settings.connections.info.no_interfaces') }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDefaultStore } from '@/stores/default'
import { useConnectionsStore } from '@/stores/connections'
import { getLocalIpAddresses, getConnectionUrls, type NetworkInterface } from '@/helpers/network'
import is_electron from '@/helpers/is_electron'

const { t } = useI18n()
const defaultStore = useDefaultStore()
const connectionsStore = useConnectionsStore()

const networkInterfaces = ref<NetworkInterface[]>([])
const websocketUrls = ref<string[]>([])
const httpUrls = ref<string[]>([])
const copiedUrl = ref<string | null>(null)

// Show connection info when broadcasting is enabled (in Electron mode)
const showConnectionInfo = computed(() => {
  return is_electron() && defaultStore.broadcasting
})

// Get the port from user connections (use first enabled connection's port or default to 8080)
const connectionPort = computed(() => {
  const firstConnection = connectionsStore.user_websockets.find(conn => conn.enabled)
  return firstConnection?.websocket?.port || 8080
})

// Load network interfaces and generate URLs
async function loadNetworkInfo() {
  try {
    const interfaces = await getLocalIpAddresses()
    networkInterfaces.value = interfaces.filter(iface => !iface.internal)

    const urls = await getConnectionUrls(connectionPort.value, false)
    websocketUrls.value = urls.ws
    httpUrls.value = urls.http
  }
  catch (error) {
    console.error('Failed to load network info:', error)
  }
}

// Copy URL to clipboard
async function copyToClipboard(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    copiedUrl.value = url
    setTimeout(() => {
      copiedUrl.value = null
    }, 2000)
  }
  catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Load network info when component mounts
onMounted(() => {
  if (showConnectionInfo.value) {
    loadNetworkInfo()
  }
})

// Reload when broadcasting state changes
watch(() => defaultStore.broadcasting, (newValue) => {
  if (newValue) {
    loadNetworkInfo()
  }
})

// Reload when connection port changes
watch(connectionPort, () => {
  if (showConnectionInfo.value) {
    loadNetworkInfo()
  }
})
</script>

<style scoped>
.font-mono {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
}
</style>
