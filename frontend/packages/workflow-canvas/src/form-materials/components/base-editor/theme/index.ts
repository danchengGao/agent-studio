/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'
import { ThemeManager } from '../utils/theme-manager'

import { lightTheme } from './light'
import { darkTheme } from './dark'

/**
 * Theme registry for CodeMirror 6 themes
 */
export class ThemeRegistry {
  private themes: Map<string, Extension>
  private themeManager: ThemeManager

  constructor() {
    this.themes = new Map()
    this.themeManager = new ThemeManager()
    this.initializeThemes()
  }

  private initializeThemes(): void {
    // Register built-in themes
    this.register('dark', darkTheme)
    this.register('light', lightTheme)
  }

  /**
   * Register a theme
   */
  register(name: string, theme: Extension): void {
    this.themes.set(name, theme)
  }

  /**
   * Get a theme by name
   */
  get(name: string): Extension | undefined {
    return this.themes.get(name)
  }

  /**
   * Get all registered theme names
   */
  getThemeNames(): string[] {
    return Array.from(this.themes.keys())
  }

  /**
   * Check if a theme is registered
   */
  has(name: string): boolean {
    return this.themes.has(name)
  }

  /**
   * Get theme manager instance
   */
  getThemeManager(): ThemeManager {
    return this.themeManager
  }

  /**
   * Get theme extensions with CSS variable support
   */
  getThemeWithExtensions(theme: 'light' | 'dark'): Extension[] {
    const baseTheme = this.get(theme)
    const managerExtensions = this.themeManager.getThemeExtension(theme)

    if (!baseTheme) {
      throw new Error(`Theme "${theme}" is not registered`)
    }

    return [baseTheme, ...managerExtensions]
  }
}

// Create and export default registry instance
export const themeRegistry = new ThemeRegistry()

// Export built-in themes
export { lightTheme, darkTheme }

// Export theme manager
export { ThemeManager }

// Export types
export type { ThemeMode, ThemeColors, ThemeConfig } from '../utils/theme-manager'

/**
 * Legacy compatibility exports
 * Maintains API compatibility with existing code that imports from this module
 */
export const themes = {
  register: (name: string, theme: Extension) => themeRegistry.register(name, theme),
  get: (name: string) => themeRegistry.get(name),
  has: (name: string) => themeRegistry.has(name),
  getThemeNames: () => themeRegistry.getThemeNames(),
}
