import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import zhCN from '../locales/zh-CN.json'
import enUS from '../locales/en-US.json'

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
// TODO：初始化时如果没有存储语言，默认设置为中文，国际化整改后删除
if (typeof window !== 'undefined') {
  const storage = window.localStorage
  storage.setItem('i18nextLng', 'zh-CN')
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

if (typeof window !== 'undefined') {
  // @ts-ignore - i18next global access
  window.i18next = i18n
  // TODO：初始化时如果没有存储语言，默认设置为中文，国际化整改后删除
  i18n.changeLanguage('zh-CN')
}

export const useScopedTranslation = (keyPrefix: string, ns = 'translation') => {
  const { t, i18n: i18nInstance, ready } = useTranslation(ns, { keyPrefix })
  return { t, i18n: i18nInstance, ready }
}

export default i18n
