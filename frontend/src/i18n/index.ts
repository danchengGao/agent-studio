import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
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

// TODO：初始化时如果没有存储语言，默认设置为中文，国际化整改后删除
i18n.on('initialized', () => {
  if (typeof window === 'undefined') {
    return
  }
  const storage = window.localStorage
  const storedLanguage = storage.getItem('i18nextLng')
  if (storedLanguage !== 'zh-CN') {
    storage.setItem('i18nextLng', 'zh-CN')
    i18n.changeLanguage('zh-CN')
  }
})

// Attach i18next to window for workflow-canvas to access
// @ts-ignore - i18next global access
if (typeof window !== 'undefined') {
  // @ts-ignore - i18next global access
  window.i18next = i18n
}

export const useScopedTranslation = (keyPrefix: string, ns = 'translation') => {
  const { t, i18n: i18nInstance, ready } = useTranslation(ns, { keyPrefix })
  return { t, i18n: i18nInstance, ready }
}

export default i18n
