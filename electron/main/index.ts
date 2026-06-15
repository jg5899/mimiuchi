import { createRequire } from 'node:module'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import * as fs from 'node:fs'
import { app, BrowserWindow, ipcMain, shell } from 'electron'

// Prevent uncaught EPIPE and other errors from crashing the app
process.on('uncaughtException', (error) => {
  if ((error as any).code === 'EPIPE') {
    console.warn('[Main] Suppressed EPIPE error')
    return
  }
  console.error('[Main] Uncaught exception:', error)
})

import Store from 'electron-store'
import { check_update } from './modules/check_update.js'
import { HttpServer, HttpServerConfig } from './modules/httpserver.js'
import { CloudflaredManager } from './modules/cloudflared.js'
import { initManagerClient, updateRendererStats, destroyManagerClient } from './modules/manager-client.js'

interface Schema {
  'win_bounds': object
}

const store = new Store<Schema>({
  schema: {
    'win_bounds': {
      type: 'object',
      default: {},
    },
  },
})

// import { nativeImage } from 'electron'
// const image = nativeImage.createFromPath(`${app.getAppPath()}/public/logo-256x256.png`)
// app.dock?.setIcon(image)

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1'))
  app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32')
  app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

// HTTP server for display client
let httpServer: HttpServer | null = null

// Cloudflare tunnel manager
let cloudflaredManager: CloudflaredManager | null = null

const window_config: any = {
  title: 'PneumaScribe',
  width: 1000,
  height: 700,
  icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
  frame: false,
  titleBarStyle: 'hidden',
  trafficLightPosition: { x: 10, y: 10 },
  webPreferences: {
    preload,
    // Security: the renderer shows externally-influenced text and is reachable via the
    // public Cloudflare tunnel, so it must NOT have Node access. contextIsolation is on
    // and all IPC goes through the contextBridge-exposed window.ipcRenderer in preload.
    nodeIntegration: false,
    contextIsolation: true,
  },
}

async function createWindow() {
  Object.assign(window_config, store.get('win_bounds'))
  win = new BrowserWindow(window_config)

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  }
  else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
  // win.webContents.on('will-navigate', (event, url) => { }) #344

  win.on('maximize', () => win.webContents.send('maximized_state', true))
  win.on('unmaximize', () => win.webContents.send('maximized_state', false))
  win.on('close', () => {
    const update_obj = {}
    Object.assign(update_obj, { isMaximized: win.isMaximized() }, win.getNormalBounds())
    store.set('win_bounds', update_obj)
  })
  win.webContents.once('dom-ready', () => {
    // the window is never maximized on load
    // if (window_config.isMaximized)
    //   win.webContents.send('maximized_state', true)
  })
}

// Lazy-load translation worker to prevent crashes on startup
const transformersWorkerPath = `file://${path.join(__dirname, 'worker', 'translation.js')}`
let transformersWorker: Worker | null = null

function getTransformersWorker(): Worker {
  if (!transformersWorker) {
    transformersWorker = new Worker(new URL(transformersWorkerPath, import.meta.url))

    transformersWorker.on('message', (x) => {
      console.log('[Main Worker] Received message from translation worker:', {
        status: x.status,
        index: x.index,
        tgt_lang: x.tgt_lang,
        hasOutput: !!x.output,
      })

      if (win && !win.isDestroyed()) {
        console.log('[Main Worker] Sending to renderer via transformers-translate-render and transformers-translate-render-multi')
        win.webContents.send('transformers-translate-render', x)
        // Also send to multi-language handler
        win.webContents.send('transformers-translate-render-multi', x)
      } else {
        console.warn('[Main Worker] Window is destroyed or null, cannot send message')
      }
    })

    // Add error handler for worker
    transformersWorker.on('error', (error) => {
      console.error('[Main Worker] Translation worker error:', error)
      if (win && !win.isDestroyed()) {
        win.webContents.send('main-process-message', `Translation worker error: ${error.message}`)
      }
    })

    // Add exit handler for worker
    transformersWorker.on('exit', (code) => {
      console.log(`[Main Worker] Translation worker exited with code ${code}`)
      transformersWorker = null
    })
  }

  return transformersWorker
}

