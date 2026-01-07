/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

/**
 * Workflow-canvas internationalization
 *
 * Uses the main app's i18next instance instead of flowgram's built-in I18n.
 * This ensures language changes are automatically reflected.
 */

import { useEffect, useState } from 'react'

const DEBUG = true // 调试开关

/**
 * Get the main app's i18next instance from global scope
 */
function getMainAppI18n() {
  // Access the i18next instance that the main app initializes
  // @ts-ignore - i18next is attached to window by the main app
  return (window as any).i18next
}

/**
 * Translate function that uses main app's i18next
 * Compatible with flowgram's I18n.t() signature
 *
 * @param key - Translation key
 * @param params - Optional parameters for interpolation
 * @returns Translated string
 *
 * @example
 * ```tsx
 * // Simple usage
 * const title = t('workflowCanvas.ui.settings')
 *
 * // With parameters
 * const message = t('workflowCanvas.ui.switchedToVersion', { version: '1.0' })
 * ```
 */
export function t(key: string, params?: Record<string, unknown>): string {
  const i18n = getMainAppI18n()
  if (!i18n) {
    if (DEBUG) console.warn('[workflow-i18n] Main app i18next not found, returning key:', key)
    return key
  }

  const result = i18n.t(key, params)

  if (DEBUG && result === key) {
    console.warn(`[workflow-i18n] Missing translation: ${key}`)
  }

  return result
}

/**
 * Hook for using translations in components with auto-reload on language change
 * Wraps react-i18next's useTranslation
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { t } = useTranslation()
 *   return <div>{t('workflowCanvas.ui.settings')}</div>
 * }
 * ```
 */
export function useTranslation() {
  const [, forceUpdate] = useState({})

  useEffect(() => {
    const i18n = getMainAppI18n()
    if (!i18n) return

    const handleLanguageChange = () => {
      forceUpdate({})
    }

    i18n.on('languageChanged', handleLanguageChange)

    return () => {
      i18n.off('languageChanged', handleLanguageChange)
    }
  }, [])

  // Re-export t function for components
  return { t }
}
