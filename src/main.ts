// import './demos/ipc'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from '@/App.vue'

import vuetify from '@/plugins/vuetify'
import router from '@/plugins/router'
import i18n from '@/plugins/i18n'
import storeReset from '@/plugins/storereset'

// import { loadFonts } from './plugins/webfontloader'
// loadFonts()

import '@/assets/fonts/fonts.css'

const pinia = createPinia()
pinia.use(storeReset)

// If you want use Node.js, the`nodeIntegration` needs to be enabled in the Main process.
// import './demos/node'

const app_name = 'mimiuchi'

const app = createApp(App)

// Add global error handler for better error recovery
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue Error Handler]', {
    error: err,
    component: instance?.$options?.name || 'Unknown',
    info,
    stack: err instanceof Error ? err.stack : null,
  })

  // Try to show user-friendly error message
  try {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`Vue Error: ${errorMessage} (${info})`)

    // Optionally show snackbar if available (don't crash if it's not)
    if (instance && typeof instance === 'object' && 'proxy' in instance) {
      const defaultStore = (instance.proxy as any)?.$root?.$defaultStore
      if (defaultStore && typeof defaultStore.show_snackbar === 'function') {
        defaultStore.show_snackbar('error', `Error: ${errorMessage}`)
      }
    }
  } catch (handlerError) {
    console.error('[Error Handler] Failed to handle error:', handlerError)
  }
}

// Add global warning handler
app.config.warnHandler = (msg, instance, trace) => {
  console.warn('[Vue Warning]', {
    message: msg,
    component: instance?.$options?.name || 'Unknown',
    trace,
  })
}

app
  .use(vuetify)
  .use(pinia)
  .use(router)
  .use(i18n)
  .provide('app_name', app_name)
  .mount('#app')