// Terminate worker on app quit
function terminateTransformersWorker() {
  if (transformersWorker) {
    console.log('[Main] Terminating translation worker')
    transformersWorker.terminate()
    transformersWorker = null
  }
}

app.whenReady().then(() => {
  createWindow()

  // Launch PneumaScribe automatically at login so the captioning system is ready after a restart.
  try { app.setLoginItemSettings({ openAtLogin: true }) } catch (e) { /* non-fatal */ }

  // Connect to manager service if available
  initManagerClient({
    getHttpServer: () => httpServer,
    getCloudflared: () => cloudflaredManager,
    handleCommand: (cmd) => {
      switch (cmd.action) {
        case 'toggle_server':
          if (cmd.enabled && !httpServer) {
            win?.webContents.send('manager-command', { action: 'toggle_server', enabled: true })
          } else if (!cmd.enabled && httpServer) {
            httpServer.stop().then(() => { httpServer = null })
          }
          break
        case 'toggle_tunnel':
          win?.webContents.send('manager-command', { action: 'toggle_tunnel', enabled: cmd.enabled })
          break
        case 'toggle_mic':
          win?.webContents.send('manager-command', { action: 'toggle_mic' })
          break
        case 'shutdown':
          app.quit()
          break
      }
    }
  })
})

app.on('window-all-closed', () => {
  win = null
  terminateTransformersWorker()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  console.log('[Main] App quitting, cleaning up resources')
  terminateTransformersWorker()

  // Stop HTTP server if running
  if (httpServer) {
    httpServer.stop().catch(err => console.error('Error stopping HTTP server:', err))
  }

  // Stop Cloudflare tunnel if running
  if (cloudflaredManager) {
    cloudflaredManager.stop().catch(err => console.error('Error stopping Cloudflare tunnel:', err))
  }

  destroyManagerClient()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  }
  else {
    createWindow()
  }
})

// Load seed settings from install script (first launch only)
ipcMain.handle('load-seed-settings', async () => {
  try {
    const seedPath = path.join(app.getPath('userData'), 'seed-settings.json')
    if (fs.existsSync(seedPath)) {
      const data = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
      console.log('[Main] Loaded seed settings from', seedPath)
      // Delete seed file after reading (one-time use)
      fs.unlinkSync(seedPath)
      return data
    }
  } catch (error) {
    console.error('[Main] Failed to load seed settings:', error)
  }
  return null
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL)
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  else
    childWindow.loadFile(indexHtml, { hash: arg })
})

/*
 * event listeners that listens to the event emitted by Vue component
 */
