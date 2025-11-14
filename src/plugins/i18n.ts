import { createI18n } from 'vue-i18n'

import en from '@/plugins/localization/en'
import es from '@/plugins/localization/es'
import ja from '@/plugins/localization/ja'
import zh from '@/plugins/localization/zh'
import ro from '@/plugins/localization/ro'
import uk from '@/plugins/localization/uk'
import ru from '@/plugins/localization/ru'
import fr from '@/plugins/localization/fr'
import de from '@/plugins/localization/de'
import pt from '@/plugins/localization/pt'
import it from '@/plugins/localization/it'

interface Language {
  title: string
  value: string
}

const messages = {
  en,
  es,
  ja,
  zh,
  ro,
  uk,
  ru,
  fr,
  de,
  pt,
  it,
}

export const global_langs = [
  {
    title: 'English (United States)',
    value: 'en',
  },
  {
    title: 'Spanish (España)',
    value: 'es',
  },
  {
    title: '日本語（日本）',
    value: 'ja',
  },
  {
    title: '中文（中国）',
    value: 'zh',
  },
  {
    title: 'Română (România)',
    value: 'ro',
  },
  {
    title: 'Українська (Україна)',
    value: 'uk',
  },
  {
    title: 'Русский (Россия)',
    value: 'ru',
  },
  {
    title: 'Français (France)',
    value: 'fr',
  },
  {
    title: 'Deutsch (Deutschland)',
    value: 'de',
  },
  {
    title: 'Português (Brasil)',
    value: 'pt',
  },
  {
    title: 'Italiano (Italia)',
    value: 'it',
  },
] as Language[]

const instance = createI18n({
  legacy: false,
  missingWarn: false,
  fallbackWarn: false,
  fallbackLocale: 'en',
  messages,
})

export default instance

export const i18n = instance.global
