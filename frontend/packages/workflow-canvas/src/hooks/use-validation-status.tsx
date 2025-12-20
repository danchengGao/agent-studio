/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useEffect, useState, useCallback } from 'react'
import { useService } from '@flowgram.ai/free-layout-core'
import { WorkflowDocument, FlowNodeEntity } from '@flowgram.ai/free-layout-editor'
import { usePanelManager } from '@flowgram.ai/panel-manager-plugin'
import { nodeValidationErrorPanelFactory } from '../components/validation/node-validation-error-panel'
import { ValidationService, type ValidationResult } from '../services/validation-service'

export const useValidationStatus = () => {
  const document = useService(WorkflowDocument)
  const panelManager = usePanelManager()
  const validationService = ValidationService.getInstance()

  const [validationResult, setValidationResult] = useState<ValidationResult>({
    hasErrors: false,
    errors: [],
    isValid: true,
  })
  const [isValidationPanelOpen, setIsValidationPanelOpen] = useState(false)

  const validateAndReturnErrors = useCallback(
    async (force = false, showErrorPanel = false) => {
      const result = await validationService.validateWorkflow(document, force)
      setValidationResult(result)

      if (result.hasErrors && result.errors.length > 0 && showErrorPanel) {
        setIsValidationPanelOpen(true)
        panelManager.open(nodeValidationErrorPanelFactory.key, 'bottom', {
          props: { errors: result.errors },
        })
      } else if (!result.hasErrors && isValidationPanelOpen) {
        setIsValidationPanelOpen(false)
        panelManager.close(nodeValidationErrorPanelFactory.key)
      }

      return result
    },
    [document, panelManager, validationService, isValidationPanelOpen],
  )

  // Listen to form changes with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleValidationChange = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        validateAndReturnErrors()
      }, 500)
    }

    const listeners: (() => void)[] = []
    const currentForms = document.getAllNodes().map(node => node.form)

    currentForms.forEach(form => {
      if (form) {
        const dispose = form.onValidate(handleValidationChange)
        listeners.push(() => dispose.dispose())
      }
    })

    const handleNodeCreate = ({ node }: { node: any }) => {
      const form = node.form
      if (form) {
        listeners.push(form.onValidate(handleValidationChange).dispose)
      }
      validationService.invalidateCache()
    }

    document.onNodeCreate(handleNodeCreate)

    return () => {
      clearTimeout(timeoutId)
      listeners.forEach(dispose => dispose())
    }
  }, [document, validateAndReturnErrors, validationService])

  const showErrorPanel = useCallback(() => {
    if (validationResult.hasErrors && validationResult.errors.length > 0) {
      setIsValidationPanelOpen(true)
      panelManager.open(nodeValidationErrorPanelFactory.key, 'bottom', {
        props: { errors: validationResult.errors },
      })
    }
  }, [validationResult, panelManager])

  return {
    hasValidationErrors: validationResult.hasErrors,
    validationErrors: validationResult.errors,
    isValid: validationResult.isValid,
    validateAndReturnErrors,
    showErrorPanel,
  }
}
