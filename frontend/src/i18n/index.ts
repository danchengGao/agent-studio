import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import zhCN from '../locales/zh-CN.json'
import enUS from '../locales/en-US.json'

const resources = {
  'zh-CN': {
    translation: zhCN,
  },
  'en-US': {
    translation: enUS,
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh-CN',
    debug: false,

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  })

// Attach i18next to window for workflow-canvas to access
// @ts-ignore - i18next global access
if (typeof window !== 'undefined') {
  // @ts-ignore - i18next global access
  window.i18next = i18n
}

export default i18n
