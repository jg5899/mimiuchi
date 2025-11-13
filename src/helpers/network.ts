import is_electron from './is_electron'

export interface NetworkInterface {
  name: string
  address: string
  family: string
  internal: boolean
}

/**
 * Get local IP addresses from all network interfaces
 * Returns a promise that resolves to an array of network interfaces
 */
export async function getLocalIpAddresses(): Promise<NetworkInterface[]> {
  if (!is_electron()) {
    // In web mode, we can't access network interfaces
    // Return localhost as fallback
    return [{
      name: 'localhost',
      address: '127.0.0.1',
      family: 'IPv4',
      internal: true,
    }]
  }

  try {
    // Use IPC to get network interfaces from main process
    const interfaces = await (window as any).ipcRenderer.invoke('get-network-interfaces')
    return interfaces || []
  }
  catch (error) {
    console.error('Failed to get network interfaces:', error)
    return []
  }
}

/**
 * Format a WebSocket connection URL
 */
export function formatWebSocketUrl(address: string, port: number): string {
  // Handle IPv6 addresses
  const formattedAddress = address.includes(':') ? `[${address}]` : address
  return `ws://${formattedAddress}:${port}`
}

/**
 * Format an HTTP connection URL
 */
export function formatHttpUrl(address: string, port: number): string {
  // Handle IPv6 addresses
  const formattedAddress = address.includes(':') ? `[${address}]` : address
  return `http://${formattedAddress}:${port}`
}

/**
 * Get all connection URLs for a given port
 */
export async function getConnectionUrls(port: number, includeHttp: boolean = false): Promise<{ ws: string[], http: string[] }> {
  const interfaces = await getLocalIpAddresses()

  // Filter out internal/loopback addresses for the main list
  const externalInterfaces = interfaces.filter(iface => !iface.internal)

  const ws: string[] = externalInterfaces.map(iface =>
    formatWebSocketUrl(iface.address, port)
  )

  const http: string[] = includeHttp
    ? externalInterfaces.map(iface => formatHttpUrl(iface.address, port))
    : []

  return { ws, http }
}