// event for closing application
ipcMain.on('close_app', () => {
  app.quit()
})
// event for toggling maximized
ipcMain.on('toggle_maximize', () => {
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
// event for minimizing
ipcMain.on('minimize', () => {
  if (!win) return
  win.minimize()
})

ipcMain.on('update-check', async () => {
  try {
    const latest = await check_update()
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-check', latest)
    }
  } catch (error) {
    console.error('[Main] Update check failed:', error)
  }
})

// Translations
//
// Footer (user submission)
// → Speech Store
// → [Condition: translations are enabled]
// → Electron ('transformers-translate')
// → Worker (worker thread)
// → Electron ('transformers-translate-output')
// → Footer ('transformers-translate-render')

ipcMain.on('transformers-translate', async (event, args) => {
  getTransformersWorker().postMessage({ type: 'transformers-translate', data: args })
})

ipcMain.on('transformers-translate-multi', async (event, args) => {
  console.log('[Main IPC] Received transformers-translate-multi request:', {
    text: args.text?.substring(0, 50),
    src_lang: args.src_lang,
    tgt_lang: args.tgt_lang,
    index: args.index,
  })
  getTransformersWorker().postMessage({ type: 'transformers-translate-multi', data: args })
})

ipcMain.on('set-translation-api-key', async (event, apiKey) => {
  console.log('[Main IPC] Received set-translation-api-key, length:', apiKey?.length)
  getTransformersWorker().postMessage({ type: 'set-api-key', apiKey })
})


// HTTP Server handlers
ipcMain.handle('httpserver-start', async (event, config: { port: number }) => {
  try {
    if (httpServer && httpServer.getIsRunning()) {
      await httpServer.stop()
    }

    const serverConfig: HttpServerConfig = {
      port: config.port || 8080,
      publicPath: process.env.VITE_PUBLIC,
    }

    httpServer = new HttpServer(serverConfig)
    await httpServer.start()

    return { success: true, port: httpServer.getPort() }
  }
  catch (error: any) {
    console.error('Failed to start HTTP server:', error)
    return { success: false, error: error?.message || String(error) }
  }
})

ipcMain.handle('httpserver-stop', async () => {
  try {
    if (httpServer) {
      await httpServer.stop()
      httpServer = null
    }
    return { success: true }
  }
  catch (error: any) {
    console.error('Failed to stop HTTP server:', error)
    return { success: false, error: error?.message || String(error) }
  }
})

ipcMain.handle('httpserver-status', async () => {
  return {
    running: httpServer ? httpServer.getIsRunning() : false,
    port: httpServer ? httpServer.getPort() : null,
  }
})

// Broadcast transcription messages to HTTP display clients
ipcMain.on('stats-update', (_event, stats) => {
  updateRendererStats(stats)
})

ipcMain.on('httpserver-broadcast', (event, message: string) => {
  console.log('[Main IPC] Received httpserver-broadcast request, message length:', message?.length)

  if (httpServer && httpServer.getIsRunning()) {
    console.log('[Main IPC] Broadcasting to HTTP server clients')
    httpServer.broadcast(message)
  } else {
    console.warn('[Main IPC] HTTP server not running, cannot broadcast')
  }
})

// Get network interfaces
ipcMain.handle('get-network-interfaces', async () => {
  const networkInterfaces = os.networkInterfaces()
  const interfaces: Array<{ name: string, address: string, family: string, internal: boolean }> = []

  for (const [name, addresses] of Object.entries(networkInterfaces)) {
    if (!addresses) continue

    for (const addr of addresses) {
      // Filter out internal addresses (loopback)
      if (addr.internal) continue

      // Only include IPv4 and IPv6 addresses
      if (addr.family === 'IPv4' || addr.family === 'IPv6') {
        interfaces.push({
          name,
          address: addr.address,
          family: addr.family,
          internal: addr.internal,
        })
      }
    }
  }

  return interfaces
})

// Open external URL in default browser (only allow http/https)
ipcMain.on('open-external-url', (event, url: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      shell.openExternal(url)
    } else {
      console.warn('[Main] Blocked openExternal for non-http URL:', url)
    }
  } catch {
    console.warn('[Main] Blocked openExternal for invalid URL:', url)
  }
})

// Cloudflare Tunnel handlers
ipcMain.handle('cloudflare-tunnel-start', async (event, config: { httpPort: number, token?: string, customHostname?: string }) => {
  try {
    if (!cloudflaredManager) {
      cloudflaredManager = new CloudflaredManager()
    }
    console.log('[Main IPC] Starting tunnel with config:', {
      httpPort: config.httpPort,
      hasToken: !!config.token,
      customHostname: config.customHostname
    })
    const result = await cloudflaredManager.start(config)
    return result
  } catch (error: any) {
    console.error('Failed to start Cloudflare tunnel:', error)
    return { running: false, tunnelUrl: null, error: error?.message || String(error) }
  }
})

ipcMain.handle('cloudflare-tunnel-stop', async () => {
  try {
    if (cloudflaredManager) {
      await cloudflaredManager.stop()
    }
    return { success: true }
  } catch (error: any) {
    console.error('Failed to stop Cloudflare tunnel:', error)
    return { success: false, error: error?.message || String(error) }
  }
})

ipcMain.handle('cloudflare-tunnel-status', async () => {
  return cloudflaredManager?.getStatus() || { running: false, tunnelUrl: null, error: null }
})
