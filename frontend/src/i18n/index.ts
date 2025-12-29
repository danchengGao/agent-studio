import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import zhCN from '../locales/zh-CN.json'
import enUS from '../locales/en-US.json'

// Agent translations
import agentCommonZh from '../locales/agent/zh-CN/common.json'
import agentEditorZh from '../locales/agent/zh-CN/editor.json'

import agentCommonEn from '../locales/agent/en-US/common.json'
import agentEditorEn from '../locales/agent/en-US/editor.json'

const resources = {
  'zh-CN': {
    translation: {
      ...zhCN,
      agents: {
        ...agentCommonZh,
        ...agentEditorZh,
      },
    },
  },
  'en-US': {
    translation: {
      ...enUS,
      agents: {
        ...agentCommonEn,
        ...agentEditorEn,
      },
    },
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
