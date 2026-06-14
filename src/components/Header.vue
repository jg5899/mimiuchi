<template>
  <v-app-bar color="surface" app flat height="50">
    <v-app-bar-nav-icon
      variant="text"
      @click.stop="settingsStore.drawer = !settingsStore.drawer"
    />
    <v-container class="mb-7 fill-height d-flex align-center">
      <div class="logo-plaque me-5 ms-4 d-none d-sm-flex">
        <img src="/trinity-logo.png" alt="Trinity Community Church" />
      </div>
      <v-app-bar-title class="font-weight-medium">
        {{ APP_NAME }}
      </v-app-bar-title>
      <v-btn
        icon :color="route.name === 'home' ? 'secondary' : 'white'"
        @click="router.push({ path: '/' })"
      >
        <v-icon>mdi-home</v-icon>
      </v-btn>
      <v-btn
        icon
        :color="route.fullPath.startsWith('/settings') ? 'secondary' : 'white'"
        @click="router.push({ path: '/settings/general' })"
      >
        <v-icon>mdi-cog</v-icon>
      </v-btn>
      <v-btn
        icon
        color="white"
        @click="open_external('https://github.com/naeruru/mimiuchi')"
      >
        <v-icon>mdi-help-circle-outline</v-icon>
      </v-btn>
    </v-container>
  </v-app-bar>
</template>

<script setup lang='ts'>
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const route = useRoute()
const settingsStore = useSettingsStore()

const APP_NAME = __APP_NAME__

function open_external(link: string) {
  window.open(link, '_blank')
}
</script>

<style scoped>
.logo-plaque {
  background: #fff;
  border-radius: 8px;
  padding: 3px 6px;
  align-items: center;
}
.logo-plaque img { height: 26px; display: block; }
</style>
