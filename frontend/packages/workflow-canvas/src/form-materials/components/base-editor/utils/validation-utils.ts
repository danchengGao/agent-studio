/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ValidationRule {
  name: string
  validate: (value: string) => ValidationResult
  severity?: 'error' | 'warning'
}

export interface EditorValidationOptions {
  validateOnInput?: boolean
  validateOnChange?: boolean
  debounceDelay?: number
  maxErrors?: number
  maxWarnings?: number
}

/**
 * Validation Utilities for editor content validation
 */
export class ValidationUtils {
  private rules: Map<string, ValidationRule[]>
  private options: EditorValidationOptions

  constructor(options: EditorValidationOptions = {}) {
    this.rules = new Map()
    this.options = {
      validateOnInput: true,
      validateOnChange: true,
      debounceDelay: 300,
      maxErrors: 10,
      maxWarnings: 10,
      ...options,
    }

    this.initializeDefaultRules()
  }

  private initializeDefaultRules(): void {
    // Syntax validation rules for different languages
    this.addLanguageRule('javascript', this.createJavaScriptRules())
    this.addLanguageRule('typescript', this.createTypeScriptRules())
    this.addLanguageRule('python', this.createPythonRules())
    this.addLanguageRule('json', this.createJsonRules())
    this.addLanguageRule('sql', this.createSqlRules())
    this.addLanguageRule('shell', this.createShellRules())

    // General rules
    this.addLanguageRule('general', this.createGeneralRules())
  }

  private createJavaScriptRules(): ValidationRule[] {
    return [
      {
        name: 'balanced-braces',
        validate: (value: string) => this.validateBraces(value),
        severity: 'error',
      },
      {
        name: 'balanced-brackets',
        validate: (value: string) => this.validateBrackets(value),
        severity: 'error',
      },
      {
        name: 'balanced-parentheses',
        validate: (value: string) => this.validateParentheses(value),
        severity: 'error',
      },
      {
        name: 'no-trailing-commas',
        validate: (value: string) => this.validateTrailingCommas(value),
        severity: 'warning',
      },
      {
        name: 'valid-variable-names',
        validate: (value: string) => this.validateJavaScriptVariableNames(value),
        severity: 'warning',
      },
    ]
  }

  private createTypeScriptRules(): ValidationRule[] {
    return [
      ...this.createJavaScriptRules(),
      {
        name: 'typescript-interface-syntax',
        validate: (value: string) => this.validateTypeScriptInterfaces(value),
        severity: 'error',
      },
      {
        name: 'typescript-type-syntax',
        validate: (value: string) => this.validateTypeScriptTypes(value),
        severity: 'warning',
      },
    ]
  }

  private createPythonRules(): ValidationRule[] {
    return [
      {
        name: 'python-indentation',
        validate: (value: string) => this.validatePythonIndentation(value),
        severity: 'error',
      },
      {
        name: 'balanced-braces',
        validate: (value: string) => this.validateBraces(value),
        severity: 'error',
      },
      {
        name: 'balanced-brackets',
        validate: (value: string) => this.validateBrackets(value),
        severity: 'error',
      },
      {
        name: 'balanced-parentheses',
        validate: (value: string) => this.validateParentheses(value),
        severity: 'error',
      },
      {
        name: 'python-keywords',
        validate: (value: string) => this.validatePythonKeywords(value),
        severity: 'warning',
      },
    ]
  }

  private createJsonRules(): ValidationRule[] {
    return [
      {
        name: 'json-syntax',
        validate: (value: string) => this.validateJsonSyntax(value),
        severity: 'error',
      },
      {
        name: 'json-keys',
        validate: (value: string) => this.validateJsonKeys(value),
        severity: 'error',
      },
    ]
  }

  private createSqlRules(): ValidationRule[] {
    return [
      {
        name: 'balanced-parentheses',
        validate: (value: string) => this.validateParentheses(value),
        severity: 'error',
      },
      {
        name: 'sql-keywords',
        validate: (value: string) => this.validateSqlKeywords(value),
        severity: 'warning',
      },
      {
        name: 'balanced-quotes',
        validate: (value: string) => this.validateQuotes(value),
        severity: 'error',
      },
    ]
  }

