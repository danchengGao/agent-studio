/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { EditorView } from '@codemirror/view'

export interface EditorOptions {
  // Display options
  lineNumbers?: boolean
  lineWrapping?: boolean
  foldGutter?: boolean
  highlightActiveLine?: boolean
  highlightActiveLineGutter?: boolean
  highlightSelectionMatches?: boolean

  // Editor behavior
  readOnly?: boolean
  editable?: boolean
  allowMultipleSelections?: boolean
  indentWithTabs?: boolean
  tabSize?: number
  lineBreak?: string

  // Visual options
  minHeight?: number
  maxHeight?: number
  placeholder?: string
  theme?: 'light' | 'dark'

  // Language options
  language?: string

  // Extension options
  bracketMatching?: boolean
  closeBrackets?: boolean
  autocompletion?: boolean
  search?: boolean

  // Gutter options
  gutters?: string[]

  // Scroll options
  scrollPastEnd?: boolean
  scrollMargin?: number

  // Custom options
  custom?: Record<string, any>
}

/**
 * Options Manager for managing CodeMirror editor options
 */
export class OptionsManager {
  private defaultOptions: EditorOptions
  private currentOptions: EditorOptions

  constructor() {
    this.defaultOptions = {
      lineNumbers: true,
      lineWrapping: false,
      foldGutter: true,
      highlightActiveLine: true,
      highlightActiveLineGutter: true,
      highlightSelectionMatches: true,
      readOnly: false,
      editable: true,
      allowMultipleSelections: true,
      indentWithTabs: false,
      tabSize: 2,
      lineBreak: '\n',
      minHeight: 200,
      maxHeight: undefined,
      placeholder: undefined,
      theme: 'light',
      bracketMatching: true,
      closeBrackets: true,
      autocompletion: true,
      search: true,
      gutters: undefined,
      scrollPastEnd: false,
      scrollMargin: 0,
      custom: {},
    }

    this.currentOptions = { ...this.defaultOptions }
  }

  /**
   * Get current options
   */
  getOptions(): EditorOptions {
    return { ...this.currentOptions }
  }

  /**
   * Get default options
   */
  getDefaultOptions(): EditorOptions {
    return { ...this.defaultOptions }
  }

  /**
   * Set options
   */
  setOptions(options: Partial<EditorOptions>): void {
    this.currentOptions = { ...this.currentOptions, ...options }
  }

  /**
   * Reset to default options
   */
  resetToDefaults(): void {
    this.currentOptions = { ...this.defaultOptions }
  }

  /**
   * Get a specific option value
   */
  getOption<K extends keyof EditorOptions>(key: K): EditorOptions[K] {
    return this.currentOptions[key]
  }

  /**
   * Set a specific option value
   */
  setOption<K extends keyof EditorOptions>(key: K, value: EditorOptions[K]): void {
    this.currentOptions[key] = value
  }

  /**
   * Apply options to an EditorView instance
   */
  applyOptions(view: EditorView, options: Partial<EditorOptions> = {}): void {
    const mergedOptions = { ...this.currentOptions, ...options }

    // Apply display options
    this.applyDisplayOptions(view, mergedOptions)

    // Apply behavior options
    this.applyBehaviorOptions(view, mergedOptions)

    // Apply visual options
    this.applyVisualOptions(view, mergedOptions)

    // Apply extension options
    this.applyExtensionOptions(view, mergedOptions)
  }

  private applyDisplayOptions(view: EditorView, options: EditorOptions): void {
    // Line numbers
    if (options.lineNumbers !== undefined) {
      const effect = EditorView.lineNumbers.toggle(options.lineNumbers)
      view.dispatch({ effects })
    }

    // Line wrapping
    if (options.lineWrapping !== undefined) {
      const effect = EditorView.lineWrapping.toggle(options.lineWrapping)
      view.dispatch({ effects })
    }

    // Active line highlighting
    if (options.highlightActiveLine !== undefined) {
      const effect = EditorView.lineHighlight.toggle(options.highlightActiveLine)
      view.dispatch({ effects })
    }
  }

  private applyBehaviorOptions(view: EditorView, options: EditorOptions): void {
    // Editable/Read-only
    const editable = options.editable !== false && !options.readOnly
    const effect = EditorView.editable.of(editable)
    view.dispatch({ effects })
  }

  private applyVisualOptions(view: EditorView, options: EditorOptions): void {
    // Update CSS classes for visual options
    const dom = view.dom
    if (dom) {
      // Theme class
      if (options.theme) {
        dom.classList.remove('light-theme', 'dark-theme')
        dom.classList.add(`${options.theme}-theme`)
      }

      // Line numbers class
      if (options.lineNumbers !== undefined) {
        dom.classList.toggle('no-line-numbers', !options.lineNumbers)
      }

      // Fold gutter class
      if (options.foldGutter !== undefined) {
        dom.classList.toggle('no-fold-gutter', !options.foldGutter)
      }

      // Height constraints
      if (options.minHeight !== undefined) {
        dom.style.minHeight = `${options.minHeight}px`
      }

      if (options.maxHeight !== undefined) {
        dom.style.maxHeight = `${options.maxHeight}px`
        dom.style.overflowY = 'auto'
      }
    }
  }

