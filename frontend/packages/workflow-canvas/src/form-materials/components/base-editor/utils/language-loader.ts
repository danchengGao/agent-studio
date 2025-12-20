/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { sql } from '@codemirror/lang-sql'
import { Extension } from '@codemirror/state'

export type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'json' | 'sql' | 'shell'

export interface LanguageConfig {
  name: string
  extensions: string[]
  mimeTypes: string[]
  loadExtension: () => Extension | Extension[]
}

/**
 * Language Loader for dynamically loading CodeMirror language support
 */
export class LanguageLoader {
  private languageConfigs: Map<SupportedLanguage, LanguageConfig>
  private loadedExtensions: Map<SupportedLanguage, Extension | Extension[]>

  constructor() {
    this.languageConfigs = new Map()
    this.loadedExtensions = new Map()
    this.initializeConfigs()
  }

  private initializeConfigs(): void {
    const configs: Record<SupportedLanguage, LanguageConfig> = {
      javascript: {
        name: 'JavaScript',
        extensions: ['.js', '.jsx', '.mjs'],
        mimeTypes: ['application/javascript', 'application/x-javascript', 'text/javascript'],
        loadExtension: () => javascript({ typescript: false }),
      },
      typescript: {
        name: 'TypeScript',
        extensions: ['.ts', '.tsx'],
        mimeTypes: ['application/typescript', 'text/typescript'],
        loadExtension: () => javascript({ typescript: true }),
      },
      python: {
        name: 'Python',
        extensions: ['.py', '.pyw', '.py3'],
        mimeTypes: ['text/x-python', 'application/x-python'],
        loadExtension: () => python(),
      },
      json: {
        name: 'JSON',
        extensions: ['.json', '.jsonc'],
        mimeTypes: ['application/json', 'application/x-json'],
        loadExtension: () => json(),
      },
      sql: {
        name: 'SQL',
        extensions: ['.sql'],
        mimeTypes: ['text/x-sql', 'application/x-sql'],
        loadExtension: () => sql(),
      },
      shell: {
        name: 'Shell',
        extensions: ['.sh', '.bash', '.zsh', '.fish'],
        mimeTypes: ['application/x-sh', 'text/x-shellscript'],
        loadExtension: () => this.createShellExtension(),
      },
    }

    Object.entries(configs).forEach(([key, config]) => {
      this.languageConfigs.set(key as SupportedLanguage, config)
    })
  }

  private createShellExtension(): Extension[] {
    // Basic shell syntax highlighting
    return [
      {
        name: 'shell-syntax',
        support: () => ({
          parser: [
            {
              // Basic shell command highlighting
              test: /^(cd|ls|pwd|echo|export|source|alias|which|find|grep|sed|awk|sort|uniq|wc|head|tail|cat|less|more|chmod|chown|chgrp|mv|cp|rm|mkdir|rmdir|tar|gzip|gunzip|ps|kill|top|df|du|free|uname|whoami|date|sleep|exit|sudo|su|nohup|bg|fg|jobs|history)\b/,
              token: 'keyword',
            },
            {
              // Shell variables
              test: /\$[a-zA-Z_][a-zA-Z0-9_]*/,
              token: 'variable',
            },
            {
              // Environment variables
              test: /\$[A-Z_][A-Z0-9_]*/,
              token: 'variable-2',
            },
            {
              // Comments
              test: /^#.*$/,
              token: 'comment',
            },
            {
              // Strings
              test: /"([^"\\]|\\.)*"/,
              token: 'string',
            },
            {
              // Single quotes
              test: /'([^']|\\')*'/,
              token: 'string',
            },
            {
              // Numbers
              test: /\b\d+\b/,
              token: 'number',
            },
          ],
        }),
      },
    ] as any[]
  }

  /**
   * Load language extension for a given language
   */
  loadLanguage(language: SupportedLanguage): Extension | Extension[] {
    if (this.loadedExtensions.has(language)) {
      return this.loadedExtensions.get(language)!
    }

    const config = this.languageConfigs.get(language)
    if (!config) {
      throw new Error(`Unsupported language: ${language}`)
    }

    try {
      const extension = config.loadExtension()
      this.loadedExtensions.set(language, extension)
      return extension
    } catch (error) {
      console.error(`Failed to load language extension for ${language}:`, error)
      throw new Error(`Failed to load ${language} language support`)
    }
  }

  /**
   * Detect language based on file extension
   */
  detectLanguageFromExtension(extension: string): SupportedLanguage | null {
    const cleanExtension = extension.startsWith('.') ? extension : `.${extension}`

    for (const [language, config] of this.languageConfigs.entries()) {
      if (config.extensions.includes(cleanExtension)) {
        return language
      }
    }

    return null
  }

  /**
   * Detect language based on MIME type
   */
  detectLanguageFromMimeType(mimeType: string): SupportedLanguage | null {
    for (const [language, config] of this.languageConfigs.entries()) {
      if (config.mimeTypes.includes(mimeType)) {
        return language
      }
    }

    return null
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return Array.from(this.languageConfigs.keys())
  }

  /**
   * Get language configuration
   */
  getLanguageConfig(language: SupportedLanguage): LanguageConfig | null {
    return this.languageConfigs.get(language) || null
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(language: string): language is SupportedLanguage {
    return this.languageConfigs.has(language as SupportedLanguage)
  }

  /**
   * Get file extensions for a language
   */
  getFileExtensions(language: SupportedLanguage): string[] {
    const config = this.languageConfigs.get(language)
    return config?.extensions || []
  }

  /**
   * Preload language extensions for better performance
   */
  async preloadLanguages(languages: SupportedLanguage[]): Promise<void> {
    const loadPromises = languages.map(async (language) => {
      if (!this.loadedExtensions.has(language)) {
        try {
          this.loadLanguage(language)
        } catch (error) {
          console.warn(`Failed to preload language ${language}:`, error)
        }
      }
    })

    await Promise.allSettled(loadPromises)
  }

  /**
   * Clear loaded extensions cache
   */
  clearCache(): void {
    this.loadedExtensions.clear()
  }

  /**
   * Get loaded extensions count
   */
  getLoadedExtensionsCount(): number {
    return this.loadedExtensions.size
  }
}