  private createShellRules(): ValidationRule[] {
    return [
      {
        name: 'balanced-quotes',
        validate: (value: string) => this.validateQuotes(value),
        severity: 'error',
      },
      {
        name: 'shell-syntax',
        validate: (value: string) => this.validateShellSyntax(value),
        severity: 'warning',
      },
    ]
  }

  private createGeneralRules(): ValidationRule[] {
    return [
      {
        name: 'line-length',
        validate: (value: string) => this.validateLineLength(value, 120),
        severity: 'warning',
      },
      {
        name: 'trailing-whitespace',
        validate: (value: string) => this.validateTrailingWhitespace(value),
        severity: 'warning',
      },
      {
        name: 'empty-lines',
        validate: (value: string) => this.validateEmptyLines(value, 5),
        severity: 'warning',
      },
    ]
  }

  /**
   * Add validation rules for a language
   */
  addLanguageRule(language: string, rules: ValidationRule[]): void {
    this.rules.set(language, rules)
  }

  /**
   * Get validation rules for a language
   */
  getLanguageRules(language: string): ValidationRule[] {
    return this.rules.get(language) || []
  }

  /**
   * Validate content for a specific language
   */
  validate(value: string, language: string): ValidationResult {
    const languageRules = this.getLanguageRules(language)
    const generalRules = this.getLanguageRules('general')
    const allRules = [...languageRules, ...generalRules]

    const errors: string[] = []
    const warnings: string[] = []

    for (const rule of allRules) {
      try {
        const result = rule.validate(value)
        if (!result.valid) {
          if (rule.severity === 'error') {
            errors.push(...result.errors.slice(0, this.options.maxErrors! - errors.length))
          } else {
            warnings.push(...result.warnings.slice(0, this.options.maxWarnings! - warnings.length))
          }
        }
      } catch (error) {
        console.warn(`Validation rule "${rule.name}" failed:`, error)
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.slice(0, this.options.maxErrors!),
      warnings: warnings.slice(0, this.options.maxWarnings!),
    }
  }

  // Validation rule implementations

  private validateBraces(value: string): ValidationResult {
    const openBraces = (value.match(/{/g) || []).length
    const closeBraces = (value.match(/}/g) || []).length

    if (openBraces === closeBraces) {
      return { valid: true, errors: [], warnings: [] }
    }

    const diff = openBraces - closeBraces
    const error = diff > 0
      ? `${diff} unclosed brace${diff > 1 ? 's' : ''}`
      : `${Math.abs(diff)} extra closing brace${Math.abs(diff) > 1 ? 's' : ''}`

    return { valid: false, errors: [error], warnings: [] }
  }

  private validateBrackets(value: string): ValidationResult {
    const openBrackets = (value.match(/\[/g) || []).length
    const closeBrackets = (value.match(/\]/g) || []).length

    if (openBrackets === closeBrackets) {
      return { valid: true, errors: [], warnings: [] }
    }

    const diff = openBrackets - closeBrackets
    const error = diff > 0
      ? `${diff} unclosed bracket${diff > 1 ? 's' : ''}`
      : `${Math.abs(diff)} extra closing bracket${Math.abs(diff) > 1 ? 's' : ''}`

    return { valid: false, errors: [error], warnings: [] }
  }

  private validateParentheses(value: string): ValidationResult {
    const openParens = (value.match(/\(/g) || []).length
    const closeParens = (value.match(/\)/g) || []).length

    if (openParens === closeParens) {
      return { valid: true, errors: [], warnings: [] }
    }

    const diff = openParens - closeParens
    const error = diff > 0
      ? `${diff} unclosed parenthes${diff > 1 ? 'es' : 'is'}`
      : `${Math.abs(diff)} extra closing parenthes${Math.abs(diff) > 1 ? 'es' : 'is'}`

    return { valid: false, errors: [error], warnings: [] }
  }

  private validateQuotes(value: string): ValidationResult {
    const singleQuotes = (value.match(/'/g) || []).length
    const doubleQuotes = (value.match(/"/g) || []).length

    const errors: string[] = []

    if (singleQuotes % 2 !== 0) {
      errors.push('Unclosed single quote')
    }

    if (doubleQuotes % 2 !== 0) {
      errors.push('Unclosed double quote')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    }
  }

  private validateJsonSyntax(value: string): ValidationResult {
    if (value.trim() === '') {
      return { valid: true, errors: [], warnings: [] }
    }

    try {
      JSON.parse(value)
      return { valid: true, errors: [], warnings: [] }
    } catch (error) {
      return {
        valid: false,
        errors: [`JSON syntax error: ${error instanceof Error ? error.message : 'Invalid JSON'}`],
        warnings: [],
      }
    }
  }

  private validateJsonKeys(value: string): ValidationResult {
    if (value.trim() === '') {
      return { valid: true, errors: [], warnings: [] }
    }

    try {
      const parsed = JSON.parse(value)
      const errors: string[] = []

      const checkKeys = (obj: any, path: string = 'root'): void => {
        if (typeof obj === 'object' && obj !== null) {
          for (const [key, val] of Object.entries(obj)) {
            if (typeof key !== 'string') {
              errors.push(`Invalid key type at ${path}: ${typeof key}`)
            }
            if (key.trim() !== key) {
              errors.push(`Key with whitespace at ${path}: "${key}"`)
            }
            checkKeys(val, `${path}.${key}`)
          }
        }
      }

      checkKeys(parsed)

      return {
        valid: errors.length === 0,
        errors,
        warnings: [],
      }
    } catch (error) {
      return { valid: false, errors: ['Invalid JSON'], warnings: [] }
    }
  }

  private validatePythonIndentation(value: string): ValidationResult {
    const lines = value.split('\n')
    const errors: string[] = []
    const stack: number[] = [0]

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      if (trimmed === '' || trimmed.startsWith('#')) {
        continue
      }

      const indent = line.length - line.trimStart().length

      if (indent % 4 !== 0) {
        errors.push(`Line ${i + 1}: Indentation should be multiples of 4 spaces`)
        continue
      }

      // Check for inconsistent indentation
      const lastIndent = stack[stack.length - 1]

      if (indent > lastIndent) {
        if (indent - lastIndent !== 4) {
          errors.push(`Line ${i + 1}: Indentation should increase by exactly 4 spaces`)
        }
        stack.push(indent)
      } else if (indent < lastIndent) {
        while (stack.length > 1 && stack[stack.length - 1] > indent) {
          stack.pop()
        }
        if (stack[stack.length - 1] !== indent) {
          errors.push(`Line ${i + 1}: Inconsistent indentation level`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    }
  }

  private validateLineLength(value: string, maxLength: number): ValidationResult {
    const lines = value.split('\n')
    const warnings: string[] = []

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > maxLength) {
        warnings.push(`Line ${i + 1} exceeds ${maxLength} characters (${lines[i].length} chars)`)
      }
    }

    return {
      valid: true,
      errors: [],
      warnings,
    }
  }

  private validateTrailingWhitespace(value: string): ValidationResult {
    const lines = value.split('\n')
    const warnings: string[] = []

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trimEnd() !== lines[i]) {
        warnings.push(`Line ${i + 1} has trailing whitespace`)
      }
    }

    return {
      valid: true,
      errors: [],
      warnings,
    }
  }

  private validateEmptyLines(value: string, maxConsecutive: number): ValidationResult {
    const lines = value.split('\n')
    let consecutiveEmpty = 0
    const warnings: string[] = []

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '') {
        consecutiveEmpty++
        if (consecutiveEmpty > maxConsecutive) {
          warnings.push(`Lines ${i - consecutiveEmpty + 2}-${i + 1}: Too many empty lines`)
          break
        }
      } else {
        consecutiveEmpty = 0
      }
    }

    return {
      valid: true,
      errors: [],
      warnings,
    }
  }

  private validateTrailingCommas(value: string): ValidationResult {
    const lines = value.split('\n')
    const warnings: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.endsWith(',') && !line.includes('//') && !line.includes('/*')) {
        warnings.push(`Line ${i + 1}: Trailing comma`)
      }
    }

