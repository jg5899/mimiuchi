/**
 * Simple encryption/decryption helpers for sensitive data storage
 * Uses Web Crypto API (browser) or Node crypto (Electron)
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256

// Generate a deterministic key from a password
async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('mimiuchi-salt-v1'), // Fixed salt for deterministic key
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

// Get device-specific password (same across sessions on same device)
function getDevicePassword(): string {
  // Use navigator.userAgent + screen resolution as device fingerprint
  const deviceId = `${navigator.userAgent}-${screen.width}x${screen.height}`
  return deviceId
}

/**
 * Encrypt a string value
 */
export async function encryptValue(plaintext: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const key = await deriveKey(getDevicePassword())
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const encrypted = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv,
      },
      key,
      encoder.encode(plaintext)
    )

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encrypted), iv.length)

    // Convert to base64
    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    console.error('Encryption failed:', error)
    return plaintext // Fallback to plaintext if encryption fails
  }
}

/**
 * Decrypt a string value
 */
export async function decryptValue(ciphertext: string): Promise<string> {
  try {
    const key = await deriveKey(getDevicePassword())

    // Decode from base64
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)

    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv,
      },
      key,
      encrypted
    )

    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    console.error('Decryption failed:', error)
    return ciphertext // Return as-is if decryption fails (might be legacy plaintext)
  }
}

/**
 * Safely encrypt API key before storage
 */
export async function encryptApiKey(apiKey: string): Promise<string> {
  if (!apiKey || apiKey.length === 0) return ''
  return encryptValue(apiKey)
}

/**
 * Safely decrypt API key from storage
 */
export async function decryptApiKey(encrypted: string): Promise<string> {
  if (!encrypted || encrypted.length === 0) return ''

  // Check if it's already plaintext (starts with sk-)
  if (encrypted.startsWith('sk-')) {
    console.warn('API key is stored in plaintext, encrypting on next save')
    return encrypted
  }

  return decryptValue(encrypted)
}
