import { createRequire } from 'node:module'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { app, BrowserWindow, ipcMain, shell } from 'electron'

import Store from 'electron-store'
import { check_update } from './modules/check_update.js'
import { HttpServer, HttpServerConfig } from './modules/httpserver.js'

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

const window_config: any = {
  title: 'Main window',
  width: 1000,
  height: 700,
  icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
  frame: false,
  titleBarStyle: 'hidden',
  trafficLightPosition: { x: 10, y: 10 },
  webPreferences: {
    preload,
    // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
    // nodeIntegration: true,

    // Consider using contextBridge.exposeInMainWorld
    // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
    // contextIsolation: false,
    nodeIntegration: true,
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
      if (win && !win.isDestroyed()) {
        win.webContents.send('transformers-translate-render', x)
        // Also send to multi-language handler
        win.webContents.send('transformers-translate-render-multi', x)
      }
    })
  }

  return transformersWorker
}

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
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

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
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
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
// event for minimizing
ipcMain.on('minimize', () => {
  win.minimize()
})

ipcMain.on('update-check', async () => {
  const latest = await check_update()
  win.webContents.send('update-check', latest)
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
  getTransformersWorker().postMessage({ type: 'transformers-translate-multi', data: args })
})

ipcMain.on('set-translation-api-key', async (event, apiKey) => {
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
  catch (error) {
    console.error('Failed to start HTTP server:', error)
    return { success: false, error: error.message }
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
  catch (error) {
    console.error('Failed to stop HTTP server:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('httpserver-status', async () => {
  return {
    running: httpServer ? httpServer.getIsRunning() : false,
    port: httpServer ? httpServer.getPort() : null,
  }
})

// Broadcast transcription messages to HTTP display clients
ipcMain.on('httpserver-broadcast', (event, message: string) => {
  if (httpServer && httpServer.getIsRunning()) {
    httpServer.broadcast(message)
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
