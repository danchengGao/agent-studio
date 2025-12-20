/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export type ThemeMode = 'light' | 'dark'

export interface ThemeColors {
  background: string
  foreground: string
  selection: string
  cursor: string
  activeLine: string
  gutterBackground: string
  gutterForeground: string
  keyword: string
  string: string
  comment: string
  number: string
  function: string
  variable: string
  type: string
  operator: string
  invalid: string
}

export interface ThemeConfig {
  name: string
  mode: ThemeMode
  colors: ThemeColors
}

/**
 * Theme Manager for managing CodeMirror themes
 */
export class ThemeManager {
  private currentTheme: ThemeMode
  private customThemes: Map<string, Extension>
  private colorMappings: Map<ThemeMode, ThemeColors>

  constructor() {
    this.currentTheme = 'light'
    this.customThemes = new Map()
    this.colorMappings = new Map()
    this.initializeColorMappings()
  }

  private initializeColorMappings(): void {
    // Light theme colors - matches light.ts exactly
    const lightColors: ThemeColors = {
      background: '#f4f5f5',
      foreground: '#444d56',
      selection: '#0366d625',
      cursor: '#044289',
      activeLine: '#c6c6c622',
      gutterBackground: '#f4f5f5',
      gutterForeground: '#444d56',
      keyword: '#d73a49',
      string: '#032f62',
      comment: '#6a737d',
      number: '#005cc5',
      function: '#005cc5',
      variable: '#e36209',
      type: '#005cc5',
      operator: '#d73a49',
      invalid: '#cb2431',
    }

    // Dark theme colors - matches dark.ts exactly
    const darkColors: ThemeColors = {
      background: '#24292e',
      foreground: '#d1d5da',
      selection: '#3392FF44',
      cursor: '#c8e1ff',
      activeLine: '#4d566022',
      gutterBackground: '#24292e',
      gutterForeground: '#888892',
      keyword: '#9197F1',
      string: '#FF9878',
      comment: '#568B2A',
      number: '#2EC7D9',
      function: '#FFCA66',
      variable: '#ffab70',
      type: '#79b8ff',
      operator: '#9197F1',
      invalid: '#f97583',
    }

    this.colorMappings.set('light', lightColors)
    this.colorMappings.set('dark', darkColors)
  }

  /**
   * Get theme extension for a given theme mode
   */
  getThemeExtension(theme: ThemeMode): Extension[] {
    // Return theme extension with CSS variable mapping support
    return [this.createCustomThemeExtension(theme), this.createCSSVariableMapping(theme)]
  }

