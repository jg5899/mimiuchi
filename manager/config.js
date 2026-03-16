import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CONFIG_DIR = join(homedir(), '.mimiuchi-manager')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')
const SESSION_PATH = join(CONFIG_DIR, 'last_session.json')

const DEFAULT_CONFIG = {
  pin: '',
  electron_path: '',
  funds: {
    deepgram: { api_key: '', project_id: '' },
    openai: { api_key: '', manual_balance: null }
  }
}

export function loadConfig() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
    return { ...DEFAULT_CONFIG }
  }
  const raw = readFileSync(CONFIG_PATH, 'utf-8')
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
}

export function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

export function loadLastSession() {
  if (!existsSync(SESSION_PATH)) return null
  try {
    return JSON.parse(readFileSync(SESSION_PATH, 'utf-8'))
  } catch { return null }
}

export function saveLastSession(stats) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(SESSION_PATH, JSON.stringify(stats, null, 2))
}