  private applyExtensionOptions(view: EditorView, options: EditorOptions): void {
    // This would involve reconfiguring extensions
    // In a real implementation, this would require more sophisticated handling
    // For now, we'll focus on basic options that can be changed dynamically
  }

  /**
   * Validate options
   */
  validateOptions(options: Partial<EditorOptions>): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (options.tabSize !== undefined && (typeof options.tabSize !== 'number' || options.tabSize < 1)) {
      errors.push('tabSize must be a positive number')
    }

    if (options.minHeight !== undefined && (typeof options.minHeight !== 'number' || options.minHeight < 0)) {
      errors.push('minHeight must be a non-negative number')
    }

    if (options.maxHeight !== undefined && (typeof options.maxHeight !== 'number' || options.maxHeight < 0)) {
      errors.push('maxHeight must be a non-negative number')
    }

    if (options.scrollMargin !== undefined && (typeof options.scrollMargin !== 'number' || options.scrollMargin < 0)) {
      errors.push('scrollMargin must be a non-negative number')
    }

    if (options.theme !== undefined && !['light', 'dark'].includes(options.theme)) {
      errors.push('theme must be either "light" or "dark"')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get option description
   */
  getOptionDescription(option: keyof EditorOptions): string {
    const descriptions: Record<keyof EditorOptions, string> = {
      lineNumbers: 'Show line numbers in the gutter',
      lineWrapping: 'Wrap long lines',
      foldGutter: 'Show fold gutter for code folding',
      highlightActiveLine: 'Highlight the current line',
      highlightActiveLineGutter: 'Highlight the active line in the gutter',
      highlightSelectionMatches: 'Highlight matching selections',
      readOnly: 'Make the editor read-only',
      editable: 'Enable editing',
      allowMultipleSelections: 'Allow multiple cursors and selections',
      indentWithTabs: 'Use tabs for indentation',
      tabSize: 'Number of spaces per tab',
      lineBreak: 'Line break character',
      minHeight: 'Minimum height in pixels',
      maxHeight: 'Maximum height in pixels',
      placeholder: 'Placeholder text when empty',
      theme: 'Color theme',
      language: 'Programming language',
      bracketMatching: 'Highlight matching brackets',
      closeBrackets: 'Auto-close brackets and quotes',
      autocompletion: 'Enable autocompletion',
      search: 'Enable search functionality',
      gutters: 'Custom gutters to display',
      scrollPastEnd: 'Allow scrolling past the end of the document',
      scrollMargin: 'Extra space around the viewport when scrolling',
      custom: 'Custom options',
    }

    return descriptions[option] || 'No description available'
  }

  /**
   * Export options to JSON
   */
  exportOptions(): string {
    return JSON.stringify(this.currentOptions, null, 2)
  }

  /**
   * Import options from JSON
   */
  importOptions(optionsJson: string): void {
    try {
      const options = JSON.parse(optionsJson) as Partial<EditorOptions>
      const validation = this.validateOptions(options)

      if (!validation.valid) {
        throw new Error(`Invalid options: ${validation.errors.join(', ')}`)
      }

      this.setOptions(options)
    } catch (error) {
      throw new Error(`Failed to import options: ${error}`)
    }
  }

  /**
   * Create a preset configuration
   */
  createPreset(presetName: string): Partial<EditorOptions> {
    const presets: Record<string, Partial<EditorOptions>> = {
      minimal: {
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightSelectionMatches: false,
        autocompletion: false,
        search: false,
      },
      presentation: {
        lineNumbers: false,
        readOnly: true,
        highlightActiveLine: false,
        highlightSelectionMatches: false,
        minHeight: 100,
      },
      codeReview: {
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        lineWrapping: true,
      },
      debugging: {
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        autocompletion: true,
        search: true,
      },
    }

    return presets[presetName] || {}
  }

  /**
   * Apply a preset configuration
   */
  applyPreset(presetName: string): void {
    const preset = this.createPreset(presetName)
    this.setOptions(preset)
  }

  /**
   * Get differences between current and default options
   */
  getDifferences(): Array<{ key: keyof EditorOptions; current: any; default: any }> {
    const differences: Array<{ key: keyof EditorOptions; current: any; default: any }> = []

    for (const key in this.currentOptions) {
      const optionKey = key as keyof EditorOptions
      if (this.currentOptions[optionKey] !== this.defaultOptions[optionKey]) {
        differences.push({
          key: optionKey,
          current: this.currentOptions[optionKey],
          default: this.defaultOptions[optionKey],
        })
      }
    }

    return differences
  }

  /**
   * Clone options manager
   */
  clone(): OptionsManager {
    const cloned = new OptionsManager()
    cloned.setOptions(this.getOptions())
    return cloned
  }
}