  /**
   * Create custom theme extension based on color mappings
   */
  private createCustomThemeExtension(theme: ThemeMode): Extension {
    const colors = this.colorMappings.get(theme)
    if (!colors) {
      throw new Error(`No color mapping found for theme: ${theme}`)
    }

    return EditorView.theme({
      '&': {
        backgroundColor: colors.background,
        color: colors.foreground,
      },
      '.cm-content': {
        caretColor: colors.cursor,
      },
      '.cm-cursor': {
        borderLeftColor: colors.cursor,
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: colors.selection,
      },
      '.cm-activeLine': {
        backgroundColor: colors.activeLine,
      },
      '.cm-gutters': {
        backgroundColor: colors.gutterBackground,
        color: colors.gutterForeground,
        border: 'none',
      },
      '.cm-lineNumbers': {
        color: colors.gutterForeground,
      },
      // Syntax highlighting
      '.cm-keyword': {
        color: colors.keyword,
        fontWeight: '500',
      },
      '.cm-string': {
        color: colors.string,
      },
      '.cm-comment': {
        color: colors.comment,
        fontStyle: 'italic',
      },
      '.cm-number': {
        color: colors.number,
      },
      '.cm-atom': {
        color: colors.number,
      },
      '.cm-property': {
        color: colors.function,
      },
      '.cm-variable': {
        color: colors.variable,
      },
      '.cm-variableName': {
        color: colors.variable,
      },
      '.cm-def': {
        color: colors.function,
      },
      '.cm-type': {
        color: colors.type,
      },
      '.cm-tag': {
        color: colors.keyword,
      },
      '.cm-attribute': {
        color: colors.variable,
      },
      '.cm-operator': {
        color: colors.operator,
      },
      '.cm-invalid': {
        color: colors.invalid,
        borderBottom: `1px dotted ${colors.invalid}`,
      },
      // UI elements
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-scroller': {
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: '14px',
        lineHeight: '1.5',
      },
      '.cm-line': {
        padding: '0 0 0 4px',
      },
      '.cm-placeholder': {
        color: colors.comment,
        fontStyle: 'italic',
        pointerEvents: 'none',
      },
      // Scrollbar styling
      '.cm-scroller::-webkit-scrollbar': {
        width: '8px',
        height: '8px',
      },
      '.cm-scroller::-webkit-scrollbar-track': {
        backgroundColor: colors.background,
      },
      '.cm-scroller::-webkit-scrollbar-thumb': {
        backgroundColor: theme === 'dark' ? '#586069' : '#d1d5da',
        borderRadius: '4px',
      },
      '.cm-scroller::-webkit-scrollbar-thumb:hover': {
        backgroundColor: theme === 'dark' ? '#6e7681' : '#9ca3af',
      },
    })
  }

  /**
   * Set current theme
   */
  setTheme(theme: ThemeMode): void {
    this.currentTheme = theme
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): ThemeMode {
    return this.currentTheme
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): ThemeMode {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light'
    return this.currentTheme
  }

  /**
   * Get colors for a theme
   */
  getThemeColors(theme: ThemeMode): ThemeColors | null {
    return this.colorMappings.get(theme) || null
  }

  /**
   * Register a custom theme
   */
  registerCustomTheme(name: string, extension: Extension): void {
    this.customThemes.set(name, extension)
  }

  /**
   * Get custom theme extension
   */
  getCustomTheme(name: string): Extension | null {
    return this.customThemes.get(name) || null
  }

  /**
   * Update theme colors
   */
  updateThemeColors(theme: ThemeMode, colors: Partial<ThemeColors>): void {
    const existingColors = this.colorMappings.get(theme)
    if (existingColors) {
      const updatedColors = { ...existingColors, ...colors }
      this.colorMappings.set(theme, updatedColors)
    }
  }

  /**
   * Get color value for a specific color key in a theme
   */
  getColor(theme: ThemeMode, colorKey: keyof ThemeColors): string | null {
    const colors = this.colorMappings.get(theme)
    return colors ? colors[colorKey] : null
  }

  /**
   * Create a gradient transition between two themes
   */
  createThemeTransition(fromTheme: ThemeMode, toTheme: ThemeMode, steps: number = 10): ThemeColors[] {
    const fromColors = this.colorMappings.get(fromTheme)
    const toColors = this.colorMappings.get(toTheme)

    if (!fromColors || !toColors) {
      throw new Error('Both theme colors must be available for transition')
    }

    const transitions: ThemeColors[] = []

    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps
      const stepColors: Partial<ThemeColors> = {}

      for (const key in fromColors) {
        const colorKey = key as keyof ThemeColors
        stepColors[colorKey] = this.interpolateColor(fromColors[colorKey], toColors[colorKey], ratio)
      }

      transitions.push(stepColors as ThemeColors)
    }

    return transitions
  }

  /**
   * Interpolate between two hex colors
   */
  private interpolateColor(color1: string, color2: string, ratio: number): string {
    const hex2rgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 0, g: 0, b: 0 }
    }

    const rgb2hex = (r: number, g: number, b: number) => {
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
    }

    const c1 = hex2rgb(color1)
    const c2 = hex2rgb(color2)

    const r = Math.round(c1.r + (c2.r - c1.r) * ratio)
    const g = Math.round(c1.g + (c2.g - c1.g) * ratio)
    const b = Math.round(c1.b + (c2.b - c1.b) * ratio)

    return rgb2hex(r, g, b)
  }

  /**
   * Export theme configuration to JSON
   */
  exportThemeConfig(theme: ThemeMode): string {
    const colors = this.colorMappings.get(theme)
    if (!colors) {
      throw new Error(`No theme configuration found for: ${theme}`)
    }

    return JSON.stringify(
      {
        mode: theme,
        colors,
      },
      null,
      2,
    )
  }

  /**
   * Import theme configuration from JSON
   */
  importThemeConfig(configJson: string): void {
    try {
      const config = JSON.parse(configJson) as ThemeConfig
      if (config.colors) {
        this.colorMappings.set(config.mode, config.colors)
      }
    } catch (error) {
      throw new Error(`Invalid theme configuration JSON: ${error}`)
    }
  }

  /**
   * Create CSS variable mapping for dynamic theme switching
   */
  private createCSSVariableMapping(theme: ThemeMode): Extension {
    const colors = this.colorMappings.get(theme)
    if (!colors) {
      throw new Error(`No color mapping found for theme: ${theme}`)
    }

    return EditorView.theme(
      {
        // CSS Variable Definitions - 16 variables from original system
        '&': {
          // Editor Variables (1-8)
          '--editor-background': colors.background,
          '--editor-foreground': colors.foreground,
          '--editor-selection': colors.selection,
          '--editor-cursor': colors.cursor,
          '--editor-active-line': colors.activeLine,
          '--editor-gutter-background': colors.gutterBackground,
          '--editor-gutter-foreground': colors.gutterForeground,
          '--editor-line-height': '1.5',

          // Syntax Variables (9-16)
          '--syntax-keyword': colors.keyword,
          '--syntax-string': colors.string,
          '--syntax-comment': colors.comment,
          '--syntax-number': colors.number,
          '--syntax-function': colors.function,
          '--syntax-variable': colors.variable,
          '--syntax-type': colors.type,
          '--syntax-invalid': colors.invalid,

          // Additional editor styling variables
          '--editor-font-family': 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
          '--editor-font-size': '14px',
          '--editor-scrollbar-width': '8px',
          '--editor-scrollbar-height': '8px',
        },

        // Apply CSS variables to editor elements for dynamic updates
        '.cm-content': {
          backgroundColor: 'var(--editor-background)',
          color: 'var(--editor-foreground)',
          caretColor: 'var(--editor-cursor)',
          fontFamily: 'var(--editor-font-family)',
          fontSize: 'var(--editor-font-size)',
          lineHeight: 'var(--editor-line-height)',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--editor-cursor)',
        },
        '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
          backgroundColor: 'var(--editor-selection)',
        },
        '.cm-activeLine': {
          backgroundColor: 'var(--editor-active-line)',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--editor-gutter-background)',
          color: 'var(--editor-gutter-foreground)',
        },
        '.cm-lineNumbers': {
          color: 'var(--editor-gutter-foreground)',
        },

        // Apply syntax variables
        '.cm-keyword': {
          color: 'var(--syntax-keyword)',
        },
        '.cm-string': {
          color: 'var(--syntax-string)',
        },
        '.cm-comment': {
          color: 'var(--syntax-comment)',
        },
        '.cm-number': {
          color: 'var(--syntax-number)',
        },
        '.cm-def': {
          color: 'var(--syntax-function)',
        },
        '.cm-variable': {
          color: 'var(--syntax-variable)',
        },
        '.cm-type': {
          color: 'var(--syntax-type)',
        },
        '.cm-error': {
          color: 'var(--syntax-invalid)',
        },

        // Scrollbar with CSS variables
        '.cm-scroller::-webkit-scrollbar': {
          width: 'var(--editor-scrollbar-width)',
          height: 'var(--editor-scrollbar-height)',
        },
      },
      { dark: theme === 'dark' },
    )
  }

  /**
   * Update CSS variables dynamically for runtime theme switching
   */
  updateCSSVariables(theme: ThemeMode): void {
    const colors = this.colorMappings.get(theme)
    if (!colors) {
      throw new Error(`No color mapping found for theme: ${theme}`)
    }

    const root = document.documentElement

    // Update all 16 CSS variables
    root.style.setProperty('--editor-background', colors.background)
    root.style.setProperty('--editor-foreground', colors.foreground)
    root.style.setProperty('--editor-selection', colors.selection)
    root.style.setProperty('--editor-cursor', colors.cursor)
    root.style.setProperty('--editor-active-line', colors.activeLine)
    root.style.setProperty('--editor-gutter-background', colors.gutterBackground)
    root.style.setProperty('--editor-gutter-foreground', colors.gutterForeground)
    root.style.setProperty('--syntax-keyword', colors.keyword)
    root.style.setProperty('--syntax-string', colors.string)
    root.style.setProperty('--syntax-comment', colors.comment)
    root.style.setProperty('--syntax-number', colors.number)
    root.style.setProperty('--syntax-function', colors.function)
    root.style.setProperty('--syntax-variable', colors.variable)
    root.style.setProperty('--syntax-type', colors.type)
    root.style.setProperty('--syntax-invalid', colors.invalid)
  }

  /**
   * Get all CSS variable names used by the theme system
   */
  getCSSVariableNames(): string[] {
    return [
      '--editor-background',
      '--editor-foreground',
      '--editor-selection',
      '--editor-cursor',
      '--editor-active-line',
      '--editor-gutter-background',
      '--editor-gutter-foreground',
      '--editor-line-height',
      '--syntax-keyword',
      '--syntax-string',
      '--syntax-comment',
      '--syntax-number',
      '--syntax-function',
      '--syntax-variable',
      '--syntax-type',
      '--syntax-invalid',
    ]
  }

  /**
   * Check if CSS variables are supported
   */
  static isCSSVariableSupported(): boolean {
    return typeof window !== 'undefined' && window.CSS && CSS.supports && CSS.supports('color', 'var(--test)')
  }

  /**
   * Create theme persistence using localStorage
   */
  saveThemePreference(theme: ThemeMode): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('code-editor-theme', theme)
    }
  }

  /**
   * Load theme preference from localStorage
   */
  loadThemePreference(): ThemeMode | null {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('code-editor-theme')
      return saved === 'light' || saved === 'dark' ? saved : null
    }
    return null
  }

  /**
   * Initialize theme with persistence and CSS variables
   */
  initializeTheme(preferredTheme?: ThemeMode): ThemeMode {
    // Try to load saved preference or use provided preference
    let theme = preferredTheme || this.loadThemePreference() || this.currentTheme

    // Set the current theme
    this.setTheme(theme)

    // Update CSS variables for dynamic switching
    this.updateCSSVariables(theme)

    // Save preference
    this.saveThemePreference(theme)

    return theme
  }
}
