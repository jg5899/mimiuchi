export async function check_update(): Promise<string | null> {
  try {
    const response = await fetch('https://github.com/naeruru/mimiuchi/releases/latest')
    if (!response.ok) {
      console.error('[UpdateCheck] HTTP error:', response.status)
      return null
    }
    const parsed_url = response.url.split('/')
    return parsed_url[parsed_url.length - 1] || null
  } catch (error) {
    console.error('[UpdateCheck] Failed to check for updates:', error)
    return null
  }
}
