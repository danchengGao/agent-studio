/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { WorkflowDocument, FlowNodeEntity } from '@flowgram.ai/free-layout-editor'
import type { ValidationErrorInfo } from '../components/validation/types'
import { validateWorkflowPath, getNodeDisplayName, hasConnections } from '../utils/validation'
import { t } from '../i18n'

export interface ValidationResult {
  hasErrors: boolean
  errors: ValidationErrorInfo[]
  isValid: boolean
}

export class ValidationService {
  private static instance: ValidationService
  private validationCache = new Map<string, ValidationResult>()
  private lastValidationTime = 0
  private readonly CACHE_DURATION = 2000 // 2 seconds cache

  static getInstance(): ValidationService {
    if (!this.instance) {
      this.instance = new ValidationService()
    }
    return this.instance
  }

  async validateWorkflow(document: WorkflowDocument, force = false): Promise<ValidationResult> {
    const now = Date.now()
    const cacheKey = this.generateCacheKey(document)

    // Check cache
    if (!force && now - this.lastValidationTime < this.CACHE_DURATION && this.validationCache.has(cacheKey)) {
      const cachedResult = this.validationCache.get(cacheKey)!

      // Verify cached result matches current form states
      const allNodes = document.getAllNodes()
      let currentHasErrors = false
      for (const node of allNodes) {
        if (node.form?.state.invalid) {
          currentHasErrors = true
          break
        }
      }

      // Invalidate cache if form state changed
      if (cachedResult.hasErrors !== currentHasErrors) {
        this.validationCache.delete(cacheKey)
      } else {
        return cachedResult
      }
    }

    // Perform validation
    const result = await this.performValidation(document)
    this.validationCache.set(cacheKey, result)
    this.lastValidationTime = now

    return result
  }

  private async performValidation(document: WorkflowDocument): Promise<ValidationResult> {
    const allNodes = document.getAllNodes()
    const allForms = allNodes.map(node => node.form)

    const errors: ValidationErrorInfo[] = []
    let hasErrors = false

    // Validate each node
    for (let index = 0; index < allForms.length; index++) {
      const form = allForms[index]
      const node = allNodes[index]

      if (!hasConnections(node)) {
        continue
      }

      try {
        if (form) {
          // Clear stale errors before validation
          if (form.state.errors) {
            form.state.errors = {}
          }

          await form.validate()
        }

        // Check if form is invalid after validation
        if (form?.state.invalid) {
          hasErrors = true

          if (form.state.errors) {
            Object.entries(form.state.errors).forEach(([field, errorArray]) => {
              if (errorArray && errorArray.length > 0) {
                const firstError = errorArray[0]
                const errorMessage = typeof firstError === 'string' ? firstError : firstError?.message || t('workflowCanvas.validation.configurationError')

                errors.push({
                  nodeId: node.id.toString(),
                  nodeTitle: String(getNodeDisplayName(node)),
                  error: errorMessage,
                  severity: 'error' as const,
                  field,
                })
              }
            })
          }
        }
      } catch (error) {
        let errorMessage = t('workflowCanvas.validation.configurationError')
        if (error instanceof Error) {
          errorMessage = error.message
        } else if (typeof error === 'string') {
          errorMessage = error
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = String(error.message)
        }

        errors.push({
          nodeId: node.id.toString(),
          nodeTitle: String(getNodeDisplayName(node)),
          error: errorMessage,
          severity: 'error' as const,
        })
        hasErrors = true
      }
    }

    // Validate workflow path
    const workflowPathErrors = validateWorkflowPath(document)
    if (workflowPathErrors.length > 0) {
      hasErrors = true
      errors.push(...workflowPathErrors)
    }

    return {
      hasErrors,
      errors,
      isValid: !hasErrors,
    }
  }

  invalidateCache(): void {
    this.validationCache.clear()
  }

  private generateCacheKey(document: WorkflowDocument): string {
    const allNodes = document.getAllNodes()
    const nodeHashes = allNodes.map(node => {
      const form = node.form
      const formData = form?.getData ? JSON.stringify(form.getData()) : ''
      return `${node.id}:${form?.state.invalid ?? false}:${formData}`
    })
    return nodeHashes.join('|')
  }
}
