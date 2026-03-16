import { loadConfig } from './config.js'

const POLL_INTERVAL = 5 * 60 * 1000
let cachedFunds = { deepgram: null, openai: null }
let pollTimer = null

export function getCachedFunds() {
  return { ...cachedFunds }
}

export async function pollFunds() {
  const config = loadConfig()
  await Promise.allSettled([
    pollDeepgram(config.funds?.deepgram),
    pollOpenAI(config.funds?.openai)
  ])
  return getCachedFunds()
}

async function pollDeepgram(dgConfig) {
  if (!dgConfig?.api_key || !dgConfig?.project_id) {
    cachedFunds.deepgram = { available: false, reason: 'not_configured' }
    return
  }

  try {
    const res = await fetch(
      'https://api.deepgram.com/v1/projects/' + dgConfig.project_id + '/balances',
      { headers: { 'Authorization': 'Token ' + dgConfig.api_key } }
    )
    if (!res.ok) {
      cachedFunds.deepgram = { available: false, reason: 'api_error_' + res.status }
      return
    }
    const data = await res.json()
    const balances = data.balances || []
    const total = balances.reduce((sum, b) => sum + (b.amount || 0), 0)
    cachedFunds.deepgram = {
      available: true,
      balance: total,
      currency: balances[0]?.units || 'usd',
      polled_at: Date.now()
    }
  } catch {
    cachedFunds.deepgram = { available: false, reason: 'network_error' }
  }
}

async function pollOpenAI(oaiConfig) {
  if (oaiConfig?.manual_balance != null) {
    cachedFunds.openai = {
      available: true,
      balance: oaiConfig.manual_balance,
      currency: 'usd',
      manual: true,
      polled_at: Date.now()
    }
  } else {
    cachedFunds.openai = { available: false, reason: 'not_configured' }
  }
}

export function startPolling() {
  pollFunds()
  pollTimer = setInterval(pollFunds, POLL_INTERVAL)
}

export function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
}
