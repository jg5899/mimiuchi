import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'

import Header from '@/components/Header.vue'
import Footer from '@/components/Footer.vue'

import Home from '@/pages/Home.vue'
import Settings from '@/pages/Settings.vue'
import SettingsGeneral from '@/pages/settings/General.vue'
import STT from '@/pages/settings/STT.vue'
import TTS from '@/pages/settings/TTS.vue'
import Appearance from '@/pages/settings/Appearance.vue'
import WordReplace from '@/pages/settings/WordReplace.vue'
import Translation from '@/pages/settings/Translation.vue'
import SpeakerProfiles from '@/pages/settings/SpeakerProfiles.vue'
import MultiLanguage from '@/pages/settings/MultiLanguage.vue'
import Tools from '@/pages/settings/Tools.vue'
import Connections from '@/components/settings/connections/Connections.vue'
import OSC from '@/pages/settings/OSC.vue'
import OSCTriggers from '@/components/settings/osctriggers/OSCTriggers.vue'
import LanguageStream from '@/pages/LanguageStream.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    components: {
      default: Home,
      // Header,
      Footer,
    },
  },
  {
    path: '/:lang(spanish|ukrainian|russian|portuguese|french|korean|mandarin|tagalog|vietnamese|arabic|hindi|polish)',
    name: 'language-stream',
    component: LanguageStream,
  },
  {
    path: '/settings/',
    name: 'settings',
    components: {
      Header,
      default: Settings,
      Footer,
    },
    children: [
      {
        path: 'general',
        name: 'general',
        component: SettingsGeneral,
      },
      {
        path: 'appearance',
        name: 'appearance',
        component: Appearance,
      },
      {
        path: 'stt',
        name: 'stt',
        component: STT,
      },
      {
        path: 'tts',
        name: 'tts',
        component: TTS,
      },
      {
        path: 'speaker-profiles',
        name: 'speaker-profiles',
        component: SpeakerProfiles,
      },
      {
        path: 'wordreplace',
        name: 'wordreplace',
        component: WordReplace,
      },
      {
        path: 'translation',
        name: 'translation',
        component: Translation,
      },
      {
        path: 'multi-language',
        name: 'multi-language',
        component: MultiLanguage,
      },
      {
        path: 'tools',
        name: 'tools',
        component: Tools,
      },
      {
        path: 'connections',
        name: 'connections',
        component: Connections,
      },
      {
        path: 'osc',
        name: 'osc',
        component: OSC,
      },
      {
        path: 'osctriggers',
        name: 'osctriggers',
        component: OSCTriggers,
      },
    ],
  },
]

export default createRouter({
  history: createWebHashHistory(),
  routes: routes as RouteRecordRaw[],
})
