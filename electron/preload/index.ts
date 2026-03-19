import { contextBridge, ipcRenderer } from 'electron'

// --------- IPC Channel Allowlist ---------
const ALLOWED_CHANNELS = {
  send: [
    'close_app',
    'toggle_maximize',
    'minimize',
    'update-check',
    'transformers-translate',
    'transformers-translate-multi',
    'set-translation-api-key',
    'set-translation-provider',
    'httpserver-broadcast',
    'open-external-url',
    'typing-text-event',
    'stats-update',
  ],
  invoke: [
    'open-win',
    'httpserver-start',
    'httpserver-stop',
    'httpserver-status',
    'get-network-interfaces',
    'cloudflare-tunnel-start',
    'cloudflare-tunnel-stop',
    'cloudflare-tunnel-status',
  ],
  on: [
    'main-process-message',
    'maximized_state',
    'transformers-translate-render',
    'transformers-translate-render-multi',
    'update-check',
    'manager-command',
  ],
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    if (!ALLOWED_CHANNELS.on.includes(channel)) {
      console.warn(`[Preload] Blocked ipcRenderer.on for channel: ${channel}`)
      return ipcRenderer
    }
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    if (!ALLOWED_CHANNELS.send.includes(channel)) {
      console.warn(`[Preload] Blocked ipcRenderer.send for channel: ${channel}`)
      return
    }
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    if (!ALLOWED_CHANNELS.invoke.includes(channel)) {
      console.warn(`[Preload] Blocked ipcRenderer.invoke for channel: ${channel}`)
      return Promise.reject(new Error(`Channel not allowed: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...omit)
  },
  removeListener(channel: string, listener: (...args: any[]) => void) {
    return ipcRenderer.removeListener(channel, listener)
  },
})

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    }
    else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      return parent.removeChild(child)
    }
  },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: plum;
  border-radius: 30px;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000000;
  z-index: 9;
}
    `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 4999)