    return {
      valid: true,
      errors: [],
      warnings,
    }
  }

  private validateJavaScriptVariableNames(value: string): ValidationResult {
    const variableRegex = /\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
    const warnings: string[] = []
    let match

    while ((match = variableRegex.exec(value)) !== null) {
      const varName = match[1]
      if (!/^[a-z][a-zA-Z0-9]*$/.test(varName)) {
        warnings.push(`Variable "${varName}" should use camelCase`)
      }
    }

    return {
      valid: true,
      errors: [],
      warnings,
    }
  }

  private validateTypeScriptInterfaces(value: string): ValidationResult {
    const interfaceRegex = /interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
    const warnings: string[] = []
    let match

    while ((match = interfaceRegex.exec(value)) !== null) {
      const interfaceName = match[1]
      if (!/^[A-Z][a-zA-Z0-9]*$/.test(interfaceName)) {
        warnings.push(`Interface "${interfaceName}" should use PascalCase`)
      }
    }

    return {
      valid: true,
      errors: [],
      warnings,
    }
  }

  private validateTypeScriptTypes(value: string): ValidationResult {
    const typeRegex = /:\s*([a-zA-Z_$][a-zA-Z0-9_$<>\[\]|,\s]*)/g
    const warnings: string[] = []

    // This is a simplified validation - in practice, TypeScript type checking is more complex
    while (typeRegex.exec(value)) {
      // Basic type validation would go here
      // For now, we'll just check for obvious issues
    }

    return {
      valid: true,
      errors: [],
      warnings,
    }
  }

  private validatePythonKeywords(value: string): ValidationResult {
    const pythonKeywords = ['and', 'or', 'not', 'in', 'is', 'None', 'True', 'False']
    const warnings: string[] = []

    for (const keyword of pythonKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g')
      const matches = value.match(regex)
      if (matches && matches.length > 10) {
        warnings.push(`Consider using ${keyword} keyword more efficiently`)
      }
    }

    return {
      valid: true,
      errors: [],
      warnings,
    }
  }

  private validateSqlKeywords(value: string): ValidationResult {
    const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'OUTER', 'LEFT', 'RIGHT', 'GROUP BY', 'ORDER BY']
    const warnings: string[] = []

    const upperCaseValue = value.toUpperCase()
    for (const keyword of sqlKeywords) {
      if (value.includes(keyword.toLowerCase()) && !upperCaseValue.includes(keyword)) {
        warnings.push(`SQL keyword "${keyword}" should be uppercase`)
      }
    }

    return {
      valid: true,
      errors: [],
      warnings,
    }
  }

  private validateShellSyntax(value: string): ValidationResult {
    const warnings: string[] = []

    // Check for potential issues in shell scripts
    if (value.includes('rm -rf /')) {
      warnings.push('Potentially dangerous command: rm -rf /')
    }

    if (value.includes('sudo rm') && !value.includes('#')) {
      warnings.push('Dangerous sudo rm command detected')
    }

    return {
      valid: true,
      errors: [],
      warnings,
    }
  }

  /**
   * Create a custom validation rule
   */
  createRule(name: string, validator: (value: string) => ValidationResult, severity: 'error' | 'warning' = 'error'): ValidationRule {
    return {
      name,
      validate: validator,
      severity,
    }
  }

  /**
   * Add a custom rule to a language
   */
  addRule(language: string, rule: ValidationRule): void {
    const existingRules = this.rules.get(language) || []
    this.rules.set(language, [...existingRules, rule])
  }

  /**
   * Remove a rule from a language
   */
  removeRule(language: string, ruleName: string): void {
    const existingRules = this.rules.get(language) || []
    const filteredRules = existingRules.filter(rule => rule.name !== ruleName)
    this.rules.set(language, filteredRules)
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.rules.keys()).filter(lang => lang !== 'general')
  }
}