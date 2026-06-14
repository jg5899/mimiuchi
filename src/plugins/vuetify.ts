// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Vuetify
import { createVuetify } from 'vuetify'

// themes
import { midnight_purple } from '@/plugins/themes/midnight_purple'
import { cotton_candy } from '@/plugins/themes/cotton_candy'
import { red_light } from '@/plugins/themes/red_light'
import { red_dark } from '@/plugins/themes/red_dark'
import { gold_light } from '@/plugins/themes/gold_light'
import { gold_dark } from '@/plugins/themes/gold_dark'
import { forest_light } from '@/plugins/themes/forest_light'
import { forest_dark } from '@/plugins/themes/forest_dark'
import { pneumascribe_dark } from '@/plugins/themes/pneumascribe_dark'
import { pneumascribe_light } from '@/plugins/themes/pneumascribe_light'

// additional components
import { VIconBtn } from 'vuetify/labs/VIconBtn'

export default createVuetify({
  theme: {
    defaultTheme: 'pneumascribe_dark',
    themes: {
      pneumascribe_dark,
      pneumascribe_light,
      cotton_candy,
      midnight_purple,
      red_light,
      red_dark,
      gold_light,
      gold_dark,
      forest_light,
      forest_dark,
    },
  },
  components: {
    VIconBtn,
  },
  icons: {
    defaultSet: "mdi",
  },
})
